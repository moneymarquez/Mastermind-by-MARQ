import { lazy } from 'react';
import type { ComponentType } from 'react';
import { CHUNK_RELOAD_KEY, chunkReloadPlan } from './chunkReload';

/** React.lazy for screens (bug inventory B-10: the whole app shipped as
 *  one 2.7 MB file). After a deploy, an open tab can ask for a chunk that
 *  no longer exists; the first time that happens this reloads once to
 *  pick up the new build instead of showing an error. The entry script
 *  itself is covered by the inline handler in index.html (same key). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await load();
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* fine */ }
      return m;
    } catch (e) {
      let plan: 'reload' | 'surface' = 'reload';
      try {
        plan = chunkReloadPlan(sessionStorage.getItem(CHUNK_RELOAD_KEY));
        if (plan === 'reload') sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      } catch { /* storage blocked: still try one reload */ }
      if (plan === 'reload') { window.location.reload(); return new Promise<{ default: T }>(() => {}); }
      throw e;
    }
  });
}
