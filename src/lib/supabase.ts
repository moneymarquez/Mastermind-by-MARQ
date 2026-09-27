import { createClient } from '@supabase/supabase-js';
import { isDemo } from '../demo/state';
import { demoClient } from '../demo/client';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.');
}

/** The real client. Only use this directly for things that must never
 *  go to the demo copy (there are none in the app today). */
export const realSupabase = createClient(url, anonKey);

type Client = typeof realSupabase;

/** Demo Mode (13-demo-mode-spec): every call is routed, at call time, to
 *  either the real client or the in-memory demo copy. Checked per access,
 *  so no query can slip through to the real database while the demo is on
 *  — and none goes to the demo copy once it's off. */
function route<T extends object>(real: T, demo: T): T {
  return new Proxy(real, {
    get(_t, prop) {
      const target = (isDemo() ? demo : real) as Record<string | symbol, unknown>;
      const v = target[prop];
      if (prop === 'auth' || prop === 'storage' || prop === 'functions') return route(real[prop as keyof T] as object, (demo as Record<string | symbol, unknown>)[prop] as object);
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}

export const supabase: Client = route(realSupabase, demoClient as Client);
