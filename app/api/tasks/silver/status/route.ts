import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LEVEL_NAME = 'silver';
const TOTAL_PARAGRAPHS = 15;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user level
    let { data: level } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .eq('level_name', LEVEL_NAME)
      .maybeSingle();

    if (!level) {
      // Get paragraphs
      const { data: paragraphs } = await supabase
        .from('silver_paragraphs')
        .select('id')
        .order('paragraph_number', { ascending: true });

      if (!paragraphs || paragraphs.length === 0) {
        return NextResponse.json({
          locked: false,
          level_complete: false,
          completed_paragraphs: 0,
          total_paragraphs: TOTAL_PARAGRAPHS,
          current_paragraph: null,
        });
      }

      const { data: created, error } = await supabase
        .from('user_levels')
        .insert({
          user_id: user.id,
          level_name: LEVEL_NAME,
          total_audios: paragraphs.length,
          audio_ids: paragraphs.map(p => p.id),
          silver_completed_paragraphs: 0,
          silver_completed_paragraph_ids: [],
          silver_reward_claimed: false,
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      level = created;
    }

    // Check if complete
    const isComplete = (level.silver_completed_paragraphs || 0) >= TOTAL_PARAGRAPHS;

    if (isComplete && level.silver_reward_claimed) {
      return NextResponse.json({
        locked: false,
        level_complete: true,
        reward_claimed: true,
        completed_paragraphs: level.silver_completed_paragraphs || 0,
        total_paragraphs: TOTAL_PARAGRAPHS,
        current_paragraph: null,
      });
    }

    if (isComplete) {
      return NextResponse.json({
        locked: false,
        level_complete: true,
        reward_claimed: false,
        completed_paragraphs: level.silver_completed_paragraphs || 0,
        total_paragraphs: TOTAL_PARAGRAPHS,
        current_paragraph: null,
      });
    }

    // Get current paragraph
    const completedIds = level.silver_completed_paragraph_ids || [];
    let nextParagraphId = null;

    const { data: paragraphs } = await supabase
      .from('silver_paragraphs')
      .select('id, paragraph_number, content, missing_word')
      .order('paragraph_number', { ascending: true });

    if (paragraphs) {
      for (const p of paragraphs) {
        if (!completedIds.includes(p.id)) {
          nextParagraphId = p.id;
          break;
        }
      }
    }

    let currentParagraph = null;
    if (nextParagraphId) {
      const { data: p } = await supabase
        .from('silver_paragraphs')
        .select('id, paragraph_number, content, missing_word')
        .eq('id', nextParagraphId)
        .single();
      currentParagraph = p;
    }

    return NextResponse.json({
      locked: false,
      level_complete: false,
      completed_paragraphs: level.silver_completed_paragraphs || 0,
      total_paragraphs: TOTAL_PARAGRAPHS,
      current_paragraph: currentParagraph,
    });
  } catch (error) {
    console.error('Silver status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}