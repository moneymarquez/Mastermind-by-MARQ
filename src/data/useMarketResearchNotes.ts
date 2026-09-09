import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface MarketResearchNote {
  id: string;
  client_id: string;
  source_key: string;
  prompt_shown: string;
  value_entered: string | null;
  interpretation: string | null;
  created_at: string;
}

/** One row per source per client — same per-account isolation as every
 *  other table in this rebuild (RLS already scopes this to the caller's
 *  own rows). Scoped to one client at a time, unlike play_outcomes'
 *  cross-client load, since research is specific to one client's actual
 *  market. */
export function useMarketResearchNotes(clientId: string | null) {
  const [notes, setNotes] = useState<MarketResearchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!clientId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('market_research_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setError('');
    setNotes((data ?? []) as MarketResearchNote[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  /** One note per source per client — replaces any existing note for
   *  that source_key rather than accumulating duplicates every time the
   *  operator re-pastes an updated number. */
  const saveNote = async (sourceKey: string, promptShown: string, valueEntered: string, interpretation: string | null) => {
    if (!clientId) return;
    const existing = notes.find((n) => n.source_key === sourceKey);
    if (existing) {
      const { error: err } = await supabase
        .from('market_research_notes')
        .update({ prompt_shown: promptShown, value_entered: valueEntered, interpretation })
        .eq('id', existing.id);
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase
        .from('market_research_notes')
        .insert({ client_id: clientId, source_key: sourceKey, prompt_shown: promptShown, value_entered: valueEntered, interpretation });
      if (err) setError(err.message);
    }
    await load();
  };

  return { notes, loading, error, reload: load, saveNote };
}
