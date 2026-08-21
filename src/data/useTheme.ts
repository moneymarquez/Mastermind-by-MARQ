import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'mastermind-theme';

// Applies the data-theme attribute immediately on load (before React even
// mounts anything meaningful) using whatever's in localStorage, so there's
// no flash of the wrong theme while the Supabase round-trip is in flight.
// The Supabase value (source of truth once loaded) overwrites it right
// after — see load() below.
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const cachedTheme = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
applyTheme(cachedTheme);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(cachedTheme);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nova_preferences').select('theme').maybeSingle();
    const next = (data?.theme as Theme | undefined) ?? cachedTheme;
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next: Theme) => {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    await supabase.from('nova_preferences').upsert({ theme: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { theme, loading, save };
}
