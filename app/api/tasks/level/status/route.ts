import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const TOTAL_AUDIOS = 15

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data: level } = await supabase
    .from('user_levels')
    .select('*')
    .eq('user_id', user.id)
    .eq('level_name', LEVEL_NAME)
    .maybeSingle()

  const now = new Date()

  // First time — create row with 15 audios
  if (!level) {
    const audioIds = await pickAudioPool(supabase)
    const { data: created, error } = await supabase
      .from('user_levels')
      .insert({
        user_id: user.id,
        level_name: LEVEL_NAME,
        total_audios: audioIds.length || TOTAL_AUDIOS,
        audio_ids: audioIds,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    level = created
  }

  // In cooldown
  if (level.locked_until && new Date(level.locked_until) > now) {
    return NextResponse.json({
      locked: true,
      locked_until: level.locked_until,
      level_name: level.level_name,
      completed_audios: level.completed_audios,
      total_audios: level.total_audios,
      reward_claimed: level.reward_claimed,
    })
  }

  // Cooldown expired — reset
  if (level.locked_until && new Date(level.locked_until) <= now) {
    const audioIds = await pickAudioPool(supabase)
    const { data: reset, error } = await supabase
      .from('user_levels')
      .update({
        audio_ids: audioIds,
        total_audios: audioIds.length || TOTAL_AUDIOS,
        completed_audio_ids: [],
        completed_audios: 0,
        reward_claimed: false,
        completed_at: null,
        locked_until: null,
      })
      .eq('id', level.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    level = reset
  }

  // Level complete — waiting for claim
  if (level.completed_audios >= level.total_audios) {
    return NextResponse.json({
      locked: false,
      level_complete: true,
      reward_claimed: level.reward_claimed,
      level_name: level.level_name,
      completed_audios: level.completed_audios,
      total_audios: level.total_audios,
    })
  }

  // Get current audio
  const currentAudioId = level.audio_ids[level.completed_audios]
  if (!currentAudioId) {
    return NextResponse.json({
      locked: false,
      level_complete: false,
      level_name: level.level_name,
      completed_audios: level.completed_audios,
      total_audios: level.total_audios,
      current_audio: null,
    })
  }

  const { data: audio, error: audioErr } = await supabase
    .from('audios')
    .select('id, title, audio_url, thumbnail_url, duration_seconds')
    .eq('id', currentAudioId)
    .single()

  if (audioErr || !audio) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 500 })
  }

  return NextResponse.json({
    locked: false,
    level_complete: false,
    level_name: level.level_name,
    completed_audios: level.completed_audios,
    total_audios: level.total_audios,
    current_audio: audio,
  })
}

async function pickAudioPool(supabase: any) {
  const { data } = await supabase
    .from('audios')
    .select('id')
    .eq('category', LEVEL_NAME)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(TOTAL_AUDIOS)

  return (data || []).map((a: { id: string }) => a.id)
}