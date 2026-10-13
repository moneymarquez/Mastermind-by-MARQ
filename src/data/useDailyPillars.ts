import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PillarKey = 'physical' | 'mental' | 'spirit' | 'financial';
export interface PillarState { text: string; done: boolean }
export type Pillars = Record<PillarKey, PillarState>;

export const PILLARS: { key: PillarKey; label: string; hint: string; placeholder: string }[] = [
  { key: 'physical', label: 'Physical', hint: 'Move your body', placeholder: 'Workout, walk, lift' },
  { key: 'mental', label: 'Mental', hint: 'Sharpen your mind', placeholder: 'Read, podcast, learn' },
  { key: 'spirit', label: 'Spirit / Mindset', hint: 'Get right inside', placeholder: 'Pray, journal, gratitude' },
  { key: 'financial', label: 'Financial win', hint: 'Move money forward', placeholder: 'Cold calling' },
];

const blank = (): Pillars => ({
  physical: { text: '', done: false },
  mental: { text: '', done: false },
  spirit: { text: '', done: false },
  financial: { text: 'Cold calling', done: false },
});
const merge = (raw: Partial<Pillars> | null | undefined): Pillars => {
  const b = blank();
  (Object.keys(b) as PillarKey[]).forEach((k) => { if (raw?.[k]) b[k] = { ...b[k], ...raw[k] }; });
  return b;
};
const lsKey = (d: string) => `mm.pillars.${d}`;

/** Today's four pillars. Saved to daily_pillars; if that table isn't there
 *  yet (migration not run) it quietly keeps them in this browser so the
 *  card still works. */
export function useDailyPillars(date: string) {
  const [pillars, setPillars] = useState<Pillars>(blank);
  const [remote, setRemote] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let off = false;
    setLoaded(false);
    (async () => {
      const { data, error } = await supabase.from('daily_pillars').select('pillars').eq('pillar_date', date).maybeSingle();
      if (off) return;
      if (error) {
        setRemote(false);
        try { setPillars(merge(JSON.parse(localStorage.getItem(lsKey(date)) ?? 'null'))); } catch { setPillars(blank()); }
        setLoaded(true);
        return;
      }
      setRemote(true);
      setPillars(merge(data?.pillars as Partial<Pillars> | undefined));
      setLoaded(true);
    })();
    return () => { off = true; };
  }, [date]);

  const save = useCallback(async (next: Pillars) => {
    setPillars(next);
    if (remote) {
      const { error } = await supabase.from('daily_pillars').upsert({ pillar_date: date, pillars: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,pillar_date' });
      if (!error) return;
      setRemote(false);
    }
    try { localStorage.setItem(lsKey(date), JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, [date, remote]);

  const set = (k: PillarKey, patch: Partial<PillarState>) => save({ ...pillars, [k]: { ...pillars[k], ...patch } });
  return { pillars, set, loaded };
}
