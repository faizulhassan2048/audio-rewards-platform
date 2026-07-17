import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const TOTAL_AUDIOS = 15

export async function GET() {
  try {
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
          pending_ad_milestone_timestamp: null,
        })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      level = created
    }

    // ── Fixed daily reset (midnight PKT) ─────────────────────────────
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

    // Midnight has passed — reset for the new day
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
          pending_ad_milestone: null,
          ad_session_started_at: null,
          ad_milestones_unlocked: [],
          bonus_claimed: false,
          pending_ad_milestone_timestamp: null,
        })
        .eq('id', level.id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      level = reset
    }

    // ── ✅ AUTO-UNLOCK STUCK MILESTONES ──────────────────────────────
    if (level.pending_ad_milestone && level.pending_ad_milestone_timestamp) {
      const pendingTime = new Date(level.pending_ad_milestone_timestamp).getTime()
      const elapsed = (Date.now() - pendingTime) / 1000
      
      if (elapsed > 30) {
        console.log(`⏰ Auto-unlocking milestone ${level.pending_ad_milestone} after ${elapsed}s`)
        const milestone = level.pending_ad_milestone
        const unlocked = Array.from(new Set([...(level.ad_milestones_unlocked || []), milestone]))
        
        const { error: updateErr } = await supabase
          .from('user_levels')
          .update({
            pending_ad_milestone: null,
            ad_milestones_unlocked: unlocked,
            pending_ad_milestone_timestamp: null,
          })
          .eq('id', level.id)
        
        if (!updateErr) {
          level.pending_ad_milestone = null
          level.ad_milestones_unlocked = unlocked
          level.pending_ad_milestone_timestamp = null
        }
      }
    }

    // ── AD GATE ──────────────────────────────────────────────────────
    if (level.pending_ad_milestone) {
      // ✅ FIX: Get current audio for display even when ad is required
      let currentAudioId = level.audio_ids?.[level.completed_audios]
      let audio = null
      
      if (currentAudioId) {
        const { data: audioRow } = await supabase
          .from('audios')
          .select('id, title, audio_url, thumbnail_url, duration_seconds')
          .eq('id', currentAudioId)
          .maybeSingle()
        audio = audioRow
      }

      return NextResponse.json({
        locked: false,
        level_complete: false,
        ad_required: true,
        milestone: level.pending_ad_milestone,
        level_name: level.level_name,
        completed_audios: level.completed_audios,
        total_audios: level.total_audios,
        current_audio: audio, // ✅ Now returns current_audio
      })
    }

    // ✅ AUTO-NEXT ROUND: Level complete and reward claimed → reset immediately
    if (level.completed_audios >= level.total_audios) {
      if (level.reward_claimed) {
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
            pending_ad_milestone: null,
            ad_session_started_at: null,
            ad_milestones_unlocked: [],
            bonus_claimed: false,
            pending_ad_milestone_timestamp: null,
          })
          .eq('id', level.id)
          .select('*')
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        level = reset
        
        const firstAudioId = level.audio_ids?.[0]
        let audio = null
        if (firstAudioId) {
          const { data: audioRow } = await supabase
            .from('audios')
            .select('id, title, audio_url, thumbnail_url, duration_seconds')
            .eq('id', firstAudioId)
            .maybeSingle()
          audio = audioRow
        }

        return NextResponse.json({
          locked: false,
          level_complete: false,
          level_name: level.level_name,
          completed_audios: 0,
          total_audios: level.total_audios,
          current_audio: audio,
        })
      }

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
    let currentAudioId = level.audio_ids?.[level.completed_audios]

    let audio = null
    if (currentAudioId) {
      const { data: audioRow } = await supabase
        .from('audios')
        .select('id, title, audio_url, thumbnail_url, duration_seconds')
        .eq('id', currentAudioId)
        .maybeSingle()
      audio = audioRow
    }

    if (!currentAudioId || !audio) {
      const freshAudioIds = await pickAudioPool(supabase)

      const { data: refreshed, error } = await supabase
        .from('user_levels')
        .update({
          audio_ids: freshAudioIds,
          total_audios: freshAudioIds.length || TOTAL_AUDIOS,
          completed_audio_ids: [],
          completed_audios: 0,
          pending_ad_milestone_timestamp: null,
        })
        .eq('id', level.id)
        .select('*')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      level = refreshed

      const newCurrentId = level.audio_ids?.[0]
      if (!newCurrentId) {
        return NextResponse.json({
          locked: false,
          level_complete: false,
          level_name: level.level_name,
          completed_audios: level.completed_audios,
          total_audios: level.total_audios,
          current_audio: null,
        })
      }

      const { data: newAudio } = await supabase
        .from('audios')
        .select('id, title, audio_url, thumbnail_url, duration_seconds')
        .eq('id', newCurrentId)
        .maybeSingle()

      return NextResponse.json({
        locked: false,
        level_complete: false,
        level_name: level.level_name,
        completed_audios: level.completed_audios,
        total_audios: level.total_audios,
        current_audio: newAudio || null,
      })
    }

    return NextResponse.json({
      locked: false,
      level_complete: false,
      level_name: level.level_name,
      completed_audios: level.completed_audios,
      total_audios: level.total_audios,
      current_audio: audio,
    })
  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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