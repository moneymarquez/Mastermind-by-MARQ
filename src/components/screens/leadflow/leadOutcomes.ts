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
export const LEAD_CALL_OUTCOMES: { value: string; label: string; color: string }[] = [
  { value: 'no_answer', label: 'No answer', color: '#6b7280' },
  { value: 'voicemail', label: 'Left voicemail', color: '#6b7280' },
  { value: 'gatekeeper', label: "Couldn't reach owner", color: '#ca8a04' },
  { value: 'callback', label: 'Callback later', color: '#2563eb' },
  { value: 'interested', label: 'Interested', color: '#16a34a' },
  { value: 'not_interested', label: 'Not interested', color: '#ef4444' },
];

export const LEAD_OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_CALL_OUTCOMES.map((o) => [o.value, o.label]),
);
