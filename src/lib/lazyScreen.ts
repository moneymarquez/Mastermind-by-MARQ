import { lazy } from 'react';
import type { ComponentType } from 'react';

/** React.lazy for screens (bug inventory B-10: the whole app shipped as
 *  one 2.7 MB file). After a deploy, an open tab can ask for a chunk that
 *  no longer exists; the first time that happens this reloads once to
 *  pick up the new build instead of showing an error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await load();
      try { sessionStorage.removeItem('mm:chunk-reload'); } catch { /* fine */ }
      return m;
    } catch (e) {
      let reloaded = false;
      try { reloaded = sessionStorage.getItem('mm:chunk-reload') === '1'; sessionStorage.setItem('mm:chunk-reload', '1'); } catch { /* fine */ }
      if (!reloaded) { window.location.reload(); return new Promise<{ default: T }>(() => {}); }
      throw e;
    }
  });
}
