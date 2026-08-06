import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { todayStr } from './date';
import type { SobrietyCheckin } from './types';

export function useSobriety() {
  const [checkins, setCheckins] = useState<SobrietyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sobriety_checkins')
      .select('*')
      .order('checkin_date', { ascending: false })
      .limit(60);
    setCheckins(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayStr();
  const todayCheckin = checkins.find((c) => c.checkin_date === today) ?? null;

  let streak = 0;
  {
    const clean = (c: SobrietyCheckin) => !c.drank && !c.weed && !c.nicotine;
    const cursor = new Date(`${today}T00:00:00`);
    for (const c of checkins) {
      const expected = cursor.toISOString().slice(0, 10);
      if (c.checkin_date !== expected || !clean(c)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const saveToday = async (patch: Partial<Pick<SobrietyCheckin, 'drank' | 'weed' | 'nicotine' | 'note'>>) => {
    const base = todayCheckin ?? { drank: false, weed: false, nicotine: false, note: null };
    const next = { ...base, ...patch };
    const heavy = [next.drank, next.weed, next.nicotine].filter(Boolean).length >= 2;
    await supabase
      .from('sobriety_checkins')
      .upsert({ ...next, heavy, checkin_date: today }, { onConflict: 'user_id,checkin_date' });
    await load();
  };

  const saveInsight = async (id: string, insight: string) => {
    await supabase.from('sobriety_checkins').update({ ai_insight: insight }).eq('id', id);
    await load();
  };

  return { checkins, todayCheckin, streak, loading, saveToday, saveInsight };
}
