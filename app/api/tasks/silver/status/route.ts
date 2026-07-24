import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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

    // ✅ AUTO-RESET: If level complete and reward claimed → reset automatically
    const isComplete = (level.silver_completed_paragraphs || 0) >= TOTAL_PARAGRAPHS;
    
    if (isComplete && level.silver_reward_claimed) {
      console.log('🔄 Auto-resetting Silver level for user:', user.id);
      
      // ✅ Get all paragraph IDs
      const { data: allParagraphs } = await supabase
        .from('silver_paragraphs')
        .select('id')
        .order('paragraph_number', { ascending: true });

      const allIds = (allParagraphs || []).map(p => p.id);

      // ✅ Reset the level
      const { data: reset, error: resetErr } = await supabase
        .from('user_levels')
        .update({
          silver_completed_paragraphs: 0,
          silver_completed_paragraph_ids: [],
          silver_reward_claimed: false,
          silver_pending_ad_milestone: null,
          silver_completed_at: null,
          audio_ids: allIds, // Reset audio_ids to all paragraphs
        })
        .eq('id', level.id)
        .select('*')
        .single();

      if (resetErr) {
        console.error('❌ Reset error:', resetErr);
        return NextResponse.json({ error: resetErr.message }, { status: 500 });
      }
      
      level = reset;
    }

    // If level complete but reward NOT claimed yet
    if (isComplete && !level.silver_reward_claimed) {
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