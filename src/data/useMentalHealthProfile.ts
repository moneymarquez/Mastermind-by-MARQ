import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TOTAL_PROFILE_QUESTIONS } from './mentalHealthQuestions';

interface ProfileRow {
  answers: Record<string, string>;
  completed_at: string | null;
}

export function useMentalHealthProfile() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('mental_health_profile').select('answers, completed_at').maybeSingle();
    const row = data as ProfileRow | null;
    setAnswers(row?.answers ?? {});
    setCompletedAt(row?.completed_at ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const answeredCount = Object.values(answers).filter((v) => v && v.trim()).length;
  const isComplete = answeredCount >= TOTAL_PROFILE_QUESTIONS;

  // Saved incrementally (per category, or per field on blur) rather than
  // only at the end — a 50-question intake is realistically filled across
  // more than one sitting.
  const saveAnswers = async (patch: Record<string, string>) => {
    const next = { ...answers, ...patch };
    setAnswers(next);
    const nextComplete = Object.values(next).filter((v) => v && v.trim()).length >= TOTAL_PROFILE_QUESTIONS;
    await supabase.from('mental_health_profile').upsert(
      { answers: next, completed_at: nextComplete ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (nextComplete) setCompletedAt(new Date().toISOString());
  };

  return { answers, completedAt, loading, answeredCount, isComplete, saveAnswers };
}
