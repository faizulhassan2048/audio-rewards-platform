import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fingerprint, userAgent } = await req.json();

    if (!fingerprint) {
      return NextResponse.json({ error: 'Fingerprint required' }, { status: 400 });
    }

    // Check if fingerprint already exists
    const { data: existing } = await supabase
      .from('device_fingerprints')
      .select('user_id')
      .eq('fingerprint', fingerprint)
      .single();

    if (existing && existing.user_id !== user.id) {
      return NextResponse.json({
        error: 'This device is already linked to another account',
        blocked: true,
      }, { status: 403 });
    }

    // Save or update fingerprint
    const { data, error } = await supabase
      .from('device_fingerprints')
      .upsert({
        user_id: user.id,
        fingerprint,
        user_agent: userAgent || 'unknown',
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'fingerprint' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, device: data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}