import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const LEVEL_NAME = 'bronze'
const TOTAL_AUDIOS = 15

const FULL_AD_MILESTONES = [5, 10, 15]
const SMARTLINK_MILESTONES: number[] = []

const MIN_REAL_TIME_RATIO = 0.6

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audio_id, session_token } = await req.json()
  if (!audio_id) return NextResponse.json({ error: 'audio_id required' }, { status: 400 })
  if (!session_token) {
    return NextResponse.json({ error: 'session_token required' }, { status: 400 })
  }

  const { data: level, error } = await supabase
    .from('user_levels')
    .select('*')
    .eq('user_id', user.id)
    .eq('level_name', LEVEL_NAME)
    .single()

  if (error || !level) return NextResponse.json({ error: 'Level not found' }, { status: 404 })

  if (level.locked_until && new Date(level.locked_until) > new Date()) {
    return NextResponse.json({ error: 'Level is locked until midnight' }, { status: 403 })
  }

  if (level.pending_ad_milestone) {
    return NextResponse.json(
      { error: 'AD_REQUIRED', milestone: level.pending_ad_milestone },
      { status: 409 }
    )
  }

  const expectedAudioId = level.audio_ids[level.completed_audios]
  if (expectedAudioId !== audio_id) {
    return NextResponse.json({ error: 'Audio out of order or already completed' }, { status: 409 })
  }
  if (level.completed_audio_ids.includes(audio_id)) {
    return NextResponse.json({ error: 'Audio already completed' }, { status: 409 })
  }

  // ── Real-playback verification ──────────────────────────────
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('audio_sessions')
    .select('*')
    .eq('session_token', session_token)
    .eq('user_id', user.id)
    .eq('audio_id', audio_id)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Invalid or mismatched session' }, { status: 403 })
  }

  const { data: audioRow } = await supabaseAdmin
    .from('audios')
    .select('duration_seconds')
    .eq('id', audio_id)
    .maybeSingle()

  const durationSeconds = audioRow?.duration_seconds || 0
  const elapsedSeconds = (Date.now() - new Date(session.created_at).getTime()) / 1000
  const reportedProgress = session.progress_percent || 0
  const heartbeatCount = session.heartbeat_count || 0

  if (durationSeconds > 0 && elapsedSeconds < durationSeconds * MIN_REAL_TIME_RATIO) {
    return NextResponse.json(
      { error: 'Audio was not actually listened to. Please play it fully.' },
      { status: 403 }
    )
  }
  if (reportedProgress < 85) {
    return NextResponse.json(
      { error: 'Audio progress too low. Please play it fully.' },
      { status: 403 }
    )
  }
  if (durationSeconds > 16) {
    const expectedMinHeartbeats = Math.max(1, Math.floor(durationSeconds / 8) - 2)
    if (heartbeatCount < expectedMinHeartbeats) {
      return NextResponse.json(
        { error: 'Could not verify real playback. Please play the audio again.' },
        { status: 403 }
      )
    }
  }

  const newCompletedCount = level.completed_audios + 1
  const newCompletedIds = [...level.completed_audio_ids, audio_id]
  const isLevelComplete = newCompletedCount >= level.total_audios

  const hitFullAdMilestone = FULL_AD_MILESTONES.includes(newCompletedCount)

  const updatePayload: Record<string, any> = {
    completed_audios: newCompletedCount,
    completed_audio_ids: newCompletedIds,
  }

  // ✅ Set pending_ad_milestone - NO timestamp
  if (hitFullAdMilestone) {
    updatePayload.pending_ad_milestone = newCompletedCount
    if (isLevelComplete) {
      updatePayload.completed_at = new Date().toISOString()
    }
  }

  // ✅ FIX: this write MUST go through supabaseAdmin (service role), not
  // the regular authenticated `supabase` client. If `user_levels` has no
  // UPDATE policy (or a restrictive one) for authenticated users, the
  // regular client's update silently matches 0 rows — no error is thrown,
  // but the DB is never actually changed. Everything downstream (next
  // audio, ad milestones) still looks correct because it's computed from
  // in-memory `newCompletedCount`, so the response *looks* successful —
  // but the next page's /level/status read sees the old completed_audios
  // and bounces the user straight back to the audio they just finished.
  // We already scoped `level` to this user's row above, so an admin write
  // here is safe.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('user_levels')
    .update(updatePayload)
    .eq('id', level.id)
    .select('id, completed_audios, completed_audio_ids')
    .single()

  if (updateErr || !updated) {
    console.error('level/complete: user_levels update failed', updateErr)
    return NextResponse.json({ error: 'Could not save progress, please try again' }, { status: 500 })
  }

  // ✅ Defensive: confirm the write actually landed with the value we
  // expect. If it didn't (e.g. a concurrent request raced us), fail loudly
  // instead of returning a next_audio that doesn't match reality.
  if (updated.completed_audios !== newCompletedCount) {
    console.error(
      'level/complete: post-update mismatch',
      { expected: newCompletedCount, got: updated.completed_audios }
    )
    return NextResponse.json({ error: 'Could not save progress, please try again' }, { status: 500 })
  }

  // ✅ Mark this session as completed so /api/audio/session never reuses it
  // again for a future request of the same audio_id (it will insert a
  // fresh one instead), and so it can never be replayed to claim twice.
  await supabaseAdmin
    .from('audio_sessions')
    .update({ status: 'completed' })
    .eq('session_token', session_token)

  let nextAudio = null
  if (!isLevelComplete) {
    const nextAudioId = level.audio_ids[newCompletedCount]
    const { data: audio } = await supabaseAdmin
      .from('audios')
      .select('id, title, audio_url, thumbnail_url, duration_seconds')
      .eq('id', nextAudioId)
      .single()
    nextAudio = audio
  }

  return NextResponse.json({
    success: true,
    completed_audios: newCompletedCount,
    total_audios: level.total_audios,
    show_ad: hitFullAdMilestone,
    milestone: hitFullAdMilestone ? newCompletedCount : null,
    level_complete: isLevelComplete,
    next_audio: nextAudio,
  })
}