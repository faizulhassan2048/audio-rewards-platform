import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_ACCOUNTS_PER_IP = 3;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fingerprint, userAgent } = await req.json();
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || '0.0.0.0';

    if (!fingerprint) {
      return NextResponse.json({ error: 'Fingerprint required' }, { status: 400 });
    }

    // ✅ 1. CHECK IP ADDRESS
    const { data: ipAccounts, count } = await supabase
      .from('ip_tracking')
      .select('user_id', { count: 'exact' })
      .eq('ip_address', ipAddress)
      .neq('user_id', user.id);

    const totalAccountsFromIP = (count || 0) + 1;

    if (totalAccountsFromIP > MAX_ACCOUNTS_PER_IP) {
      // Block this IP
      await supabase
        .from('ip_tracking')
        .update({ is_blocked: true, blocked_reason: `More than ${MAX_ACCOUNTS_PER_IP} accounts from same IP` })
        .eq('ip_address', ipAddress);

      // Log security event
      await logSecurityEvent(supabase, user.id, 'ip_blocked', {
        ip: ipAddress,
        total_accounts: totalAccountsFromIP,
        max_allowed: MAX_ACCOUNTS_PER_IP,
      });

      // Send admin notification
      await sendAdminNotification(supabase, {
        title: '🚫 IP Blocked',
        message: `IP ${ipAddress} blocked. ${totalAccountsFromIP} accounts detected.`,
        type: 'security',
      });

      return NextResponse.json({
        error: `❌ This IP has been blocked due to multiple accounts.`,
        blocked: true,
        reason: 'ip_blocked',
      }, { status: 403 });
    }

    // ✅ 2. CHECK DUPLICATE FINGERPRINT
    const { data: existing } = await supabase
      .from('device_fingerprints')
      .select('user_id')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existing && existing.user_id !== user.id) {
      await logSecurityEvent(supabase, user.id, 'duplicate_fingerprint', {
        fingerprint,
        existing_user: existing.user_id,
        attempted_user: user.id,
        ip: ipAddress,
      });

      await sendAdminNotification(supabase, {
        title: '🔐 Duplicate Device Detected',
        message: `User ${user.id} tried to register with device already used by ${existing.user_id}`,
        type: 'security',
      });

      return NextResponse.json({
        error: '❌ This device is already linked to another account!',
        blocked: true,
        reason: 'duplicate_device',
      }, { status: 403 });
    }

    // ✅ 3. CHECK VPN/PROXY (Optional)
    const vpnCheck = await checkVPN(ipAddress);
    if (vpnCheck.isVPN) {
      await logSecurityEvent(supabase, user.id, 'vpn_detected', {
        ip: ipAddress,
        vpn_details: vpnCheck.details,
      });

      await sendAdminNotification(supabase, {
        title: '🛡️ VPN Detected',
        message: `User ${user.id} is using VPN from IP ${ipAddress}`,
        type: 'security',
      });

      return NextResponse.json({
        error: '❌ VPN/Proxy detected. Please disable and try again.',
        blocked: true,
        reason: 'vpn_detected',
      }, { status: 403 });
    }

    // ✅ 4. SAVE IP TRACKING
    await supabase
      .from('ip_tracking')
      .insert({
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent || 'unknown',
      });

    // ✅ 5. SAVE/UPDATE FINGERPRINT
    const { data, error } = await supabase
      .from('device_fingerprints')
      .upsert({
        user_id: user.id,
        fingerprint,
        user_agent: userAgent || 'unknown',
        ip_address: ipAddress,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'fingerprint' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      device: data,
      message: 'Device registered successfully',
    });

  } catch (error: any) {
    console.error('Security error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ Helper Functions
async function logSecurityEvent(supabase: any, userId: string, type: string, details: any) {
  await supabase
    .from('security_logs')
    .insert({
      user_id: userId,
      type: type,
      details: details,
    });
}

async function sendAdminNotification(supabase: any, data: any) {
  await supabase
    .from('admin_notifications')
    .insert({
      title: data.title,
      message: data.message,
      type: data.type,
      is_read: false,
    });
}

async function checkVPN(ip: string): Promise<{ isVPN: boolean; details: any }> {
  try {
    // Use free IP API for VPN detection
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,proxy,hosting`);
    const data = await res.json();
    
    return {
      isVPN: data.proxy === true || data.hosting === true,
      details: data,
    };
  } catch {
    return { isVPN: false, details: null };
  }
}