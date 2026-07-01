import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get referral stats
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user's referral code
    const { data: userData } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      referrals: referrals || [],
      referral_code: userData?.referral_code || null,
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

    // Create referral
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: user.id,
        referred_id: referred_id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      referral,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}