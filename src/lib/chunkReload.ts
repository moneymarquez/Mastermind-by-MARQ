/** Shared with the inline script in index.html. One reload per tab after a
 *  missing chunk; a second failure is a real error and should surface. */
export const CHUNK_RELOAD_KEY = 'mm:chunk-reload';

export function chunkReloadPlan(stored: string | null): 'reload' | 'surface' {
  return stored === '1' ? 'surface' : 'reload';
}
