import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { BenderSession, JournalEntry } from './types';

// Global — the Bender button lives in Stage.tsx, not the Sobriety screen,
// so this hook is called once at that level and passed down, rather than
// each screen fetching its own copy of "is a bender currently active."
export function useBender() {
  const [sessions, setSessions] = useState<BenderSession[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sessionsRes, journalRes] = await Promise.all([
      supabase.from('bender_sessions').select('*').order('started_at', { ascending: false }).limit(30),
      supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    ]);
    setSessions(sessionsRes.data ?? []);
    setJournal(journalRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeBender = sessions.find((s) => !s.ended_at) ?? null;

  const startBender = async (b: { expected_days: number | null; description: string | null; traveling: boolean }) => {
    const { data } = await supabase.from('bender_sessions').insert(b).select().single();
    if (data) {
      const parts = [
        b.expected_days ? `expected ~${b.expected_days} day${b.expected_days === 1 ? '' : 's'}` : null,
        b.traveling ? 'traveling' : null,
        b.description || null,
      ].filter(Boolean);
      await supabase.from('journal_entries').insert({
        entry_date: todayStr(),
        entry_text: `Bender started${parts.length ? ' — ' + parts.join(', ') : ''}.`,
        source_bender_id: data.id,
      });
    }
    await load();
  };

  const endBender = async () => {
    if (!activeBender) return;
    await supabase.from('bender_sessions').update({ ended_at: new Date().toISOString() }).eq('id', activeBender.id);
    await supabase.from('journal_entries').insert({
      entry_date: todayStr(),
      entry_text: 'Bender ended.',
      source_bender_id: activeBender.id,
    });
    await load();
  };

  const addJournalEntry = async (text: string) => {
    await supabase.from('journal_entries').insert({ entry_date: todayStr(), entry_text: text });
    await load();
  };

  return { sessions, journal, activeBender, loading, startBender, endBender, addJournalEntry };
}
