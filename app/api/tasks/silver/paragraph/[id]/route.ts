import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const paragraphId = params.id;

    const { data: paragraph, error } = await supabase
      .from('silver_paragraphs')
      .select('id, paragraph_number, content, missing_word')
      .eq('id', paragraphId)
      .single();

    if (error || !paragraph) {
      return NextResponse.json({ error: 'Paragraph not found' }, { status: 404 });
    }

    return NextResponse.json(paragraph);
  } catch (error) {
    console.error('Error fetching paragraph:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}