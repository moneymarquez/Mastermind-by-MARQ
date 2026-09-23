import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Answers, Checkin, Disc, Scores } from './brain';
import { ASSESSMENT_VERSION, TYPE_NAME, scoreAnswers, types } from './brain';

export interface Assessment {
  id: string;
  version: number;
  answers: Answers;
  scores: Scores;
  primary_type: Disc;
  secondary_type: Disc;
  created_at: string;
}

const DRAFT_KEY = 'mm:brain-draft';

export function readDraft(): Answers {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as Answers; } catch { return {}; }
}
export function writeDraft(a: Answers): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(a)); } catch { /* private mode */ }
}
export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
}

/** Latest assessment + every check-in. Raw answers are what's stored;
 *  scores are recomputed on save so a revised scorer can re-score old
 *  rows without anyone retaking anything. */
export function useBrain() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([
      supabase.from('brain_assessments').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('brain_checkins').select('date, score, note, hour_happened, dials').order('date', { ascending: false }).limit(400),
    ]);
    if (a.error) setError(a.error.message);
    setAssessment((a.data as Assessment | null) ?? null);
    setCheckins((c.data ?? []) as Checkin[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAssessment = async (answers: Answers): Promise<Assessment | null> => {
    const scores = scoreAnswers(answers);
    const t = types(scores);
    const { data, error: err } = await supabase
      .from('brain_assessments')
      .insert({ version: ASSESSMENT_VERSION, answers, scores, primary_type: t.primary, secondary_type: t.secondary })
      .select('*')
      .single();
    if (err) { setError(err.message); return null; }
    // Nova reads this table directly, but a one-line fact keeps it in the
    // long-term memory too — the assessment is how Nova starts learning.
    await supabase.from('nova_memory').insert({ fact: `Brain assessment: primary type ${TYPE_NAME[t.primary]} (${t.primary}), secondary ${TYPE_NAME[t.secondary]} (${t.secondary}). Follow-through read ${scores.CON}/2, steadiness under pressure ${scores.STAB}/2.` }).then(() => undefined, () => undefined);
    clearDraft();
    await load();
    return data as Assessment;
  };

  const saveCheckin = async (input: { date: string; score: number; note: string | null; hour_happened: boolean; dials: number }) => {
    const { error: err } = await supabase.from('brain_checkins').upsert(input, { onConflict: 'user_id,date' });
    if (err) setError(err.message);
    await load();
  };

  return { assessment, checkins, loading, error, reload: load, saveAssessment, saveCheckin };
}

/** Just "has this account taken the assessment" — for the home-screen
 *  nudge, without pulling the whole tab's data onto the Overview. */
export function useHasAssessment(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    supabase.from('brain_assessments').select('id').limit(1).then(({ data }) => { if (live) setHas((data?.length ?? 0) > 0); });
    return () => { live = false; };
  }, []);
  return has;
}
