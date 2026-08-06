export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function snapMinutes(mins: number, step = 5): number {
  return Math.round(mins / step) * step;
}

export function formatTimeLabel(time: string): string {
  const mins = timeToMinutes(time);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function hoursBetween(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return Math.max(0, diff) / 60;
}

/** Sunday (local) of the week containing the given YYYY-MM-DD date string. */
export function weekStartOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(dStr: string): string {
  const d = new Date(`${dStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
