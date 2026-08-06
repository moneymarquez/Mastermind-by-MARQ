import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BrandLabBrief, BrandLabCopy } from './types';

export function useBrandLab() {
  const [briefs, setBriefs] = useState<BrandLabBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('brand_lab_briefs').select('*').order('created_at', { ascending: false });
    setBriefs(data ?? []);
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

  return { briefs, loading, addBrief, removeBrief, saveAiCopy };
}
