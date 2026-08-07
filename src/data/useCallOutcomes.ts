import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { CallOutcome, CallOutcomeType, Contact } from './types';
import { FINAL_OUTCOMES } from './types';

export const DAILY_CALL_GOAL = 100;

function nextBusinessDay(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface HistoryDay {
  date: string;
  total: number;
  breakdown: Partial<Record<CallOutcomeType, number>>;
}

/** Drives the Dialing screen's "Today's Calls" queue: which Dialing
 *  contacts are still workable today, which were already handled, the live
 *  counter, and the day-by-day history log. Takes the already-loaded
 *  Dialing-type contacts in (from useContacts) rather than reloading them
 *  itself. */
export function useCallOutcomes(dialingContacts: Contact[]) {
  const [outcomes, setOutcomes] = useState<CallOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayStr();

  const load = useCallback(async () => {
    const { data } = await supabase.from('call_outcomes').select('*').order('logged_at', { ascending: false }).limit(3000);
    setOutcomes((data ?? []) as CallOutcome[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latestByContact = new Map<string, CallOutcome>();
  for (const o of outcomes) {
    const prev = latestByContact.get(o.contact_id);
    if (!prev || o.logged_at > prev.logged_at) latestByContact.set(o.contact_id, o);
  }

  // Workable today = never called, OR their latest outcome isn't final
  // (not_qualified/dnc_remove), wasn't already logged today, and — for
  // call_back_later specifically — its callback date has arrived.
  const activeQueue = dialingContacts.filter((c) => {
    const latest = latestByContact.get(c.id);
    if (!latest) return true;
    if (FINAL_OUTCOMES.includes(latest.outcome)) return false;
    if (latest.call_date === today) return false;
    if (latest.outcome === 'call_back_later' && latest.callback_date && latest.callback_date > today) return false;
    return true;
  });

  const completedToday = outcomes
    .filter((o) => o.call_date === today)
    .map((o) => ({ outcome: o, contact: dialingContacts.find((c) => c.id === o.contact_id) ?? null }))
    .sort((a, b) => b.outcome.logged_at.localeCompare(a.outcome.logged_at));

  const todayCount = outcomes.filter((o) => o.call_date === today).length;

  const logOutcome = async (contactId: string, outcome: CallOutcomeType, explicitCallbackDate?: string | null) => {
    const callback_date = outcome === 'call_back_later' ? explicitCallbackDate || nextBusinessDay(new Date()) : null;
    await supabase.from('call_outcomes').insert({ contact_id: contactId, outcome, call_date: today, callback_date });
    await load();
  };

  const undoOutcome = async (id: string) => {
    await supabase.from('call_outcomes').delete().eq('id', id);
    await load();
  };

  const history: HistoryDay[] = (() => {
    const byDate = new Map<string, CallOutcome[]>();
    for (const o of outcomes) {
      const list = byDate.get(o.call_date) ?? [];
      list.push(o);
      byDate.set(o.call_date, list);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({
        date,
        total: list.length,
        breakdown: list.reduce<Partial<Record<CallOutcomeType, number>>>((acc, o) => {
          acc[o.outcome] = (acc[o.outcome] ?? 0) + 1;
          return acc;
        }, {}),
      }));
  })();

  return { loading, activeQueue, completedToday, todayCount, logOutcome, undoOutcome, history };
}
