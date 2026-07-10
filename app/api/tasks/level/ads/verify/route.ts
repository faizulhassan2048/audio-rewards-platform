import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const MIN_AD_SECONDS = 14 // AdModal's default watch time is 15s — allow 1s slack for request latency

// POST — called when the user taps "Claim X Coins" inside AdModal, once the
// on-screen timer hits 0. This is the only place that clears pending_ad_milestone,
// and it refuses to clear it if not enough real time has passed since /ads/start —
// so someone calling this directly from devtools without waiting can't skip the ad.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: level, error } = await supabase
    .from('user_levels')
    .select('*')
    .eq('user_id', user.id)
    .eq('level_name', LEVEL_NAME)
    .single()

  if (error || !level) return NextResponse.json({ error: 'Level not found' }, { status: 404 })

  const milestone = level.pending_ad_milestone
  if (!milestone) {
    // Nothing pending — either already verified (e.g. a retried request) or
    // never opened. Treat as idempotent success if the milestone is already unlocked.
    return NextResponse.json({ success: true, alreadyUnlocked: true })
  }

  if (!level.ad_session_started_at) {
    return NextResponse.json({ error: 'Ad was not started. Please reopen the ad.' }, { status: 400 })
  }

  const elapsedSeconds = (Date.now() - new Date(level.ad_session_started_at).getTime()) / 1000
  if (elapsedSeconds < MIN_AD_SECONDS) {
    return NextResponse.json({ error: 'Ad not fully watched yet.' }, { status: 400 })
  }

  const unlocked = Array.from(new Set([...(level.ad_milestones_unlocked || []), milestone]))

  const { error: updateErr } = await supabase
    .from('user_levels')
    .update({
      pending_ad_milestone: null,
      ad_session_started_at: null,
      ad_milestones_unlocked: unlocked,
    })
    .eq('id', level.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    milestone,
    milestonesUnlocked: unlocked,
    isFinalMilestone: milestone === level.total_audios,
  })
}
