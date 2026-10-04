/** What happened on a call to a LEAD.
 *
 *  Deliberately named apart from data/types' CALL_OUTCOMES, which is the
 *  same idea for a `contacts` row and has different values. Two constants
 *  called CALL_OUTCOMES in one codebase is a trap: the sets aren't
 *  interchangeable, and swapping one for the other fails at the database,
 *  not at the type checker.
 *
 *  Kept as plain statuses on the lead rather than a call-log table: the
 *  useful question is "where does this one stand right now", and the
 *  attempt count plus last-called date answers the rest without another
 *  table to join.
 *
 *  Values must match the leads_status_check constraint (schema_090) — a
 *  value outside it is rejected outright by Postgres, not quietly ignored.
 */
/** `signal` is the LeadFlow signal each outcome wears (see format.ts). */
export const LEAD_CALL_OUTCOMES: { value: string; label: string; color: string; signal: 'go' | 'wait' | 'stop' | 'info' | 'neu' }[] = [
  { value: 'no_answer', color: '#6b7280', label: 'No answer', signal: 'neu' },
  { value: 'voicemail', color: '#6b7280', label: 'Left voicemail', signal: 'neu' },
  { value: 'gatekeeper', color: '#ca8a04', label: "Couldn't reach owner", signal: 'wait' },
  { value: 'callback', color: '#2563eb', label: 'Callback later', signal: 'info' },
  { value: 'interested', color: '#16a34a', label: 'Interested', signal: 'go' },
  { value: 'not_interested', color: '#ef4444', label: 'Not interested', signal: 'stop' },
];

export const LEAD_OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_CALL_OUTCOMES.map((o) => [o.value, o.label]),
);
