// Pure waitlist logic (Addendum 2 §1): input cleaning, what the public site
// config looks like, and CSV export. The Worker handler and tests share it.
import { OFFER_DEFAULTS } from '../../src/data/madeby';

export type LaunchMode = 'waitlist' | 'open';
export const parseMode = (v: unknown): LaunchMode => (v === 'open' ? 'open' : 'waitlist');
export const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;

export interface WaitlistInput { email: string; name: string | null; code: string | null; source: string | null; utm: Record<string, string> }
/** Clean the public form's body, or say why it's no good. The honeypot is checked by the caller. Pure. */
export function cleanWaitlistInput(b: Record<string, unknown>): { ok: true; value: WaitlistInput } | { ok: false; error: string } {
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'That email address doesn\'t look right.' };
  const name = String(b.name ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80) || null;
  const codeRaw = String(b.code ?? '').trim().toUpperCase();
  const code = /^[A-Z0-9_-]{2,32}$/.test(codeRaw) ? codeRaw : null;
  const utm: Record<string, string> = {};
  const rawUtm = (b.utm && typeof b.utm === 'object' ? b.utm : {}) as Record<string, unknown>;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) { const v = String(rawUtm[k] ?? '').trim().slice(0, 100); if (v) utm[k] = v; }
  const source = String(b.source ?? '').trim().slice(0, 120) || utm.utm_source || null;
  return { ok: true, value: { email, name, code, source, utm } };
}

export interface FoundingOffer { price_usd: number; limit: number; spots_left: number; headline: string; blurb: string }
const fillBlurb = (s: string, limit: number, price: number) => s.replace('{{limit}}', String(limit)).replace('{{price}}', `$${price}`);
/** The founding block the public page shows: launch_offers config over the defaults, spots left from signups. Pure. */
export function foundingOffer(config: Record<string, unknown> | null | undefined, foundingTaken: number): FoundingOffer {
  const d = OFFER_DEFAULTS.founding as Record<string, unknown>;
  const c = { ...d, ...(config ?? {}) };
  const limit = Math.max(1, Math.floor(Number(c.limit ?? 100)) || 100);
  const price = Number(c.price_usd ?? 19.99) || 19.99;
  return { price_usd: price, limit, spots_left: Math.max(0, limit - Math.max(0, foundingTaken)), headline: String(c.headline ?? 'Founding Member'), blurb: fillBlurb(String(c.blurb ?? ''), limit, price) };
}

export interface SiteConfig { launch_mode: LaunchMode; founding: FoundingOffer; copy: { headline: string; sub: string } }
export const DEFAULT_COPY = { headline: 'Masterminds opens soon. Founding members get in first.', sub: 'Join the waitlist. The first 100 lock $19.99/mo for life, get first access, and their first month free.' };

export interface WaitlistRow { email: string; name: string | null; code: string | null; source: string | null; spot_number: number; founding_spot: boolean; created_at: string }
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
/** CSV for the owner's export. Cells that start like a formula are defused. Pure. */
export function waitlistCsv(rows: WaitlistRow[]): string {
  const head = ['spot', 'email', 'name', 'founding', 'code', 'source', 'joined'];
  return [head.join(','), ...rows.map((r) => [r.spot_number, r.email, r.name, r.founding_spot ? 'yes' : 'no', r.code, r.source, r.created_at].map(csvCell).join(','))].join('\n');
}

/** Dashboard numbers for the owner screen. Pure. */
export function waitlistStats(rows: WaitlistRow[], limit: number, now = Date.now()) {
  const perDay = new Map<string, number>();
  const perCode = new Map<string, number>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
    if (r.code) perCode.set(r.code, (perCode.get(r.code) ?? 0) + 1);
  }
  const days: { date: string; n: number }[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(now - i * 86400000).toISOString().slice(0, 10); days.push({ date: d, n: perDay.get(d) ?? 0 }); }
  const founding = rows.filter((r) => r.founding_spot).length;
  return { total: rows.length, foundingUsed: founding, spotsLeft: Math.max(0, limit - founding), days, byCode: [...perCode.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, n })), withCode: rows.filter((r) => r.code).length };
}
