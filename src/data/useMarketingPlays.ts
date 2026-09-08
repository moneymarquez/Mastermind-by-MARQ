import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PlayCategory, EffortLevel, PlayDraft } from './marketingPlaysEngine';

export type PlayStatus = 'offered' | 'parked' | 'active' | 'won' | 'killed';

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
  primary_metric: string | null;
  kill_threshold: string | null;
  checkpoint_date: string | null;
  expected_result: string | null;
  created_at: string;
  updated_at: string;
}

export type MarketingPlayPatch = Partial<Omit<MarketingPlay, 'id' | 'client_id' | 'brief_id' | 'created_at' | 'updated_at'>>;

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

  /** Writes a freshly generated slate for a brief that has none yet.
   *  Refuses if plays already exist — regenerating over a slate the
   *  operator has already picked from would silently discard that
   *  choice; deleting and starting over is a deliberate separate action,
   *  not a side effect of clicking the same button twice. */
  const saveSlate = async (clientId: string, briefIdArg: string, drafts: PlayDraft[]) => {
    if (plays.length > 0) return;
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

  const updatePlay = async (id: string, patch: MarketingPlayPatch) => {
    const { error: err } = await supabase
      .from('marketing_plays')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  /** "Operator picks one; unpicked plays stay parked as alternates" — the
   *  core inversion the whole rebuild is built around. Also how a pick
   *  gets swapped later (park the current active, activate the new
   *  pick) — never touches 'won' or 'killed' rows, so closed history
   *  stays intact either way. */
  const pickPlay = async (id: string) => {
    const others = plays.filter((p) => p.id !== id && (p.status === 'offered' || p.status === 'active')).map((p) => p.id);
    const { error: err1 } = await supabase.from('marketing_plays').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', id);
    const { error: err2 } = others.length > 0
      ? await supabase.from('marketing_plays').update({ status: 'parked', updated_at: new Date().toISOString() }).in('id', others)
      : { error: null };
    if (err1) setError(err1.message);
    else if (err2) setError(err2.message);
    else setError('');
    await load();
  };

  const removePlay = async (id: string) => {
    const { error: err } = await supabase.from('marketing_plays').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { plays, loading, error, reload: load, saveSlate, updatePlay, pickPlay, removePlay };
}
