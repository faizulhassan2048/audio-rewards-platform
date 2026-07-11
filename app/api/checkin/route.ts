import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Streak bonus logic
function getStreakReward(streak: number): number {
  if (streak >= 30) return 30
  if (streak >= 14) return 20
  if (streak >= 7)  return 15
  return 5
}

// GET — check if claimed today
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]

    const { data: streak } = await supabaseAdmin
      .from('daily_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()

    const claimed = streak?.last_checkin_date === today

    return NextResponse.json(
      {
        claimed,
        current_streak: streak?.current_streak || 0,
        longest_streak: streak?.longest_streak || 0,
        total_checkins: streak?.total_checkins || 0,
        next_reward: getStreakReward((streak?.current_streak || 0) + 1),
        last_checkin_date: streak?.last_checkin_date || null,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — claim daily check-in
export async function POST(req: Request) {
  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Get existing streak
    const { data: existing } = await supabaseAdmin
      .from('daily_streaks')
      .select('*')
      .eq('user_id', user_id)
      .single()

    // Already claimed today?
    if (existing?.last_checkin_date === today) {
      return NextResponse.json({ error: 'Already claimed today' }, { status: 409 })
    }

    // Calculate new streak
    let newStreak = 1
    if (existing?.last_checkin_date === yesterday) {
      newStreak = (existing.current_streak || 0) + 1
    }

    const newLongest = Math.max(newStreak, existing?.longest_streak || 0)
    const reward = getStreakReward(newStreak)

    // Upsert streak record
    await supabaseAdmin
      .from('daily_streaks')
      .upsert({
        user_id,
        current_streak: newStreak,
        longest_streak: newLongest,
        last_checkin_date: today,
        total_checkins: (existing?.total_checkins || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    // Get wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    const newBalance = Number(wallet.coin_balance) + reward

    // Update wallet
    await supabaseAdmin
      .from('wallets')
      .update({
        coin_balance: newBalance,
        total_earned: Number(wallet.total_earned) + reward,
      })
      .eq('user_id', user_id)

    // Create transaction
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id,
        type: 'earn_checkin',
        coins_amount: reward,
        balance_before: Number(wallet.coin_balance),
        balance_after: newBalance,
        description: `Day ${newStreak} check-in reward`,
      })

    return NextResponse.json({
      success: true,
      coins_earned: reward,
      new_balance: newBalance,
      current_streak: newStreak,
      longest_streak: newLongest,
      is_milestone: [7, 14, 30].includes(newStreak),
    })
  } catch (error: any) {
    console.error('Check-in error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}