/** Small date/format helpers shared by the redesigned module screens. Pure. */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const utcYmd = (d: Date) => d.toISOString().slice(0, 10);
export const parseYmd = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);
export function addDays(s: string, n: number): string { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
export function daysBetween(a: string, b: string): number { return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000); }
export const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const shortDate = (s: string) => parseYmd(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const dayLabel = (s: string) => `${shortDate(s)} · ${WD[parseYmd(s).getDay()]}`;
export const longToday = (d = new Date()) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const plural = (n: number, w: string, p = `${w}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? w : p}`;
export const usd = (n: number, dec = 0) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
export const num = (n: number, dec = 0) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
/** "10:40 AM" from a Date or "HH:MM". */
export function clock(t: Date | string): string {
  const d = typeof t === 'string' ? new Date(`2000-01-01T${t.length === 5 ? t : t.slice(0, 5)}:00`) : t;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
/** "9:00" style short clock (no AM/PM) like the timeline. */
export function clockShort(hhmm: string): string { const [h, m] = hhmm.split(':').map(Number); const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, '0')}`; }
export const initials = (s: string | null | undefined) => (s ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
/** Last N day keys ending today (oldest first). */
export function lastDays(n: number, end = ymd(new Date())): string[] { return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1)); }
