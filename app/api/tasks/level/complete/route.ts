import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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

  const { error: updateErr } = await supabase
    .from('user_levels')
    .update(updatePayload)
    .eq('id', level.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  let nextAudio = null
  if (!isLevelComplete) {
    const nextAudioId = level.audio_ids[newCompletedCount]
    const { data: audio } = await supabase
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