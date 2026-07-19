import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const LEVEL_NAME = 'bronze'
const MIN_AD_SECONDS = 15

// ✅ In-memory cache to prevent duplicate processing
const processingLocks = new Map<string, boolean>()

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ✅ Create a unique key for this user to prevent race conditions
    const lockKey = `${user.id}-verify`
    
    // ✅ If already processing, wait and return
    if (processingLocks.get(lockKey)) {
      console.log('⏳ Verify already in progress, waiting...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      return NextResponse.json({ success: true, alreadyProcessed: true })
    }
    
    processingLocks.set(lockKey, true)

    const { data: level, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .eq('level_name', LEVEL_NAME)
      .single()

    if (error || !level) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ error: 'Level not found' }, { status: 404 })
    }

    const milestone = level.pending_ad_milestone
    if (!milestone) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ success: true, alreadyUnlocked: true })
    }

    // ✅ Check if already unlocked (prevent duplicate)
    const alreadyUnlocked = level.ad_milestones_unlocked?.includes(milestone)
    if (alreadyUnlocked) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ 
        success: true, 
        alreadyUnlocked: true,
        milestone,
        isFinalMilestone: milestone === level.total_audios,
      })
    }

    if (!level.ad_session_started_at) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ error: 'Ad was not started. Please reopen the ad.' }, { status: 400 })
    }

    const elapsedSeconds = (Date.now() - new Date(level.ad_session_started_at).getTime()) / 1000
    if (elapsedSeconds < MIN_AD_SECONDS) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ error: 'Ad not fully watched yet.' }, { status: 400 })
    }

    // ✅ Update with lock to prevent race conditions
    const unlocked = Array.from(new Set([...(level.ad_milestones_unlocked || []), milestone]))
    const isFinalMilestone = milestone === level.total_audios

    const updatePayload: any = {
      pending_ad_milestone: null,
      ad_session_started_at: null,
      ad_milestones_unlocked: unlocked,
    }

    // ✅ If final milestone, set completed_at
    if (isFinalMilestone) {
      updatePayload.completed_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from('user_levels')
      .update(updatePayload)
      .eq('id', level.id)

    if (updateErr) {
      processingLocks.delete(lockKey)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // ✅ Wait for database commit
    await new Promise(resolve => setTimeout(resolve, 200))

    processingLocks.delete(lockKey)

    return NextResponse.json({
      success: true,
      milestone,
      milestonesUnlocked: unlocked,
      isFinalMilestone,
    })
  } catch (error: any) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}