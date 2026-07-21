import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const audioId = params.id;

    // ✅ Fetch audio from database
    const { data: audio, error } = await supabase
      .from('audios')
      .select('id, title, audio_url, thumbnail_url, duration_seconds')
      .eq('id', audioId)
      .single();

    if (error || !audio) {
      console.error('❌ Audio not found:', audioId);
      return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
    }

    console.log('✅ Audio found:', audio.title);
    return NextResponse.json(audio);
  } catch (error) {
    console.error('Error fetching audio:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}