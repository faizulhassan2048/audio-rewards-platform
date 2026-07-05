import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/audio/status?audioId=xxx
// Returns whether the current user is still in cooldown for this
// audio's reward, and when they can claim it again. Mirrors the exact
// same cooldown logic used in /api/audio/complete so the two never
// disagree.
export async function GET(req: NextRequest) {
  const audioId = req.nextUrl.searchParams.get('audioId');
  if (!audioId) {
    return NextResponse.json({ error: 'audioId is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the audio's cooldown setting
  const { data: audio, error: audioError } = await supabaseAdmin
    .from('audios')
    .select('reward_cooldown_days')
    .eq('id', audioId)
    .single();

  if (audioError || !audio) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }

  const cooldownDays = audio.reward_cooldown_days || 1;

  // Find the most recent rewarded session for this user + audio
  const { data: lastClaim, error: claimError } = await supabaseAdmin
    .from('audio_sessions')
    .select('created_at')
    .eq('user_id', user.id)
    .eq('audio_id', audioId)
    .eq('reward_granted', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  if (!lastClaim) {
    return NextResponse.json({ claimed: false });
  }

  const nextAvailable = new Date(lastClaim.created_at);
  nextAvailable.setDate(nextAvailable.getDate() + cooldownDays);

  const stillInCooldown = nextAvailable > new Date();

  return NextResponse.json({
    // "claimed" = cannot claim right now. Once cooldown passes,
    // the front-end should treat it as claimable again.
    claimed: stillInCooldown,
    next_available: stillInCooldown ? nextAvailable.toISOString() : null,
    cooldown_days: cooldownDays,
  });
}