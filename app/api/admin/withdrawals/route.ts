import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — all withdrawals with filters
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('withdrawals')
      .select(`
        *,
        user:users(id, username, full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ 
      withdrawals: data || [], 
      total: count || 0, 
      page 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — approve/reject/process/paid
export async function PATCH(req: Request) {
  try {
    const { withdrawal_id, action, admin_note, payment_reference, admin_id } = await req.json();

    if (!withdrawal_id || !action || !admin_id) {
      return NextResponse.json({ 
        error: 'withdrawal_id, action, admin_id required' 
      }, { status: 400 });
    }

    // Get withdrawal with user details
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('*, user:users(id, email, full_name, username)')
      .eq('id', withdrawal_id)
      .single();

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const validActions = ['approved', 'rejected', 'processing', 'paid'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check if already processed
    if (withdrawal.status !== 'pending' && action !== 'paid') {
      return NextResponse.json({ 
        error: 'Withdrawal already processed' 
      }, { status: 400 });
    }

    // Update withdrawal status
    const { error: updateError } = await supabaseAdmin
      .from('withdrawals')
      .update({
        status: action,
        admin_note: admin_note || null,
        payment_reference: payment_reference || null,
        processed_by: admin_id,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Get wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', withdrawal.user_id)
      .single();

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Handle different actions
    if (action === 'rejected') {
      // Restore coins to balance
      await supabaseAdmin
        .from('wallets')
        .update({
          coin_balance: Number(wallet.coin_balance) + Number(withdrawal.amount_coins),
          pending_withdrawal: Math.max(0, Number(wallet.pending_withdrawal) - Number(withdrawal.amount_coins)),
        })
        .eq('user_id', withdrawal.user_id);

      // Refund transaction
      await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: withdrawal.user_id,
          type: 'admin_add',
          coins_amount: withdrawal.amount_coins,
          balance_before: Number(wallet.coin_balance),
          balance_after: Number(wallet.coin_balance) + Number(withdrawal.amount_coins),
          reference_id: withdrawal_id,
          reference_type: 'withdrawal_refund',
          description: `Withdrawal rejected — ${withdrawal.amount_coins} coins restored. Note: ${admin_note || 'No reason provided'}`,
        });
    }

    if (action === 'paid') {
      // Remove from pending, add to total_withdrawn
      await supabaseAdmin
        .from('wallets')
        .update({
          pending_withdrawal: Math.max(0, Number(wallet.pending_withdrawal) - Number(withdrawal.amount_coins)),
          total_withdrawn: Number(wallet.total_withdrawn || 0) + Number(withdrawal.amount_coins),
        })
        .eq('user_id', withdrawal.user_id);

      // Update transaction
      await supabaseAdmin
        .from('transactions')
        .update({
          description: `Withdrawal paid: ${withdrawal.amount_coins} coins via ${withdrawal.method}`,
        })
        .eq('reference_id', withdrawal_id);
    }

    if (action === 'approved' || action === 'processing') {
      // Just update status, no wallet changes
      await supabaseAdmin
        .from('transactions')
        .update({
          description: `Withdrawal ${action}: ${withdrawal.amount_coins} coins via ${withdrawal.method}`,
        })
        .eq('reference_id', withdrawal_id);
    }

    // ✅ Send Email Notification with HTML Template
    try {
      const userEmail = withdrawal.user?.email;
      const userName = withdrawal.user?.full_name || withdrawal.user?.username || 'User';

      if (userEmail) {
        const emailTemplates = {
          approved: {
            subject: '✅ Withdrawal Approved',
            color: '#10B981',
            badge: 'Approved',
            badgeColor: '#D1FAE5',
            badgeText: '#065F46',
            message: 'Your withdrawal request has been approved and is now being processed.',
          },
          rejected: {
            subject: '❌ Withdrawal Rejected',
            color: '#EF4444',
            badge: 'Rejected',
            badgeColor: '#FEE2E2',
            badgeText: '#991B1B',
            message: `Your withdrawal request has been rejected. ${admin_note ? `Reason: ${admin_note}` : 'Please contact support.'}`,
          },
          paid: {
            subject: '💰 Payment Sent!',
            color: '#6C63FF',
            badge: 'Paid',
            badgeColor: '#EDE9FE',
            badgeText: '#5B21B6',
            message: `Your payment of PKR ${withdrawal.amount_pkr} has been sent to your account.`,
          },
          processing: {
            subject: '⏳ Withdrawal Processing',
            color: '#3B82F6',
            badge: 'Processing',
            badgeColor: '#DBEAFE',
            badgeText: '#1E40AF',
            message: 'Your withdrawal is being processed. Payment will be sent shortly.',
          },
        };

        const template = emailTemplates[action as keyof typeof emailTemplates];

        if (template) {
          const statusBadge = template.badge;
          const statusColor = template.badgeColor;
          const statusTextColor = template.badgeText;

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `YouTask <${process.env.FROM_EMAIL || 'noreply@youtask.com'}>`,
              to: userEmail,
              subject: template.subject,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#f8f9fa;border-radius:12px">
                  <!-- Header -->
                  <div style="background:${template.color};padding:20px;border-radius:12px 12px 0 0;text-align:center;color:white">
                    <h1 style="margin:0;font-size:24px">${template.subject}</h1>
                  </div>
                  
                  <!-- Body -->
                  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
                    <p style="font-size:16px;color:#1f2937">Hi ${userName},</p>
                    <p style="font-size:16px;color:#4b5563">${template.message}</p>
                    
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
                      <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #f3f4f6">Amount</td><td style="padding:8px;font-weight:bold;border-bottom:1px solid #f3f4f6">${withdrawal.amount_coins} coins (PKR ${withdrawal.amount_pkr})</td></tr>
                      <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #f3f4f6">Method</td><td style="padding:8px;font-weight:bold;border-bottom:1px solid #f3f4f6">${withdrawal.method.toUpperCase()}</td></tr>
                      <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #f3f4f6">Account</td><td style="padding:8px;font-weight:bold;border-bottom:1px solid #f3f4f6">${withdrawal.account_number}</td></tr>
                      <tr><td style="padding:8px;color:#6b7280">Status</td><td style="padding:8px"><span style="background:${statusColor};color:${statusTextColor};padding:2px 10px;border-radius:4px;font-weight:bold">${statusBadge}</span></td></tr>
                      ${payment_reference ? `<tr><td style="padding:8px;color:#6b7280;border-top:1px solid #f3f4f6">Reference</td><td style="padding:8px;font-weight:bold;border-top:1px solid #f3f4f6">${payment_reference}</td></tr>` : ''}
                      ${admin_note ? `<tr><td style="padding:8px;color:#6b7280;border-top:1px solid #f3f4f6">Admin Note</td><td style="padding:8px;border-top:1px solid #f3f4f6">${admin_note}</td></tr>` : ''}
                    </table>
                    
                    ${action === 'rejected' && withdrawal.amount_coins ? `<p style="background:#EDE9FE;padding:12px;border-radius:8px;color:#6C63FF;font-size:14px">✅ ${withdrawal.amount_coins} coins have been restored to your wallet.</p>` : ''}
                    ${action === 'paid' ? `<p style="background:#D1FAE5;padding:12px;border-radius:8px;color:#065F46;font-size:14px">✅ Payment has been sent to your account.</p>` : ''}
                    
                    <hr style="border:1px solid #f3f4f6;margin:16px 0">
                    <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
                  </div>
                </div>
              `,
            }),
          });
        }
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr);
      // Don't fail the request if email fails
    }

    return NextResponse.json({ 
      success: true, 
      action,
      message: `Withdrawal ${action} successfully` 
    });

  } catch (error: any) {
    console.error('Admin withdrawal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}