import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setSoundEnabled, soundEnabled } from '../lib/motion';

/** The saved preference. 'system' follows the device; what's painted is
 *  always one of the two resolved themes (design handoff: Appearance). */
export type Theme = 'dark' | 'light' | 'system';
export type Resolved = 'dark' | 'light';

const STORAGE_KEY = 'mastermind-theme';

// The handoff's --bg for each theme. Literal because this runs at module
// load, before any stylesheet is guaranteed applied.
const STATUS_BAR_COLOR: Record<Resolved, string> = { dark: '#0b0b0d', light: '#f4f4f6' };

let currentPref: Theme = 'dark';
let currentTheme: Resolved = 'dark';

const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export const resolveTheme = (t: Theme): Resolved => (t === 'system' ? (darkQuery && !darkQuery.matches ? 'light' : 'dark') : t);
const themeListeners = new Set<(t: Resolved) => void>();

function applyTheme(theme: Theme) {
  currentPref = theme;
  currentTheme = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', STATUS_BAR_COLOR[currentTheme]);
  for (const l of themeListeners) l(currentTheme);
}
// "System" re-paints the moment the device flips.
darkQuery?.addEventListener?.('change', () => { if (currentPref === 'system') applyTheme('system'); });
/** The theme actually on screen right now (never 'system'). */
export function useResolvedTheme(): Resolved {
  const [t, setT] = useState<Resolved>(currentTheme);
  useEffect(() => { themeListeners.add(setT); return () => { themeListeners.delete(setT); }; }, []);
  return t;
}

const stored = localStorage.getItem(STORAGE_KEY);
const cachedTheme: Theme = stored === 'light' || stored === 'system' ? stored : 'dark';
// The old Cyberpunk skin is gone; clear its leftovers once.
document.documentElement.removeAttribute('data-skin');
localStorage.removeItem('mastermind-skin');
applyTheme(cachedTheme);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(cachedTheme);
  const [soundFx, setSoundFxState] = useState<boolean>(soundEnabled);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nova_preferences').select('theme, sound_fx').maybeSingle();
    const t = data?.theme;
    const nextTheme: Theme = t === 'light' || t === 'system' || t === 'dark' ? t : cachedTheme;
    setTheme(nextTheme);
    if (typeof data?.sound_fx === 'boolean') { setSoundFxState(data.sound_fx); setSoundEnabled(data.sound_fx); }
    applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next: Theme) => {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    await supabase.from('nova_preferences').upsert({ theme: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  // Sound is read synchronously by lib/motion.ts (localStorage) at the
  // moment a blip fires; the row is only so it follows the account.
  const saveSoundFx = async (on: boolean) => {
    setSoundFxState(on);
    setSoundEnabled(on);
    await supabase.from('nova_preferences').upsert({ sound_fx: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { theme, soundFx, loading, save, saveSoundFx };
}
