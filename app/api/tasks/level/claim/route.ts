import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const REWARD_COINS = 45

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
  if (level.completed_audios < level.total_audios) {
    return NextResponse.json({ error: 'Level not yet complete' }, { status: 400 })
  }
  if (level.reward_claimed) {
    return NextResponse.json({ success: true, already_claimed: true })
  }

  const { data: wallet, error: walletErr } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (walletErr || !wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const balanceBefore = Number(wallet.coin_balance)
  const balanceAfter = balanceBefore + REWARD_COINS

  const { error: walletUpdateErr } = await supabase
    .from('wallets')
    .update({
      coin_balance: balanceAfter,
      total_earned: Number(wallet.total_earned) + REWARD_COINS,
    })
    .eq('user_id', user.id)

  if (walletUpdateErr) return NextResponse.json({ error: walletUpdateErr.message }, { status: 500 })

  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'earn_task',
    coins_amount: REWARD_COINS,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_id: level.id,
    reference_type: 'user_levels',
    description: 'Bronze Level completed — 15/15 audios',
  })

  // Leaderboard snapshot (non-fatal)
  try {
    await supabase.from('leaderboard_snapshots').upsert(
      {
        user_id: user.id,
        total_coins: balanceAfter,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
  } catch {
    // non-fatal
  }

  const lockedUntil = level.locked_until || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('user_levels')
    .update({ reward_claimed: true, locked_until: lockedUntil })
    .eq('id', level.id)

  return NextResponse.json({ success: true, coins_awarded: REWARD_COINS, new_balance: balanceAfter })
}