import type { Skin } from './useTheme';

/** Empty-state lines, per skin. Simple keeps the app's own wording;
 *  Cyberpunk reads like a terminal. Keyed so a screen asks for a meaning,
 *  not a string, and the skin decides the voice. */
const COPY: Record<string, { simple: string; cyberpunk: string }> = {
  nextOnSchedule: { simple: 'Nothing yet', cyberpunk: 'NO SIGNAL' },
  noSignalsToday: { simple: 'No signals yet today.', cyberpunk: 'NO SIGNAL — MARKET SCAN IDLE' },
  noPositions: { simple: 'No open positions right now.', cyberpunk: 'NO OPEN POSITIONS' },
  noLeadQueue: { simple: 'No leads queued. Go to LeadFlow → Lead Pool, pick a city, and press Send 10 / 20 / 50 / 100.', cyberpunk: 'NO SIGNAL — LOAD LEADS TO BEGIN. LEAD POOL → CITY → SEND 20' },
  noCallQueue: { simple: 'Nothing left in today\'s queue — add more contacts to keep pushing toward the goal.', cyberpunk: 'QUEUE EMPTY — ADD CONTACTS TO CONTINUE' },
  planHourEmpty: { simple: 'Nothing planned for this hour.', cyberpunk: 'HOUR UNALLOCATED' },
  planPickHour: { simple: 'Pick an hour to see what\'s planned, or add something.', cyberpunk: 'SELECT HOUR TO INSPECT OR ALLOCATE' },
  nothingDue: { simple: 'Nothing due.', cyberpunk: 'NO ALERTS' },
};

export function emptyCopy(key: keyof typeof COPY, skin: Skin): string {
  return COPY[key][skin === 'cyberpunk' ? 'cyberpunk' : 'simple'];
}
