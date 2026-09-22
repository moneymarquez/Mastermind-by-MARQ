import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setSoundEnabled, soundEnabled } from '../lib/motion';

export type Theme = 'dark' | 'light';
/** The second axis. Simple is the app as it has always been; Cyberpunk is
 *  src/cyberpunk.css layered on top via data-skin. Independent of theme:
 *  all four combinations render. */
export type Skin = 'simple' | 'cyberpunk';

const STORAGE_KEY = 'mastermind-theme';
const SKIN_KEY = 'mastermind-skin';

// The app's --mm-bg for each theme (index.css). Kept literal here because
// this runs at module load, before any stylesheet is guaranteed applied, so
// there's nothing to read a CSS variable from yet.
const STATUS_BAR_COLOR: Record<Theme, string> = { dark: '#0b0c11', light: '#faf9f7' };
const STATUS_BAR_COLOR_CYBER: Record<Theme, string> = { dark: '#0a0b10', light: '#262a34' };

let currentTheme: Theme = 'dark';
let currentSkin: Skin = 'simple';

function applyTheme(theme: Theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  paintStatusBar();
}
function applySkin(skin: Skin) {
  currentSkin = skin;
  if (skin === 'simple') document.documentElement.removeAttribute('data-skin');
  else document.documentElement.setAttribute('data-skin', skin);
  paintStatusBar();
  for (const l of skinListeners) l(skin);
}
// As an installed iOS app the status bar is opaque (see index.html's
// apple-mobile-web-app-status-bar-style) and iOS tints it from this meta
// tag. It tracks theme AND skin so the bar reads as part of the header.
function paintStatusBar() {
  const color = (currentSkin === 'cyberpunk' ? STATUS_BAR_COLOR_CYBER : STATUS_BAR_COLOR)[currentTheme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

const cachedTheme = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark';
const cachedSkin = (localStorage.getItem(SKIN_KEY) as Skin | null) ?? 'simple';
applyTheme(cachedTheme);
applySkin(cachedSkin);

// A tiny store so any component can read the skin without prop drilling —
// the fx components use it to pick loud vs quiet.
const skinListeners = new Set<(s: Skin) => void>();
export function getSkin(): Skin { return currentSkin; }
export function useSkin(): Skin {
  const [skin, setSkin] = useState<Skin>(currentSkin);
  useEffect(() => {
    skinListeners.add(setSkin);
    return () => { skinListeners.delete(setSkin); };
  }, []);
  return skin;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(cachedTheme);
  const [skin, setSkinState] = useState<Skin>(cachedSkin);
  const [soundFx, setSoundFxState] = useState<boolean>(soundEnabled);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Both columns exist as of schema_094; before that the theme select
    // failed quietly and localStorage was the only persistence.
    const { data } = await supabase.from('nova_preferences').select('theme, skin, sound_fx').maybeSingle();
    const nextTheme = (data?.theme as Theme | undefined) ?? cachedTheme;
    const nextSkin = (data?.skin as Skin | undefined) ?? cachedSkin;
    setTheme(nextTheme);
    setSkinState(nextSkin);
    if (typeof data?.sound_fx === 'boolean') { setSoundFxState(data.sound_fx); setSoundEnabled(data.sound_fx); }
    applyTheme(nextTheme);
    applySkin(nextSkin);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    localStorage.setItem(SKIN_KEY, nextSkin);
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

  const saveSkin = async (next: Skin) => {
    setSkinState(next);
    applySkin(next);
    localStorage.setItem(SKIN_KEY, next);
    await supabase.from('nova_preferences').upsert({ skin: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  // Sound is read synchronously by lib/motion.ts (localStorage) at the
  // moment a blip fires; the row is only so it follows the account.
  const saveSoundFx = async (on: boolean) => {
    setSoundFxState(on);
    setSoundEnabled(on);
    await supabase.from('nova_preferences').upsert({ sound_fx: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { theme, skin, soundFx, loading, save, saveSkin, saveSoundFx };
}
