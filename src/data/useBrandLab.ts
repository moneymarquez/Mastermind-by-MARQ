import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BrandConcept, BrandLabBrief, BrandLabCopy, BrandLabSteps } from './types';

export function useBrandLab() {
  const [briefs, setBriefs] = useState<BrandLabBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('brand_lab_briefs').select('*').order('created_at', { ascending: false });
    setBriefs((data ?? []) as BrandLabBrief[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addBrief = async (b: {
    direction: string;
    reference_url_1: string | null;
    reference_url_2: string | null;
    reference_url_3: string | null;
    business?: string | null;
    audience?: string | null;
    tone?: string | null;
    color_pref?: string | null;
  }) => {
    const { data } = await supabase.from('brand_lab_briefs').insert(b).select().single();
    await load();
    return data as BrandLabBrief | null;
  };

  const removeBrief = async (id: string) => {
    await supabase.from('brand_lab_briefs').delete().eq('id', id);
    await load();
  };

  const saveAiCopy = async (id: string, copy: BrandLabCopy) => {
    await supabase.from('brand_lab_briefs').update({ ai_copy: copy }).eq('id', id);
    await load();
  };

  const saveConcepts = async (id: string, concepts: BrandConcept[]) => {
    await supabase.from('brand_lab_briefs').update({ concepts }).eq('id', id);
    await load();
  };

  const pinConcept = async (id: string, conceptId: string) => {
    await supabase.from('brand_lab_briefs').update({ pinned_concept_id: conceptId }).eq('id', id);
    await load();
  };

  const saveStep = async (id: string, key: keyof BrandLabSteps, step: { text?: string; confirmed: boolean }) => {
    const brief = briefs.find((b) => b.id === id);
    const nextSteps: BrandLabSteps = { ...(brief?.steps ?? {}), [key]: step };
    await supabase.from('brand_lab_briefs').update({ steps: nextSteps }).eq('id', id);
    await load();
  };

  return { briefs, loading, addBrief, removeBrief, saveAiCopy, saveConcepts, pinConcept, saveStep };
}
