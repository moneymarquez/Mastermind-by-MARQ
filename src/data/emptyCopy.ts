/** Empty-state lines, keyed so a screen asks for a meaning, not a string. */
const COPY: Record<string, string> = {
  nextOnSchedule: 'Nothing yet',
  noSignalsToday: 'No signals yet today.',
  noPositions: 'No open positions right now.',
  noLeadQueue: 'No leads queued. Go to LeadFlow → Lead Pool, pick a city, and press Send 10 / 20 / 50 / 100.',
  noCallQueue: 'Nothing left in today\'s queue — add more contacts to keep pushing toward the goal.',
  planHourEmpty: 'Nothing planned for this hour.',
  planPickHour: 'Pick an hour to see what\'s planned, or add something.',
  nothingDue: 'Nothing due.',
};

export function emptyCopy(key: keyof typeof COPY): string {
  return COPY[key];
}
