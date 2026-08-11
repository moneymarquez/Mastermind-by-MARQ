import type { CalendarEvent, EventType } from './types';

// Single source of truth for calendar colors — shared by ScheduleScreen,
// StreamingScreen's embedded calendar, and EventAdderModal, so a type's
// color can never drift between screens.
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  holiday: '#8A8F98', dialing: '#5B8DEF', scalez: '#4CAF7D', streaming: '#C9A24B',
};

export function eventLabel(ev: CalendarEvent): string {
  const d = ev.details as Record<string, string>;
  if (ev.type === 'holiday') return ev.notes || 'Shift';
  if (ev.type === 'streaming') return d.title || ev.notes || 'Stream';
  if (ev.type === 'dialing') return `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || 'Dialing appt';
  return d.business_name || d.contact_name || 'Scalez appt';
}
