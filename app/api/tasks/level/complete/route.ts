import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'

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

  // Server-side integrity check
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
  const showAd = newCompletedCount % 5 === 0 // ads after audio 5, 10, 15

  const updatePayload: Record<string, any> = {
    completed_audios: newCompletedCount,
    completed_audio_ids: newCompletedIds,
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
    show_ad: showAd,
    level_complete: isLevelComplete,
    next_audio: nextAudio,
  })
}