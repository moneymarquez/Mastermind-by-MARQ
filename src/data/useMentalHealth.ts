import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MentalHealthCheckin, Mood } from './types';

export function useMentalHealth() {
  const [checkins, setCheckins] = useState<MentalHealthCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mental_health_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setCheckins(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCheckin = async (mood: Mood, note: string) => {
    await supabase.from('mental_health_checkins').insert({ mood, note: note || null });
    await load();
  };

  return { checkins, loading, addCheckin };
}
