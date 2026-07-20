import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LEVEL_NAME = 'silver';
const TOTAL_PARAGRAPHS = 15;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paragraph_id, paragraph_number } = await req.json();
    if (!paragraph_id) {
      return NextResponse.json({ error: 'paragraph_id required' }, { status: 400 });
    }

    const { data: level, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .eq('level_name', LEVEL_NAME)
      .single();

    if (error || !level) {
      return NextResponse.json({ error: 'Level not found' }, { status: 404 });
    }

    const completedIds = level.silver_completed_paragraph_ids || [];
    if (completedIds.includes(paragraph_id)) {
      // ✅ Already completed - return next paragraph
      const { data: paragraphs } = await supabase
        .from('silver_paragraphs')
        .select('id, paragraph_number, content, missing_word')
        .order('paragraph_number', { ascending: true });

      let nextParagraph = null;
      if (paragraphs) {
        for (const p of paragraphs) {
          if (!completedIds.includes(p.id)) {
            nextParagraph = p;
            break;
          }
        }
      }

      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        completed_paragraphs: level.silver_completed_paragraphs || 0,
        total_paragraphs: TOTAL_PARAGRAPHS,
        level_complete: (level.silver_completed_paragraphs || 0) >= TOTAL_PARAGRAPHS,
        show_ad: true,
        next_paragraph: nextParagraph,
      });
    }

    const newCompletedCount = (level.silver_completed_paragraphs || 0) + 1;
    const newCompletedIds = [...completedIds, paragraph_id];
    const isLevelComplete = newCompletedCount >= TOTAL_PARAGRAPHS;

    const updatePayload: any = {
      silver_completed_paragraphs: newCompletedCount,
      silver_completed_paragraph_ids: newCompletedIds,
    };

    if (isLevelComplete) {
      updatePayload.silver_completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from('user_levels')
      .update(updatePayload)
      .eq('id', level.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // ✅ Get next paragraph
    let nextParagraph = null;
    if (!isLevelComplete) {
      const { data: paragraphs } = await supabase
        .from('silver_paragraphs')
        .select('id, paragraph_number, content, missing_word')
        .order('paragraph_number', { ascending: true });

      if (paragraphs) {
        for (const p of paragraphs) {
          if (!newCompletedIds.includes(p.id)) {
            nextParagraph = p;
            break;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      completed_paragraphs: newCompletedCount,
      total_paragraphs: TOTAL_PARAGRAPHS,
      show_ad: true, // ✅ Always show Native Banner after EVERY paragraph
      level_complete: isLevelComplete,
      next_paragraph: nextParagraph,
    });
  } catch (error) {
    console.error('Silver complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}