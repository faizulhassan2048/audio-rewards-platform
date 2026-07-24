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
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      console.error('audio/session: auth failed', authErr);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioId } = await req.json();

    if (!audioId) {
      return NextResponse.json({ error: 'audioId required' }, { status: 400 });
    }

    // ✅ Log every incoming request with who/what, so we can see in Vercel
    // logs whether this route is even being hit for a given audioId.
    console.log('audio/session: request', { userId: user.id, audioId });

    const { data: audio, error: audioErr } = await supabaseAdmin
      .from('audios')
      .select('*')
      .eq('id', audioId)
      .single();

    if (audioErr || !audio) {
      // ✅ Log the ACTUAL Supabase error instead of swallowing it — this is
      // what was hiding the real cause (bad UUID, RLS-unrelated DB error,
      // network blip, etc.) behind a generic 404.
      console.error('audio/session: audio lookup failed', { audioId, audioErr });
      return NextResponse.json(
        { error: 'Audio not found', debug: audioErr?.message || null },
        { status: 404 }
      );
    }

    // ✅ Reuse an existing, not-yet-completed session for this user+audio
    // instead of always creating a new one. Without this, every page
    // refresh created a brand new session with a fresh created_at, which
    // reset the real-playback timer in /api/tasks/level/complete back to
    // zero — making the audio look like it "restarted from the beginning".
    const { data: existingSession, error: findErr } = await supabaseAdmin
      .from('audio_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('audio_id', audioId)
      .eq('status', 'started')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error('audio/session: existing-session lookup failed', findErr);
    }

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
        // ✅ This is the log that will actually tell us why — FK violation,
        // NOT NULL violation, unexpected column, etc. all show up here now.
        console.error('audio/session: insert failed', { userId: user.id, audioId, insertErr });
        return NextResponse.json(
          { error: 'Could not start session', debug: insertErr?.message || null },
          { status: 500 }
        );
      }
      session = created;
      console.log('audio/session: created new session', { audioId, sessionId: created.id });
    } else {
      console.log('audio/session: reused existing session', { audioId, sessionId: session.id });
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
    console.error('audio/session: unhandled exception', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}