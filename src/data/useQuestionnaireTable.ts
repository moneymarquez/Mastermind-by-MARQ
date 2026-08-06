import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { QuestionnaireStatus } from './types';

interface QuestionnaireRow {
  id: string;
  status: QuestionnaireStatus;
  answers: Record<string, string>;
  created_at: string;
  updated_at: string;
}

/** Shared read/write logic for the two guided-questionnaire modules
 *  (Scaling Planner, Business Audits) — same shape, different table
 *  and different generated-text column. */
export function useQuestionnaireTable<T extends QuestionnaireRow>(table: string, textField: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  const active = rows.find((r) => r.id === activeId) ?? null;

  const start = async () => {
    const { data } = await supabase.from(table).insert({ answers: {} }).select().single();
    await load();
    if (data) setActiveId((data as T).id);
  };

  const saveAnswer = async (id: string, key: string, value: string) => {
    const row = rows.find((r) => r.id === id);
    const answers = { ...(row?.answers ?? {}), [key]: value };
    await supabase.from(table).update({ answers, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const complete = async (id: string, generatedText: string) => {
    await supabase
      .from(table)
      .update({ status: 'complete', [textField]: generatedText, updated_at: new Date().toISOString() })
      .eq('id', id);
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from(table).delete().eq('id', id);
    if (activeId === id) setActiveId(null);
    await load();
  };

  return { rows, loading, active, activeId, setActiveId, start, saveAnswer, complete, remove };
}
