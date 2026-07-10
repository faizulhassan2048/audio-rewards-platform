import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'

// POST — called the moment the AdModal actually mounts and starts its timer.
// Records when the ad supposedly started, so /verify can check enough real
// time actually passed (see MIN_AD_SECONDS there).
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

  const { error: updateErr } = await supabase
    .from('user_levels')
    .update({ ad_session_started_at: new Date().toISOString() })
    .eq('id', level.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true, milestone: level.pending_ad_milestone })
}
