import type { LeadflowLead } from '../../../data/useLeadflow';
import { isTouched, stateOf } from './leadLinks';

/** Geography filtering for the lead funnel.
 *
 *  The working pattern these exist for is "this week I'm only calling
 *  Draper" — pick a state, pick a city inside it, then push a batch of that
 *  city's leads into Dialing. Everything here is pure so it can be tested
 *  without a database or a DOM; the screens only supply the array.
 */

export const ALL = 'All';

export interface Option {
  value: string;
  count: number;
}

function tally(values: string[]): Option[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  // Biggest first: the city you're actually working is the one you have the
  // most leads in, and alphabetical would bury it under one-off towns.
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** States present in this set. Falls back to parsing the address, because
 *  the scraper leaves `state` empty on rows it writes — stateOf recovers
 *  "UT" from "…, Sandy, UT 84070, USA". */
export function stateOptions(leads: LeadflowLead[]): Option[] {
  return tally(leads.map((l) => stateOf(l)));
}

/** Cities present in this set, narrowed to one state when given one.
 *
 *  Scoped to the state on purpose: "Springfield" exists in most of them, so
 *  an unscoped city list would silently mix leads from four time zones into
 *  one call session. */
export function cityOptions(leads: LeadflowLead[], state: string = ALL): Option[] {
  const scoped = state === ALL ? leads : leads.filter((l) => stateOf(l) === state);
  return tally(scoped.map((l) => (l.city || '').trim()));
}

export interface GeoFilter {
  state: string;
  city: string;
}

export function filterByGeo(leads: LeadflowLead[], { state, city }: GeoFilter): LeadflowLead[] {
  return leads.filter((l) => {
    if (state !== ALL && stateOf(l) !== state) return false;
    if (city !== ALL && (l.city || '').trim() !== city) return false;
    return true;
  });
}

/** A city that no longer exists in the chosen state has to be dropped, or
 *  the list silently shows nothing: pick Utah → Draper, switch to Nevada,
 *  and "Draper" would still be the filter with zero matches behind it. */
export function reconcileCity(leads: LeadflowLead[], state: string, city: string): string {
  if (city === ALL) return ALL;
  return cityOptions(leads, state).some((o) => o.value === city) ? city : ALL;
}

/** The next N leads to push into Dialing.
 *
 *  Untouched only, and never one that's already queued — the point of the
 *  button is to top up today's call list, so re-pressing it must not hand
 *  back the same leads or ones already worked. Best score first, so a
 *  partial batch is the best part of the batch rather than an arbitrary
 *  slice of it. */
export function pickForDialing(leads: LeadflowLead[], count: number): LeadflowLead[] {
  return leads
    .filter((l) => !l.dialing_queued && !isTouched(l))
    .sort((a, b) => (b.fizzle_score ?? 0) - (a.fizzle_score ?? 0))
    .slice(0, Math.max(0, count));
}

/** How many of a filtered set a "Send N" button could actually send.
 *  Drives the disabled state and the "only 12 left" label, so the button
 *  never promises 50 leads it can't produce. */
export function availableForDialing(leads: LeadflowLead[]): number {
  return leads.filter((l) => !l.dialing_queued && !isTouched(l)).length;
}

/** How many of these leads were called today.
 *
 *  Compared as local calendar days rather than by ISO prefix: last_called_at
 *  is UTC, so a 6pm Mountain call is already "tomorrow" in UTC and a naive
 *  string compare would drop it from the day's count — exactly the calls
 *  made at the end of a session.
 */
export function countCalledToday(leads: LeadflowLead[], now: Date = new Date()): number {
  const today = now.toDateString();
  return leads.filter((l) => {
    if (!l.last_called_at) return false;
    const d = new Date(l.last_called_at);
    return !Number.isNaN(d.getTime()) && d.toDateString() === today;
  }).length;
}

/** Today's call list, in the order it should be worked: anything not yet
 *  dealt with first, best score at the top, everything already logged
 *  pushed to the bottom so the next call is always the first row. */
export function sortDialingQueue(leads: LeadflowLead[]): LeadflowLead[] {
  return [...leads].sort((a, b) => {
    const at = isTouched(a) ? 1 : 0;
    const bt = isTouched(b) ? 1 : 0;
    if (at !== bt) return at - bt;
    return (b.fizzle_score ?? 0) - (a.fizzle_score ?? 0);
  });
}
