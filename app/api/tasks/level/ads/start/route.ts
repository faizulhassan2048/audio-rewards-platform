import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const LEVEL_NAME = 'bronze'

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
  if (!level.pending_ad_milestone) {
    return NextResponse.json({ error: 'No ad is currently required' }, { status: 400 })
  }

  // ✅ FIX: Only set timestamp if not already set
  let updateData: any = {}
  if (!level.ad_session_started_at) {
    updateData.ad_session_started_at = new Date().toISOString()
  }

  if (Object.keys(updateData).length > 0) {
    const { error: updateErr } = await supabase
      .from('user_levels')
      .update(updateData)
      .eq('id', level.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    milestone: level.pending_ad_milestone,
    alreadyStarted: !!level.ad_session_started_at
  })
}