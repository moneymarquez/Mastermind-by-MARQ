import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Travel mode is read by the shell (sidebar, routes) and Settings at once, so
// it lives in one small module-level store: loaded once from user_settings,
// mirrored to localStorage so the app opens in the right mode before the
// network answers, and shared by every component that calls the hook.

const KEY = 'mm-travel-mode';
let value = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
let loaded = false;
const subs = new Set<(v: boolean) => void>();
const emit = () => { for (const s of subs) s(value); };

async function load() {
  if (loaded) return;
  loaded = true;
  const { data } = await supabase.from('user_settings').select('travel_mode').maybeSingle();
  if (data && typeof data.travel_mode === 'boolean' && data.travel_mode !== value) {
    value = data.travel_mode;
    try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* private mode */ }
    emit();
  }
}

export async function setTravelMode(on: boolean): Promise<string | null> {
  value = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
  emit();
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return 'Not signed in.';
  const { error } = await supabase.from('user_settings').upsert({ user_id: uid, travel_mode: on, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export function useTravelMode(): boolean {
  const [v, setV] = useState(value);
  useEffect(() => {
    subs.add(setV);
    void load();
    return () => { subs.delete(setV); };
  }, []);
  return v;
}
