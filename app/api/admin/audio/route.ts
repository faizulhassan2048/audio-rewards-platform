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

    // ✅ Admin role check
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const rewardCoins = parseFloat(formData.get('rewardCoins') as string || '50');
    const category = formData.get('category') as string || 'Uncategorized';

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${crypto.randomUUID()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('audio-files')
      .upload(fileName, buffer, {
        contentType: file.type || 'audio/mpeg',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    const { data: audio, error: dbError } = await supabaseAdmin
      .from('audios')
      .insert({
        title,
        audio_url: publicUrl,
        duration_seconds: 30,
        reward_coins: rewardCoins,
        category,
        created_by: user.id, // ✅ Real user ID
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, audio });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


