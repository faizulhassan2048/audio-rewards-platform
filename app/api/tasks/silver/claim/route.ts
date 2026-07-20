import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LEVEL_NAME = 'silver';
const REWARD_COINS = 45;
const TOTAL_PARAGRAPHS = 15;

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: level, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .eq('level_name', LEVEL_NAME)
      .single();

    if (error || !level) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 });
    }

    if ((level.silver_completed_paragraphs || 0) < TOTAL_PARAGRAPHS) {
      return NextResponse.json({ error: 'Level not yet complete' }, { status: 400 });
    }

    if (level.silver_reward_claimed) {
      return NextResponse.json({ success: true, already_claimed: true });
    }

    // Update wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const balanceBefore = Number(wallet.coin_balance);
    const balanceAfter = balanceBefore + REWARD_COINS;

    const { error: walletErr } = await supabase
      .from('wallets')
      .update({
        coin_balance: balanceAfter,
        total_earned: Number(wallet.total_earned) + REWARD_COINS,
      })
      .eq('id', wallet.id);

    if (walletErr) {
      return NextResponse.json({ error: walletErr.message }, { status: 500 });
    }

    // Update level
    const { error: updateErr } = await supabase
      .from('user_levels')
      .update({
        silver_reward_claimed: true,
        silver_pending_ad_milestone: null,
      })
      .eq('id', level.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coins_awarded: REWARD_COINS,
      new_balance: balanceAfter,
    });
  } catch (error) {
    console.error('Silver claim error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}