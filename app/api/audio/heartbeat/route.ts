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

    const { sessionToken, progressPercent, clientTimestamp } = await req.json();

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken required' }, { status: 400 });
    }

    // ✅ Session fetch — user_id bhi check karo
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('audio_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('user_id', user.id) // ✅ Security: apna hi session
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
    }

    // Heartbeat save
    const { error: heartbeatError } = await supabaseAdmin
      .from('audio_heartbeats')
      .insert({
        session_id: session.id,
        progress_percent: progressPercent,
        client_timestamp: clientTimestamp,
      });

    if (heartbeatError) {
      console.error('Heartbeat insert error:', heartbeatError);
    }

    // Session progress update
    const { error: updateError } = await supabaseAdmin
      .from('audio_sessions')
      .update({
        progress_percent: progressPercent,
        heartbeat_count: (session.heartbeat_count || 0) + 1,
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Session update error:', updateError);
    }

    return NextResponse.json({ valid: true });

  } catch (error: any) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

