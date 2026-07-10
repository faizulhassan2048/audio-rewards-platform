import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const AD_MILESTONES = [5, 10, 15]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audio_id } = await req.json()
  if (!audio_id) return NextResponse.json({ error: 'audio_id required' }, { status: 400 })

  const { data: level, error } = await supabase
    .from('user_levels')
    .select('*')
    .eq('user_id', user.id)
    .eq('level_name', LEVEL_NAME)
    .single()

  if (error || !level) return NextResponse.json({ error: 'Level not found' }, { status: 404 })

  if (level.locked_until && new Date(level.locked_until) > new Date()) {
    return NextResponse.json({ error: 'Level is locked' }, { status: 403 })
  }

  // If a previous ad gate is still open, refuse to progress at all.
  // This is what stops "refresh 1-2 times to skip the ad" — the gate lives in
  // the DB, so a reload can't make the server forget it's owed an ad watch.
  if (level.pending_ad_milestone) {
    return NextResponse.json(
      { error: 'AD_REQUIRED', milestone: level.pending_ad_milestone },
      { status: 409 }
    )
  }

  // Server-side integrity check (unchanged) — stops out-of-order/replayed audio_id
  const expectedAudioId = level.audio_ids[level.completed_audios]
  if (expectedAudioId !== audio_id) {
    return NextResponse.json({ error: 'Audio out of order or already completed' }, { status: 409 })
  }
  if (level.completed_audio_ids.includes(audio_id)) {
    return NextResponse.json({ error: 'Audio already completed' }, { status: 409 })
  }

  const newCompletedCount = level.completed_audios + 1
  const newCompletedIds = [...level.completed_audio_ids, audio_id]
  const isLevelComplete = newCompletedCount >= level.total_audios
  const hitMilestone = AD_MILESTONES.includes(newCompletedCount)

  const updatePayload: Record<string, any> = {
    completed_audios: newCompletedCount,
    completed_audio_ids: newCompletedIds,
  }

  if (hitMilestone) {
    // Open the gate. Nothing further can be fetched/served until
    // /api/tasks/level/ads/verify clears this — see status route.
    updatePayload.pending_ad_milestone = newCompletedCount
  }

  if (isLevelComplete) {
    updatePayload.completed_at = new Date().toISOString()
    updatePayload.locked_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  const { error: updateErr } = await supabase
    .from('user_levels')
    .update(updatePayload)
    .eq('id', level.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // While the ad gate is open we never hand back the next audio — even for
  // the same request that just completed audio #5/10/15.
  let nextAudio = null
  if (!isLevelComplete && !hitMilestone) {
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
    show_ad: hitMilestone,
    milestone: hitMilestone ? newCompletedCount : null,
    level_complete: isLevelComplete,
    next_audio: nextAudio,
  })
}
