import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const REWARD_COINS = 45;
const LEVEL_NAME = 'silver';
const TOTAL_PARAGRAPHS = 15;

export async function POST() {
  try {
    console.log('🔍 Claim API called');
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Unauthorized - No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 User ID:', user.id);

    // ✅ Get level
    const { data: level, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .eq('level_name', LEVEL_NAME)
      .single();

    if (error || !level) {
      console.error('❌ Level not found:', error);
      return NextResponse.json({ error: 'Level not found' }, { status: 404 });
    }

    console.log('📊 Level data:', {
      completed: level.silver_completed_paragraphs,
      reward_claimed: level.silver_reward_claimed,
      pending_ad: level.silver_pending_ad_milestone,
    });

    // ✅ Check if already claimed
    if (level.silver_reward_claimed) {
      console.log('⚠️ Reward already claimed');
      return NextResponse.json({ 
        success: true, 
        alreadyClaimed: true,
        message: 'Reward already claimed' 
      });
    }

    // ✅ Check if level complete
    const completed = level.silver_completed_paragraphs || 0;

    if (completed < TOTAL_PARAGRAPHS) {
      console.log('❌ Level not complete:', completed, '/', TOTAL_PARAGRAPHS);
      return NextResponse.json({ 
        error: 'Level not complete yet. Complete all 15 paragraphs first.' 
      }, { status: 400 });
    }

    // ✅ Update database - Claim reward
    console.log('✅ Updating reward claim...');
    
    const { error: updateErr } = await supabase
      .from('user_levels')
      .update({
        silver_reward_claimed: true,
        silver_pending_ad_milestone: null,
        silver_completed_at: new Date().toISOString(),
      })
      .eq('id', level.id);

    if (updateErr) {
      console.error('❌ Update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log('✅ Reward claimed successfully!');

    // ✅ Add coins to wallet
    try {
      // First check if wallet exists
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('coins')
        .eq('user_id', user.id)
        .single();

      if (wallet) {
        // Update existing wallet
        const { error: walletErr } = await supabase
          .from('user_wallets')
          .update({ 
            coins: (wallet.coins || 0) + REWARD_COINS 
          })
          .eq('user_id', user.id);

        if (walletErr) {
          console.warn('⚠️ Wallet update error:', walletErr);
        } else {
          console.log('✅ Wallet updated:', (wallet.coins || 0) + REWARD_COINS);
        }
      } else {
        // Create new wallet
        const { error: walletErr } = await supabase
          .from('user_wallets')
          .insert({
            user_id: user.id,
            coins: REWARD_COINS,
          });

        if (walletErr) {
          console.warn('⚠️ Wallet create error:', walletErr);
        } else {
          console.log('✅ Wallet created with', REWARD_COINS, 'coins');
        }
      }
    } catch (walletError) {
      console.warn('⚠️ Wallet error:', walletError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      reward_claimed: true,
      coins_added: REWARD_COINS,
      message: `🎉 +${REWARD_COINS} coins added!`,
    });

  } catch (error) {
    console.error('❌ Claim error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}