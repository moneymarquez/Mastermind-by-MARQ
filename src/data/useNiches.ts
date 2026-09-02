import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BenchmarkSite, Niche } from './types';

export type NicheDraft = Omit<Niche, 'id' | 'created_at' | 'updated_at' | 'active' | 'sort_order'> & { active?: boolean; sort_order?: number };

/** Brand Lab Factory's niche presets (schema_050_niches.sql). Owner-only.
 *  Every field is editable in-app; benchmark sites get their own dedicated
 *  add/remove path because that's the one that gets touched on the go —
 *  "found a good site, paste it, one-line note, done." */
export function useNiches() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('niches').select('*').order('sort_order').order('name');
    setNiches((data ?? []) as Niche[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const touch = () => ({ updated_at: new Date().toISOString() });

  const addNiche = async (draft: NicheDraft) => {
    const { data } = await supabase.from('niches').insert(draft).select().single();
    await load();
    return data as Niche | null;
  };

  const updateNiche = async (id: string, patch: Partial<NicheDraft>) => {
    await supabase.from('niches').update({ ...patch, ...touch() }).eq('id', id);
    await load();
  };

  const removeNiche = async (id: string) => {
    await supabase.from('niches').delete().eq('id', id);
    await load();
  };

  const addBenchmark = async (id: string, site: BenchmarkSite) => {
    const niche = niches.find((n) => n.id === id);
    if (!niche) return;
    const next = [...niche.benchmark_sites.filter((b) => b.url !== site.url), site];
    await updateNiche(id, { benchmark_sites: next });
  };

  const removeBenchmark = async (id: string, url: string) => {
    const niche = niches.find((n) => n.id === id);
    if (!niche) return;
    await updateNiche(id, { benchmark_sites: niche.benchmark_sites.filter((b) => b.url !== url) });
  };

  const bySlug = (slug: string | null | undefined) => niches.find((n) => n.slug === slug) ?? null;

  return { niches, loading, reload: load, addNiche, updateNiche, removeNiche, addBenchmark, removeBenchmark, bySlug };
}
