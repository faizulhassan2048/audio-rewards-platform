import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const COINS_TO_PKR = 0.10;  // 100 coins = 10 PKR
const MIN_COINS = 100;
const MAX_PER_DAY = 3;

// GET — withdrawal history
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ withdrawals: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — submit withdrawal request
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
    const body = await req.json();
    const { user_id, amount_coins, method, account_number, account_name, bank_name } = body;

    // ✅ Rate Limit Check
    const rateLimit = await checkRateLimit(ip, '/api/withdrawal');
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: 'Too many requests. Please try again later.',
        resetTime: rateLimit.resetTime,
      }, { status: 429 });
    }

    // ── Validation ─────────────────────────────────────────────
    if (!user_id || !amount_coins || !method || !account_number || !account_name) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (amount_coins < MIN_COINS) {
      return NextResponse.json({ error: `Minimum withdrawal is ${MIN_COINS} coins` }, { status: 400 });
    }

    if (method === 'bank_transfer' && !bank_name) {
      return NextResponse.json({ error: 'Bank name required for bank transfer' }, { status: 400 });
    }

    // Pakistani phone format for EasyPaisa/JazzCash
    if (['easypaisa', 'jazzcash'].includes(method)) {
      const phoneRegex = /^03[0-9]{9}$/;
      if (!phoneRegex.test(account_number)) {
        return NextResponse.json({ error: 'Invalid Pakistani mobile number (03XXXXXXXXX)' }, { status: 400 });
      }
    }

    // ── Rate limit: max 3 per day ───────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', `${today}T00:00:00`);

    if ((count || 0) >= MAX_PER_DAY) {
      return NextResponse.json({ error: 'Maximum 3 withdrawal requests per day allowed' }, { status: 429 });
    }

    // ── Wallet check ────────────────────────────────────────────
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });

    if (wallet.coin_balance < amount_coins) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // ── Multi-account detection ─────────────────────────────────
    const { data: sameAccount } = await supabaseAdmin
      .from('withdrawals')
      .select('user_id')
      .eq('account_number', account_number)
      .eq('method', method)
      .neq('user_id', user_id)
      .limit(1);

    if (sameAccount && sameAccount.length > 0) {
      console.warn(`Multi-account detected: ${user_id} using same ${method} account`);
    }

    // ── First withdrawal check ──────────────────────────────────
    const { count: prevCount } = await supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id);

    const isFirst = (prevCount || 0) === 0;

    // ── Calculate PKR ───────────────────────────────────────────
    const amount_pkr = amount_coins * COINS_TO_PKR;

    // ── Deduct from wallet ──────────────────────────────────────
    const newBalance = Number(wallet.coin_balance) - amount_coins;
    const newPending = Number(wallet.pending_withdrawal || 0) + amount_coins;

    await supabaseAdmin
      .from('wallets')
      .update({
        coin_balance: newBalance,
        pending_withdrawal: newPending,
      })
      .eq('user_id', user_id);

    // ── Create withdrawal record ────────────────────────────────
    const { data: withdrawal, error: wError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id,
        amount_coins,
        amount_pkr,
        method,
        account_number,
        account_name,
        bank_name: bank_name || null,
        status: 'pending',
        is_first_withdrawal: isFirst,
      })
      .select()
      .single();

    if (wError) {
      // Rollback wallet
      await supabaseAdmin.from('wallets').update({
        coin_balance: wallet.coin_balance,
        pending_withdrawal: wallet.pending_withdrawal,
      }).eq('user_id', user_id);
      throw wError;
    }

    // ── Transaction record ──────────────────────────────────────
    await supabaseAdmin.from('transactions').insert({
      user_id,
      type: 'withdrawal',
      coins_amount: amount_coins,
      balance_before: Number(wallet.coin_balance),
      balance_after: newBalance,
      reference_id: withdrawal.id,
      reference_type: 'withdrawal',
      description: `Withdrawal request via ${method} — ${amount_coins} coins`,
    });

    // ── Send email notification ─────────────────────────────────
    try {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('id', user_id)
        .single();

      if (user?.email) {
        const isFirstText = isFirst 
          ? '<p style="background:#EDE9FE;padding:12px;border-radius:8px;color:#6C63FF;font-size:14px">⚠️ Your first withdrawal will be manually verified within 24-48 hours for security.</p>' 
          : '';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `YouTask <${process.env.FROM_EMAIL || 'noreply@youtask.com'}>`,
            to: user.email,
            subject: '💸 Withdrawal Request Submitted',
            html: `
              <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
                <h2 style="color:#6C63FF">Withdrawal Request Received</h2>
                <p>Hi ${user.full_name || 'User'},</p>
                <p>Your withdrawal request has been submitted successfully.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:8px;color:#666">Amount</td><td style="padding:8px;font-weight:bold">${amount_coins} coins (PKR ${amount_pkr.toFixed(2)})</td></tr>
                  <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Method</td><td style="padding:8px;font-weight:bold">${method.toUpperCase()}</td></tr>
                  <tr><td style="padding:8px;color:#666">Account</td><td style="padding:8px;font-weight:bold">${account_number}</td></tr>
                  <tr style="background:#f9f9f9"><td style="padding:8px;color:#666">Status</td><td style="padding:8px"><span style="background:#FEF3C7;color:#D97706;padding:2px 8px;border-radius:4px">Pending</span></td></tr>
                </table>
                ${isFirstText}
                <p style="color:#666;font-size:14px">You will be notified once your request is processed.</p>
                <hr style="border:1px solid #f3f4f6;margin:16px 0">
                <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
              </div>
            `,
          }),
        });
      }
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      withdrawal_id: withdrawal.id,
      is_first_withdrawal: isFirst,
      new_balance: newBalance,
      message: isFirst
        ? 'Request submitted. First withdrawal verified in 24-48 hours.'
        : 'Withdrawal request submitted successfully.',
    });

  } catch (e: any) {
    console.error('Withdrawal error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}