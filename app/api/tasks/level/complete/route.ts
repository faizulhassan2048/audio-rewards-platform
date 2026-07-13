import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'

// ✅ ALL milestones (5, 10, 15) get Full Ad
const FULL_AD_MILESTONES = [5, 10, 15]
// ✅ No smartlink milestones anymore
const SMARTLINK_MILESTONES: number[] = []

const MIN_REAL_TIME_RATIO = 0.6

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  console.log('=========================================')
  console.log('🎯 /api/tasks/level/complete CALLED')
  console.log('=========================================')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('❌ Unauthorized - No user found')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  console.log('✅ User authenticated:', user.id)

  const { audio_id, session_token } = await req.json()
  console.log('📦 Request body:', { audio_id, session_token: session_token ? 'present' : 'missing' })

  if (!audio_id) {
    console.log('❌ audio_id required')
    return NextResponse.json({ error: 'audio_id required' }, { status: 400 })
  }
  if (!session_token) {
    console.log('❌ session_token required')
    return NextResponse.json({ error: 'session_token required' }, { status: 400 })
  }

  // ── Fetch user level ──────────────────────────────────────
  const { data: level, error } = await supabase
    .from('user_levels')
    .select('*')
    .eq('user_id', user.id)
    .eq('level_name', LEVEL_NAME)
    .single()

  if (error || !level) {
    console.log('❌ Level not found:', error)
    return NextResponse.json({ error: 'Level not found' }, { status: 404 })
  }
  console.log('📊 Current level:', {
    completed_audios: level.completed_audios,
    total_audios: level.total_audios,
    pending_ad_milestone: level.pending_ad_milestone,
  })

  // ── Check lock ──────────────────────────────────────────────
  if (level.locked_until && new Date(level.locked_until) > new Date()) {
    console.log('🔒 Level is locked until:', level.locked_until)
    return NextResponse.json({ error: 'Level is locked until midnight' }, { status: 403 })
  }

  // ── Check if already pending ad ──────────────────────────────
  if (level.pending_ad_milestone) {
    console.log('⚠️ Already pending ad for milestone:', level.pending_ad_milestone)
    return NextResponse.json(
      { error: 'AD_REQUIRED', milestone: level.pending_ad_milestone },
      { status: 409 }
    )
  }

  // ── Validate audio order ──────────────────────────────────────
  const expectedAudioId = level.audio_ids[level.completed_audios]
  if (expectedAudioId !== audio_id) {
    console.log('❌ Audio out of order. Expected:', expectedAudioId, 'Got:', audio_id)
    return NextResponse.json({ error: 'Audio out of order or already completed' }, { status: 409 })
  }
  if (level.completed_audio_ids.includes(audio_id)) {
    console.log('❌ Audio already completed:', audio_id)
    return NextResponse.json({ error: 'Audio already completed' }, { status: 409 })
  }

  // ── Real-playback verification ──────────────────────────────
  console.log('🔍 Verifying playback...')
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('audio_sessions')
    .select('*')
    .eq('session_token', session_token)
    .eq('user_id', user.id)
    .eq('audio_id', audio_id)
    .maybeSingle()

  if (sessionErr || !session) {
    console.log('❌ Invalid session:', sessionErr)
    return NextResponse.json({ error: 'Invalid or mismatched session' }, { status: 403 })
  }
  console.log('✅ Session found:', { 
    progress: session.progress_percent, 
    heartbeats: session.heartbeat_count 
  })

  const { data: audioRow } = await supabaseAdmin
    .from('audios')
    .select('duration_seconds')
    .eq('id', audio_id)
    .maybeSingle()

  const durationSeconds = audioRow?.duration_seconds || 0
  const elapsedSeconds = (Date.now() - new Date(session.created_at).getTime()) / 1000
  const reportedProgress = session.progress_percent || 0
  const heartbeatCount = session.heartbeat_count || 0

  console.log('⏱️ Playback stats:', {
    durationSeconds,
    elapsedSeconds,
    reportedProgress,
    heartbeatCount,
    minRequired: durationSeconds * MIN_REAL_TIME_RATIO,
  })

  // ── Verification checks ──────────────────────────────────────
  if (durationSeconds > 0 && elapsedSeconds < durationSeconds * MIN_REAL_TIME_RATIO) {
    console.log('❌ Not enough real time elapsed')
    return NextResponse.json(
      { error: 'Audio was not actually listened to. Please play it fully.' },
      { status: 403 }
    )
  }
  if (reportedProgress < 85) {
    console.log('❌ Progress too low:', reportedProgress)
    return NextResponse.json(
      { error: 'Audio progress too low. Please play it fully.' },
      { status: 403 }
    )
  }
  if (durationSeconds > 16) {
    const expectedMinHeartbeats = Math.max(1, Math.floor(durationSeconds / 8) - 2)
    if (heartbeatCount < expectedMinHeartbeats) {
      console.log('❌ Too few heartbeats:', heartbeatCount, 'Expected:', expectedMinHeartbeats)
      return NextResponse.json(
        { error: 'Could not verify real playback. Please play the audio again.' },
        { status: 403 }
      )
    }
  }
  console.log('✅ All verification checks passed!')

  // ── Update progress ──────────────────────────────────────────
  const newCompletedCount = level.completed_audios + 1
  const newCompletedIds = [...level.completed_audio_ids, audio_id]
  const isLevelComplete = newCompletedCount >= level.total_audios

  console.log('📈 Progress update:', {
    newCompletedCount,
    total: level.total_audios,
    isLevelComplete,
  })

  // ✅ Check if this is a Full Ad milestone (5, 10, 15)
  const hitFullAdMilestone = FULL_AD_MILESTONES.includes(newCompletedCount)
  console.log('🎯 Milestone check:', {
    newCompletedCount,
    hitFullAdMilestone,
    FULL_AD_MILESTONES,
  })

  const updatePayload: Record<string, any> = {
    completed_audios: newCompletedCount,
    completed_audio_ids: newCompletedIds,
  }

  // ✅ Set pending_ad_milestone for ALL milestones (5, 10, 15)
  if (hitFullAdMilestone) {
    updatePayload.pending_ad_milestone = newCompletedCount
    console.log('🔴 🔴 🔴 SETTING pending_ad_milestone =', newCompletedCount)
    if (isLevelComplete) {
      updatePayload.completed_at = new Date().toISOString()
      console.log('📅 Level complete, setting completed_at')
    }
  } else {
    console.log('ℹ️ Not a milestone, no ad required')
  }

  console.log('📦 updatePayload:', JSON.stringify(updatePayload, null, 2))

  // ── Database update ──────────────────────────────────────────
  console.log('💾 Updating database...')
  const { error: updateErr } = await supabase
    .from('user_levels')
    .update(updatePayload)
    .eq('id', level.id)

  if (updateErr) {
    console.error('❌❌❌ DATABASE UPDATE ERROR:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }
  console.log('✅ Database update successful!')

  // ── Get next audio ──────────────────────────────────────────
  let nextAudio = null
  if (!isLevelComplete) {
    const nextAudioId = level.audio_ids[newCompletedCount]
    console.log('🎵 Fetching next audio:', nextAudioId)
    const { data: audio } = await supabase
      .from('audios')
      .select('id, title, audio_url, thumbnail_url, duration_seconds')
      .eq('id', nextAudioId)
      .single()
    nextAudio = audio
    console.log('✅ Next audio found:', nextAudio?.title || 'No title')
  }

  // ── Response ──────────────────────────────────────────────────
  const response = {
    success: true,
    completed_audios: newCompletedCount,
    total_audios: level.total_audios,
    show_ad: hitFullAdMilestone,
    milestone: hitFullAdMilestone ? newCompletedCount : null,
    level_complete: isLevelComplete,
    next_audio: nextAudio,
  }

  console.log('📤 RESPONSE:', JSON.stringify(response, null, 2))
  console.log('=========================================')
  console.log('✅ /api/tasks/level/complete COMPLETED')
  console.log('=========================================\n')

  return NextResponse.json(response)
}