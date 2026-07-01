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

    // ✅ Check if fingerprint already exists
    const { data: existing } = await supabase
      .from('device_fingerprints')
      .select('user_id')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      // ✅ If fingerprint belongs to different user → Block
      if (existing.user_id !== user.id) {
        // Log the attempt
        await supabase
          .from('security_logs')
          .insert({
            user_id: user.id,
            type: 'duplicate_device',
            details: {
              fingerprint,
              existing_user: existing.user_id,
              attempted_user: user.id,
              ip: req.headers.get('x-forwarded-for') || '0.0.0.0',
            },
          });

        return NextResponse.json({
          error: '❌ This device is already linked to another account!',
          blocked: true,
          reason: 'duplicate_device',
        }, { status: 403 });
      }
      
      // ✅ If same user → Update existing record
      const { data, error } = await supabase
        .from('device_fingerprints')
        .update({
          user_agent: userAgent || 'unknown',
          ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
          updated_at: new Date().toISOString(),
        })
        .eq('fingerprint', fingerprint)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        device: data,
        message: 'Device updated successfully',
      });
    }

    // ✅ New fingerprint → Save
    const { data, error } = await supabase
      .from('device_fingerprints')
      .insert({
        user_id: user.id,
        fingerprint,
        user_agent: userAgent || 'unknown',
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
      })
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
    console.error('Device fingerprint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}