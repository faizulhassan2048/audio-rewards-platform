import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // ✅ Real auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionToken, progressPercent } = await req.json();

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });
    }

    // ✅ Session fetch — user_id bhi check karo
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('audio_sessions')
      .select('*, audio:audios(*)')
      .eq('session_token', sessionToken)
      .eq('user_id', user.id) // ✅ Security: apna hi session
      .single();

    if (sessionError || !session) {
      console.error('Session fetch error:', sessionError);
      return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
    }

    if (session.reward_granted) {
      return NextResponse.json({ error: 'Already rewarded' }, { status: 409 });
    }

    // Session age check
    const sessionAge = Date.now() - new Date(session.created_at).getTime();
    if (sessionAge > 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Session expired' }, { status: 400 });
    }

    // Progress check
    const effectiveProgress = Math.max(
      session.progress_percent || 0,
      progressPercent || 0
    );

    if (effectiveProgress < 95) {
      return NextResponse.json({
        error: 'Audio not complete',
        debug: {
          db_progress: session.progress_percent,
          sent_progress: progressPercent,
          effective: effectiveProgress
        }
      }, { status: 400 });
    }

    // Wallet fetch
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet fetch error:', walletError);
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (!session.audio || session.audio.reward_coins == null) {
      return NextResponse.json({ error: 'Audio reward data missing' }, { status: 500 });
    }

    const rewardCoins = session.audio.reward_coins;
    const newBalance = wallet.coin_balance + rewardCoins;

    // Wallet update
    const { error: walletUpdateError } = await supabaseAdmin
      .from('wallets')
      .update({
        coin_balance: newBalance,
        total_earned: wallet.total_earned + rewardCoins,
      })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      console.error('Wallet update error:', walletUpdateError);
      return NextResponse.json({ error: 'Wallet update failed' }, { status: 500 });
    }

    // Session update
    const { error: sessionUpdateError } = await supabaseAdmin
      .from('audio_sessions')
      .update({
        reward_granted: true,
        is_completed: true,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
      })
      .eq('id', session.id);

    if (sessionUpdateError) {
      console.error('Session update error:', sessionUpdateError);
      return NextResponse.json({
        error: 'Session update failed',
        detail: sessionUpdateError.message
      }, { status: 500 });
    }

    // Transaction insert
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'earn_audio',
        coins_amount: rewardCoins,
        balance_before: wallet.coin_balance,
        balance_after: newBalance,
        reference_id: session.audio_id,
        reference_type: 'audio',
        description: `Earned ${rewardCoins} coins from ${session.audio.title}`,
      });

    if (txError) {
      console.error('Transaction insert error (non-fatal):', txError);
    }

    // ✅ Check if user was referred and claim referral bonus
    const { data: referral, error: referralError } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referred_id', user.id)
      .eq('status', 'qualified')
      .single();

    if (!referralError && referral) {
      // Update referral status
      await supabaseAdmin
        .from('referrals')
        .update({ 
          status: 'rewarded', 
          reward_coins: 50 
        })
        .eq('id', referral.id);

      // Get referrer's wallet
      const { data: referrerWallet, error: referrerWalletError } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', referral.referrer_id)
        .single();

      if (!referrerWalletError && referrerWallet) {
        // Give referrer 50 coins
        await supabaseAdmin
          .from('wallets')
          .update({
            coin_balance: referrerWallet.coin_balance + 50,
            total_earned: referrerWallet.total_earned + 50,
          })
          .eq('id', referrerWallet.id);

        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: referral.referrer_id,
            type: 'earn_referral',
            coins_amount: 50,
            balance_before: referrerWallet.coin_balance,
            balance_after: referrerWallet.coin_balance + 50,
            description: `Referral bonus for ${user.email}`,
          });
      }

      // Give referred user 25 coins welcome bonus
      const { data: updatedWallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (updatedWallet) {
        await supabaseAdmin
          .from('wallets')
          .update({
            coin_balance: updatedWallet.coin_balance + 25,
            total_earned: updatedWallet.total_earned + 25,
          })
          .eq('id', updatedWallet.id);

        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'earn_bonus',
            coins_amount: 25,
            balance_before: updatedWallet.coin_balance,
            balance_after: updatedWallet.coin_balance + 25,
            description: 'Welcome bonus from referral!',
          });
      }
    }

    return NextResponse.json({
      success: true,
      reward: rewardCoins,
      newBalance: newBalance,
    });

  } catch (error: any) {
    console.error('Complete API crash:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}