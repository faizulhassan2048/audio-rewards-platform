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

    const { audioId } = await req.json();

    if (!audioId) {
      return NextResponse.json({ error: 'audioId required' }, { status: 400 });
    }

    const { data: audio } = await supabaseAdmin
      .from('audios')
      .select('*')
      .eq('id', audioId)
      .single();

    if (!audio) {
      return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
    }

    const sessionToken = crypto.randomUUID();
    const { data: session } = await supabaseAdmin
      .from('audio_sessions')
      .insert({
        user_id: user.id, // ✅ Real user ID
        audio_id: audioId,
        session_token: sessionToken,
        status: 'started',
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        token: session.session_token,
        audio_url: audio.audio_url,
        duration: audio.duration_seconds,
        reward_coins: audio.reward_coins,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
