import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
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

    // ✅ Reuse an existing, not-yet-completed session for this user+audio
    // instead of always inserting a new one. Without this, every page
    // refresh resets created_at, which resets the real-playback timer that
    // /api/tasks/level/complete relies on — causing the "audio restarts /
    // won't verify" bug.
    const { data: existingSession } = await supabaseAdmin
      .from('audio_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('audio_id', audioId)
      .eq('status', 'started')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let session = existingSession;

    if (!session) {
      const sessionToken = crypto.randomUUID();
      const { data: created, error: insertErr } = await supabaseAdmin
        .from('audio_sessions')
        .insert({
          user_id: user.id,
          audio_id: audioId,
          session_token: sessionToken,
          status: 'started',
        })
        .select()
        .single();

      if (insertErr || !created) {
        return NextResponse.json({ error: 'Could not start session' }, { status: 500 });
      }
      session = created;
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        token: session.session_token,
        audio_url: audio.audio_url,
        duration: audio.duration_seconds,
        reward_coins: audio.reward_coins,
        created_at: session.created_at,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}