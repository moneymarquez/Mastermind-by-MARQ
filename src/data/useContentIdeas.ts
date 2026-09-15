import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ContentIdeaDraft } from './contentIdeaEngine';

export type ContentIdeaStatus = 'offered' | 'parked' | 'picked' | 'published';

export interface ContentIdea {
  id: string;
  client_id: string;
  plan_id: string;
  title: string;
  pillar: string | null;
  format: string | null;
  hook_line: string;
  hook_variants: string[] | null;
  rationale: string;
  status: ContentIdeaStatus;
  script: string | null;
  shot_list: string | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentIdeaPatch = Partial<Omit<ContentIdea, 'id' | 'client_id' | 'plan_id' | 'created_at' | 'updated_at'>>;

// Same per-account isolation as every other content/marketing table in
// this rebuild — no client-side owner check needed.
export function useContentIdeas(planId: string | null) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!planId) {
      setIdeas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('content_ideas')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });
    if (err) setError(err.message);
    else setError('');
    setIdeas((data ?? []) as ContentIdea[]);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Writes a freshly generated round of ideas — always appends, never
   *  guarded to "only once" the way Marketing's channel-slate saveSlate
   *  is. A content slate is meant to regenerate on a weekly cadence
   *  ("the answers reshape next week's slate," build order item 6); a
   *  one-time guard would block that entirely. Existing offered/parked/
   *  picked/published ideas are untouched either way — this only ever
   *  inserts new rows. */
  const saveSlate = async (clientId: string, planIdArg: string, drafts: ContentIdeaDraft[]) => {
    const rows = drafts.map((d) => ({
      client_id: clientId,
      plan_id: planIdArg,
      title: d.title,
      pillar: d.pillar,
      format: d.format,
      hook_line: d.hook_line,
      rationale: d.rationale,
    }));
    const { error: err } = await supabase.from('content_ideas').insert(rows);
    if (err) setError(err.message);
    await load();
  };

  const updateIdea = async (id: string, patch: ContentIdeaPatch) => {
    const { error: err } = await supabase
      .from('content_ideas')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  /** "Operator picks. Unpicked ideas park and can be pulled later —
   *  same as marketing plays." Only ever touches rows still 'offered' or
   *  'picked' (never re-parks something already 'published'). */
  const pickIdea = async (id: string) => {
    const others = ideas.filter((i) => i.id !== id && (i.status === 'offered' || i.status === 'picked')).map((i) => i.id);
    const { error: err1 } = await supabase.from('content_ideas').update({ status: 'picked', updated_at: new Date().toISOString() }).eq('id', id);
    const { error: err2 } = others.length > 0
      ? await supabase.from('content_ideas').update({ status: 'parked', updated_at: new Date().toISOString() }).in('id', others)
      : { error: null };
    if (err1) setError(err1.message);
    else if (err2) setError(err2.message);
    else setError('');
    await load();
  };

  const removeIdea = async (id: string) => {
    const { error: err } = await supabase.from('content_ideas').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { ideas, loading, error, reload: load, saveSlate, updateIdea, pickIdea, removeIdea };
}
