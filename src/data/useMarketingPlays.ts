import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PlayCategory, EffortLevel, PlayDraft } from './marketingPlaysEngine';

export type PlayStatus = 'offered' | 'parked' | 'active' | 'won' | 'killed' | 'done' | 'skipped';

export interface MarketingPlay {
  id: string;
  client_id: string;
  brief_id: string;
  play_key: string;
  title: string;
  category: PlayCategory;
  rank: number;
  status: PlayStatus;
  rationale: string;
  cost_estimate: string | null;
  speed_to_signal: string | null;
  effort_level: EffortLevel | null;
  honest_risk: string | null;
  /** Why a free-plays checklist item was marked not applicable instead
   *  of done (schema_075) — null for anything that isn't 'skipped'. */
  skip_reason: string | null;
  primary_metric: string | null;
  kill_threshold: string | null;
  checkpoint_date: string | null;
  expected_result: string | null;
  /** Why a checkpoint decision was a kill or a change-one-variable pivot
   *  (schema_077) — "pivot requires a reason_code." Null for a play
   *  that's still running as launched, or one confirmed as a winner
   *  (leaving it alone isn't a pivot, so it needs no reason). */
  checkpoint_reason_code: 'wrong_channel' | 'weak_offer' | 'bad_creative' | 'too_early' | null;
  created_at: string;
  updated_at: string;
}

export type MarketingPlayPatch = Partial<Omit<MarketingPlay, 'id' | 'client_id' | 'brief_id' | 'created_at' | 'updated_at'>>;

/** "Free plays gate paid plays — the paid slate stays locked until free
 *  plays are checked off or explicitly skipped with a reason." Locked
 *  until the checklist even exists (no free rows yet) and until every
 *  free row is resolved one way or the other. */
export function isFreePlaysResolved(plays: MarketingPlay[]): boolean {
  const free = plays.filter((p) => p.category === 'free');
  if (free.length === 0) return false;
  return free.every((p) => p.status === 'done' || (p.status === 'skipped' && !!p.skip_reason));
}

// Same per-account isolation as every other marketing_* table
// (schema_072/074) — no client-side owner check needed, the database
// already scopes every row to auth.uid().
export function useMarketingPlays(briefId: string | null) {
  const [plays, setPlays] = useState<MarketingPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!briefId) {
      setPlays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('marketing_plays')
      .select('*')
      .eq('brief_id', briefId)
      .order('rank', { ascending: true });
    if (err) setError(err.message);
    else setError('');
    setPlays((data ?? []) as MarketingPlay[]);
    setLoading(false);
  }, [briefId]);

  useEffect(() => {
    load();
  }, [load]);

  const insertDrafts = async (clientId: string, briefIdArg: string, drafts: PlayDraft[]) => {
    const rows = drafts.map((d, i) => ({
      client_id: clientId,
      brief_id: briefIdArg,
      play_key: d.play_key,
      title: d.title,
      category: d.category,
      rank: i,
      rationale: d.rationale,
      cost_estimate: d.cost_estimate,
      speed_to_signal: d.speed_to_signal,
      effort_level: d.effort_level,
      honest_risk: d.honest_risk,
    }));
    const { error: err } = await supabase.from('marketing_plays').insert(rows);
    if (err) setError(err.message);
    await load();
  };

  /** Writes a freshly generated channel slate (paid/offline) for a brief
   *  that has none yet. Refuses if paid/offline plays already exist —
   *  regenerating over a slate the operator has already picked from
   *  would silently discard that choice. Independent of the free-plays
   *  checklist below — generating one never blocks the other. */
  const saveSlate = async (clientId: string, briefIdArg: string, drafts: PlayDraft[]) => {
    if (plays.some((p) => p.category === 'paid' || p.category === 'offline')) return;
    await insertDrafts(clientId, briefIdArg, drafts);
  };

  /** Writes the free-plays checklist for a brief that has none yet. Same
   *  no-clobber guard as saveSlate, scoped to category='free'. */
  const saveChecklist = async (clientId: string, briefIdArg: string, drafts: PlayDraft[]) => {
    if (plays.some((p) => p.category === 'free')) return;
    await insertDrafts(clientId, briefIdArg, drafts);
  };

  const updatePlay = async (id: string, patch: MarketingPlayPatch) => {
    const { error: err } = await supabase
      .from('marketing_plays')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  /** "Operator picks one; unpicked plays stay parked as alternates" — the
   *  core inversion the whole rebuild is built around. Scoped to the
   *  picked play's own category (paid vs. offline) so picking a paid
   *  channel never touches the free-plays checklist's rows — those are
   *  resolved with markDone/skipPlay, not picked. Also how a pick gets
   *  swapped later (park the current active, activate the new pick) —
   *  never touches 'won' or 'killed' rows, so closed history stays
   *  intact either way. */
  const pickPlay = async (id: string) => {
    const target = plays.find((p) => p.id === id);
    if (!target) return;
    const others = plays
      .filter((p) => p.id !== id && p.category === target.category && (p.status === 'offered' || p.status === 'active'))
      .map((p) => p.id);
    const { error: err1 } = await supabase.from('marketing_plays').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);
    const { error: err2 } = others.length > 0
      ? await supabase.from('marketing_plays').update({ status: 'parked', updated_at: new Date().toISOString() }).in('id', others)
      : { error: null };
    if (err1) setError(err1.message);
    else if (err2) setError(err2.message);
    else setError('');
    await load();
  };

  /** Checks off a free-plays checklist item. */
  const markDone = async (id: string) => updatePlay(id, { status: 'done' });

  /** Skips a checklist item — always requires a reason, same "always
   *  require a note" pattern as the diagnosis header's leak_note. */
  const skipPlay = async (id: string, reason: string) => {
    if (!reason.trim()) return;
    await updatePlay(id, { status: 'skipped', skip_reason: reason.trim() });
  };

  /** Hand-reordering the checklist — "re-orderable per client." Writes
   *  every row's rank in one pass so the list's order always matches
   *  what's on screen exactly, not just the two rows that moved. */
  const reorderFreePlays = async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, i) => supabase.from('marketing_plays').update({ rank: i, updated_at: new Date().toISOString() }).eq('id', id)));
    await load();
  };

  const removePlay = async (id: string) => {
    const { error: err } = await supabase.from('marketing_plays').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { plays, loading, error, reload: load, saveSlate, saveChecklist, updatePlay, pickPlay, markDone, skipPlay, reorderFreePlays, removePlay };
}
