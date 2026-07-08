import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all referrals
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user's referral code
    const { data: userData } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    // Calculate stats
    const total = referrals?.length || 0;
    const pending = referrals?.filter(r => r.status === 'pending').length || 0;
    const rewarded = referrals?.filter(r => r.status === 'rewarded').length || 0;
    const qualified = referrals?.filter(r => r.status === 'qualified' || r.status === 'rewarded').length || 0;
    const fraudBanned = referrals?.filter(r => r.status === 'fraud_banned').length || 0;

    // Get coins earned from referrals (transactions)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('coins_amount')
      .eq('user_id', user.id)
      .eq('type', 'referral_reward');

    const coinsEarned = transactions?.reduce((sum, t) => sum + Number(t.coins_amount), 0) || 0;

    // Get milestone bonus transactions
    const { data: milestoneBonuses } = await supabase
      .from('transactions')
      .select('coins_amount')
      .eq('user_id', user.id)
      .eq('type', 'milestone_bonus');

    const milestoneCoins = milestoneBonuses?.reduce((sum, t) => sum + Number(t.coins_amount), 0) || 0;

    // Calculate next milestone
    const nextMilestone = rewarded > 0 ? Math.ceil((rewarded + 1) / 10) * 10 : 10;
    const progressToNextMilestone = rewarded > 0 ? (rewarded / nextMilestone) * 100 : 0;

    // Get history with user details
    const history = await Promise.all(
      (referrals?.slice(0, 10) || []).map(async (ref) => {
        const { data: referredUser } = await supabase
          .from('users')
          .select('email, full_name, username')
          .eq('id', ref.referred_id)
          .single();
        
        return {
          id: ref.id,
          referred_user: referredUser?.full_name || referredUser?.username || referredUser?.email || 'Anonymous',
          status: ref.status,
          reward_coins: ref.status === 'rewarded' ? 30 : 0,
          created_at: ref.created_at,
          fraud_reason: ref.fraud_reason || null,
        };
      })
    );

    return NextResponse.json({
      referral_code: userData?.referral_code || null,
      stats: {
        total,
        pending,
        qualified,
        rewarded,
        fraud_banned: fraudBanned,
        coins_earned: coinsEarned,
        milestone_coins: milestoneCoins,
        total_earned: coinsEarned + milestoneCoins,
      },
      milestones: {
        next_milestone: nextMilestone,
        progress_percentage: Math.min(progressToNextMilestone, 100),
        referrals_needed: Math.max(0, nextMilestone - rewarded),
      },
      history,
      raw_referrals: referrals || [],
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { referred_id } = body;

    if (!referred_id) {
      return NextResponse.json({ error: 'referred_id required' }, { status: 400 });
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', referred_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'User already referred' }, { status: 409 });
    }

    // Create referral with pending status
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: user.id,
        referred_id: referred_id,
        status: 'pending',
        fraud_checked: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      referral,
      message: 'Referral created! User needs to complete 7 days of tasks.',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}