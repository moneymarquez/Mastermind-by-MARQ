// Service-role Supabase REST, push, and time helpers shared by the digest,
// the worker engine and the setup page. Server-side only: the service-role
// key bypasses RLS, so every query here filters by user_id explicitly.
import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushMessage, PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';

export interface SbEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export class Sb {
  readonly url: string;
  readonly headers: Record<string, string>;
  constructor(env: SbEnv) {
    this.url = env.VITE_SUPABASE_URL;
    const k = env.SUPABASE_SERVICE_ROLE_KEY;
    this.headers = { apikey: k, Authorization: `Bearer ${k}`, 'content-type': 'application/json' };
  }
  /** GET /rest/v1/<path>. Returns [] on any failure (missing table,
   *  bad column) so one broken desk never takes the digest down. */
  async get<T = Record<string, unknown>>(path: string): Promise<T[]> {
    try {
      const res = await fetch(`${this.url}/rest/v1/${path}`, { headers: this.headers });
      if (!res.ok) { console.error('sb.get', path, res.status, (await res.text().catch(() => '')).slice(0, 200)); return []; }
      const rows = await res.json();
      return Array.isArray(rows) ? (rows as T[]) : [];
    } catch (e) { console.error('sb.get', path, e); return []; }
  }
  /** Exact row count via Prefer: count=exact on a HEAD-style range. */
  async count(path: string): Promise<number> {
    try {
      const res = await fetch(`${this.url}/rest/v1/${path}${path.includes('?') ? '&' : '?'}select=id&limit=1`, { headers: { ...this.headers, Prefer: 'count=exact' } });
      const range = res.headers.get('content-range') ?? '';
      const n = Number(range.split('/')[1]);
      return Number.isFinite(n) ? n : 0;
    } catch { return 0; }
  }
  async insert<T = Record<string, unknown>>(table: string, body: unknown, opts: { upsert?: string } = {}): Promise<T[]> {
    const q = opts.upsert ? `?on_conflict=${opts.upsert}` : '';
    const prefer = ['return=representation', opts.upsert ? 'resolution=merge-duplicates' : ''].filter(Boolean).join(',');
    const res = await fetch(`${this.url}/rest/v1/${table}${q}`, { method: 'POST', headers: { ...this.headers, Prefer: prefer }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const rows = await res.json();
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  async patch(table: string, filter: string, body: unknown): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: this.headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`patch ${table}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Wall-clock parts in an IANA zone — handles daylight saving by asking
 *  Intl, so nothing needs editing in November. */
export function zonedNow(timeZone: string, at = new Date()): { date: string; hour: number; minute: number; dow: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(at);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(m.weekday);
  const hour = Number(m.hour), minute = Number(m.minute);
  return { date: `${m.year}-${m.month}-${m.day}`, hour, minute, dow, minutes: hour * 60 + minute };
}
export function addDaysIso(date: string, n: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

interface PushSubRow { id: string; endpoint: string; p256dh: string; auth: string }
/** Web push to every device a user subscribed. Returns how many went out. */
export async function pushToUser(env: SbEnv, sb: Sb, userId: string, title: string, body: string, url = '/'): Promise<{ sent: number; error?: string }> {
  if (!env.VITE_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, error: 'Push is not configured (VAPID keys missing).' };
  const vapid: VapidKeys = { subject: env.VAPID_SUBJECT || 'mailto:notifications@example.com', publicKey: env.VITE_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const subs = await sb.get<PushSubRow>(`push_subscriptions?user_id=eq.${userId}&select=id,endpoint,p256dh,auth`);
  if (subs.length === 0) return { sent: 0, error: 'No device has turned on notifications for Mastermind yet.' };
  let sent = 0; let lastErr = '';
  for (const s of subs) {
    const subscription: PushSubscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
    const message: PushMessage = { data: JSON.stringify({ title, body, url }) };
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(s.endpoint, payload);
      if (res.status === 404 || res.status === 410) await fetch(`${sb.url}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: sb.headers });
      else if (res.ok) sent++;
      else lastErr = `push ${res.status}`;
    } catch (e) { lastErr = e instanceof Error ? e.message : String(e); }
  }
  return sent ? { sent } : { sent, error: lastErr || 'Push failed.' };
}
