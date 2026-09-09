import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type DeliverableStatus = 'open' | 'done' | 'overdue';

export interface PlayDeliverable {
  id: string;
  client_id: string;
  play_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: DeliverableStatus;
  created_at: string;
  updated_at: string;
}

/** True for an open deliverable whose due date has passed. Computed at
 *  read time rather than requiring something to actually write
 *  status='overdue' — there's no background job anywhere in this app
 *  that could keep a persisted status in sync with today's date, and a
 *  stale "overdue" written days ago would be worse than none at all. */
export function isOverdue(d: Pick<PlayDeliverable, 'status' | 'due_date'>): boolean {
  if (d.status !== 'open' || !d.due_date) return false;
  return d.due_date < new Date().toISOString().slice(0, 10);
}

/** Loads every deliverable across every client — "top-right count," the
 *  badge is account-wide by design; the expanded view groups by client,
 *  it doesn't scope the count. Same per-account isolation as every
 *  other play/marketing table in this rebuild. */
export function usePlayDeliverables() {
  const [deliverables, setDeliverables] = useState<PlayDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('play_deliverables')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (err) setError(err.message);
    else setError('');
    setDeliverables((data ?? []) as PlayDeliverable[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addDeliverable = async (clientId: string, playId: string, title: string, description: string, dueDate: string | null) => {
    const { error: err } = await supabase.from('play_deliverables').insert({
      client_id: clientId,
      play_id: playId,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate,
    });
    if (err) setError(err.message);
    await load();
  };

  const markDone = async (id: string) => {
    const { error: err } = await supabase.from('play_deliverables').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  const removeDeliverable = async (id: string) => {
    const { error: err } = await supabase.from('play_deliverables').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { deliverables, loading, error, reload: load, addDeliverable, markDone, removeDeliverable };
}
