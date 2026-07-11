import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_NAME = 'bronze'
const BONUS_COINS = 10

// POST — called when the user taps the OPTIONAL "Claim Bonus" button after
// the main 15/15 reward has already been credited. This never blocks or
// delays the guaranteed reward — it only ever adds on top of it, and only
// if the user chooses to open the bonus smartlink.
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

  // The main reward must already be claimed — bonus is only ever additive.
  if (!level.reward_claimed) {
    return NextResponse.json({ error: 'Complete the level first' }, { status: 400 })
  }
  if (level.bonus_claimed) {
    return NextResponse.json({ success: true, already_claimed: true })
  }

  const { data: wallet, error: walletErr } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (walletErr || !wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const balanceBefore = Number(wallet.coin_balance)
  const balanceAfter = balanceBefore + BONUS_COINS

  // Idempotent claim — same double-click/race protection pattern as the main claim route.
  const { data: claimedRow, error: claimErr } = await supabase
    .from('user_levels')
    .update({ bonus_claimed: true })
    .eq('id', level.id)
    .eq('bonus_claimed', false)
    .select('id')
    .maybeSingle()

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })
  if (!claimedRow) {
    return NextResponse.json({ success: true, already_claimed: true })
  }

  const { error: walletUpdateErr } = await supabase
    .from('wallets')
    .update({
      coin_balance: balanceAfter,
      total_earned: Number(wallet.total_earned) + BONUS_COINS,
    })
    .eq('user_id', user.id)

  if (walletUpdateErr) {
    await supabase.from('user_levels').update({ bonus_claimed: false }).eq('id', level.id)
    return NextResponse.json({ error: walletUpdateErr.message }, { status: 500 })
  }

  await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'earn_bonus',
    coins_amount: BONUS_COINS,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_id: level.id,
    reference_type: 'user_levels',
    description: 'Bronze Level — optional smartlink bonus',
  })

  return NextResponse.json({ success: true, coins_awarded: BONUS_COINS, new_balance: balanceAfter })
}