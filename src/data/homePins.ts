/** Home's Pinned row (design handoff: up to 4 modules). A per-device
 *  display preference, so it lives in localStorage like the theme; it
 *  never touches a module's data. Ids are nav screen ids. */
const PIN_KEY = 'mm-pinned';
export const MAX_PINS = 4;
export const DEFAULT_PINS = ['budgeting', 'daily-plan', 'goals', 'sobriety'];

export function readPins(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PIN_KEY) ?? 'null') as string[] | null;
    return Array.isArray(v) ? v.slice(0, MAX_PINS) : DEFAULT_PINS;
  } catch { return DEFAULT_PINS; }
}

export function writePins(ids: string[]) {
  try { localStorage.setItem(PIN_KEY, JSON.stringify(ids.slice(0, MAX_PINS))); } catch { /* private mode: pins just don't stick */ }
}
