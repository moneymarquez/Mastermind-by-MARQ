// Coupon maker (Addendum 2 §2). Marq makes a code in the Coupons screen; this
// creates the Stripe coupon + promotion code and keeps their IDs. No
// affiliate system: a code is just a discount that can carry a label ("James").
//
// Test mode ≠ live. While DRY_RUN is on, only STRIPE_TEST_SECRET_KEY is ever
// used (the live key is never touched), and the IDs are stored in the *test*
// columns. With DRY_RUN off, STRIPE_SECRET_KEY is used and the *live* columns
// are filled. Switching is the existing test-mode setting, not a code change.
// Deactivating turns the Stripe promotion code off; nothing is ever deleted,
// so redemption history stays.
import type { Sb } from './sb';
import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

const STRIPE = 'https://api.stripe.com/v1';
export interface StripeEnv extends DryRunEnv { STRIPE_SECRET_KEY?: string; STRIPE_TEST_SECRET_KEY?: string }
export type StripeMode = 'test' | 'live';
export interface StripeCreds { key: string; mode: StripeMode }

/** The key this run may use, or why there isn't one. Pure. */
export function stripeCredsFor(env: StripeEnv): { creds: StripeCreds | null; reason: string } {
  if (isDryRun(env)) {
    const k = env.STRIPE_TEST_SECRET_KEY?.trim();
    if (!k) return { creds: null, reason: 'Test mode is on, so codes are created in Stripe test mode only. Add STRIPE_TEST_SECRET_KEY (an sk_test_… key) in Cloudflare → Build variables, then tap Push to Stripe.' };
    if (!k.startsWith('sk_test_') && !k.startsWith('rk_test_')) return { creds: null, reason: 'STRIPE_TEST_SECRET_KEY must be a test key (starts with sk_test_). The live key is never used while test mode is on.' };
    return { creds: { key: k, mode: 'test' }, reason: '' };
  }
  const k = env.STRIPE_SECRET_KEY?.trim();
  if (!k) return { creds: null, reason: 'STRIPE_SECRET_KEY is not set.' };
  return { creds: { key: k, mode: 'live' }, reason: '' };
}

export interface CouponRow {
  id: string; code: string; label: string | null; owner_label: string | null; kind: string;
  percent_off: number | null; amount_off_usd: number | null; duration: 'once' | 'repeating' | 'forever'; duration_months: number | null;
  max_redemptions: number | null; expires_at: string | null; active: boolean;
  stripe_test_coupon_id: string | null; stripe_test_promo_id: string | null; stripe_live_coupon_id: string | null; stripe_live_promo_id: string | null; last_error: string | null;
}

export interface CouponInput { code: string; label: string | null; owner_label: string | null; kind: CouponRow['kind']; percent_off: number | null; amount_off_usd: number | null; duration: CouponRow['duration']; duration_months: number | null; max_redemptions: number | null; expires_at: string | null }
const KINDS = ['promoter', 'founding', 'family', 'winback', 'other'];
/** Clean a create-coupon request, or say what's wrong. Pure. */
export function validateCouponInput(b: Record<string, unknown>): { ok: true; value: CouponInput } | { ok: false; error: string } {
  const code = String(b.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { ok: false, error: 'A code is 3–32 letters, numbers or dashes (no spaces).' };
  const pct = b.percent_off === '' || b.percent_off == null ? null : Number(b.percent_off);
  const amt = b.amount_off_usd === '' || b.amount_off_usd == null ? null : Number(b.amount_off_usd);
  if ((pct == null) === (amt == null)) return { ok: false, error: 'Choose either a percent off or a dollar amount off.' };
  if (pct != null && !(pct > 0 && pct <= 100)) return { ok: false, error: 'Percent off is more than 0 and at most 100.' };
  if (amt != null && !(amt > 0 && amt < 10000)) return { ok: false, error: 'Dollar amount off must be more than $0.' };
  const duration = (['once', 'repeating', 'forever'] as const).find((d) => d === b.duration) ?? 'once';
  const months = duration === 'repeating' ? Math.floor(Number(b.duration_months)) : null;
  if (duration === 'repeating' && !(months! >= 1 && months! <= 36)) return { ok: false, error: 'Repeating discounts need 1–36 months.' };
  const max = b.max_redemptions === '' || b.max_redemptions == null ? null : Math.floor(Number(b.max_redemptions));
  if (max != null && !(max >= 1)) return { ok: false, error: 'Max redemptions must be at least 1.' };
  const exp = b.expires_at ? new Date(String(b.expires_at)) : null;
  if (exp && Number.isNaN(exp.getTime())) return { ok: false, error: 'That expiry date doesn\'t look right.' };
  const kind = KINDS.includes(String(b.kind)) ? (String(b.kind) as CouponRow['kind']) : 'promoter';
  const clip = (v: unknown) => String(v ?? '').trim().slice(0, 80) || null;
  return { ok: true, value: { code, label: clip(b.label), owner_label: clip(b.owner_label), kind, percent_off: pct, amount_off_usd: amt, duration, duration_months: months, max_redemptions: max, expires_at: exp ? exp.toISOString() : null } };
}

/** Form body for POST /v1/coupons. Pure. */
export function couponParams(c: Pick<CouponRow, 'code' | 'label' | 'percent_off' | 'amount_off_usd' | 'duration' | 'duration_months' | 'max_redemptions'>): Record<string, string> {
  const p: Record<string, string> = { name: (c.label || c.code).slice(0, 40), duration: c.duration, 'metadata[mm_code]': c.code };
  if (c.percent_off != null) p.percent_off = String(c.percent_off);
  else { p.amount_off = String(Math.round(Number(c.amount_off_usd) * 100)); p.currency = 'usd'; }
  if (c.duration === 'repeating' && c.duration_months) p.duration_in_months = String(c.duration_months);
  if (c.max_redemptions) p.max_redemptions = String(c.max_redemptions);
  return p;
}
/** Form body for POST /v1/promotion_codes (current shape: promotion[type]=coupon). Pure. */
export function promoParams(c: Pick<CouponRow, 'code' | 'max_redemptions' | 'expires_at'>, couponId: string, legacy = false): Record<string, string> {
  const p: Record<string, string> = { code: c.code, 'metadata[mm_code]': c.code };
  if (legacy) p.coupon = couponId; else { p['promotion[type]'] = 'coupon'; p['promotion[coupon]'] = couponId; }
  if (c.max_redemptions) p.max_redemptions = String(c.max_redemptions);
  if (c.expires_at) p.expires_at = String(Math.floor(Date.parse(c.expires_at) / 1000));
  return p;
}

const idsFor = (c: CouponRow, mode: StripeMode) => (mode === 'test' ? { coupon: c.stripe_test_coupon_id, promo: c.stripe_test_promo_id } : { coupon: c.stripe_live_coupon_id, promo: c.stripe_live_promo_id });
const colsFor = (mode: StripeMode) => (mode === 'test' ? { coupon: 'stripe_test_coupon_id', promo: 'stripe_test_promo_id' } : { coupon: 'stripe_live_coupon_id', promo: 'stripe_live_promo_id' });

async function stripe(creds: StripeCreds, method: 'GET' | 'POST', path: string, body?: Record<string, string>, f: typeof fetch = fetch): Promise<{ ok: boolean; status: number; j: Record<string, unknown> & { error?: { message?: string; param?: string } } }> {
  const res = await f(`${STRIPE}${path}`, { method, headers: { Authorization: `Bearer ${creds.key}`, ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? new URLSearchParams(body).toString() : undefined });
  return { ok: res.ok, status: res.status, j: (await res.json().catch(() => ({}))) as never };
}

/** Create the Stripe coupon and promotion code for a row, in whichever mode this run is in. */
export async function pushToStripe(env: StripeEnv, sb: Sb, c: CouponRow, f: typeof fetch = fetch): Promise<{ ok: boolean; mode: StripeMode | null; error?: string }> {
  const { creds, reason } = stripeCredsFor(env);
  if (!creds) return { ok: false, mode: null, error: reason };
  const ids = idsFor(c, creds.mode), cols = colsFor(creds.mode);
  const fail = async (error: string) => { await sb.patch('coupons', `id=eq.${c.id}`, { last_error: error.slice(0, 300), updated_at: new Date().toISOString() }).catch(() => {}); return { ok: false, mode: creds.mode, error }; };
  if (ids.promo) return { ok: true, mode: creds.mode };
  let couponId = ids.coupon;
  if (!couponId) {
    const r = await stripe(creds, 'POST', '/coupons', couponParams(c), f);
    if (!r.ok || typeof r.j.id !== 'string') return fail(`Stripe (${creds.mode}) refused the coupon: ${r.j.error?.message ?? r.status}`);
    couponId = r.j.id;
    await sb.patch('coupons', `id=eq.${c.id}`, { [cols.coupon]: couponId, updated_at: new Date().toISOString() });
  }
  let p = await stripe(creds, 'POST', '/promotion_codes', promoParams(c, couponId), f);
  // Older API versions don't know promotion[type]; retry with the classic coupon parameter.
  if (!p.ok && /unknown parameter|promotion/i.test(p.j.error?.message ?? '') && !/already/i.test(p.j.error?.message ?? '')) p = await stripe(creds, 'POST', '/promotion_codes', promoParams(c, couponId, true), f);
  if (!p.ok && /already/i.test(p.j.error?.message ?? '')) {
    const ex = await stripe(creds, 'GET', `/promotion_codes?code=${encodeURIComponent(c.code)}&limit=1`, undefined, f);
    const hit = (ex.j.data as { id: string }[] | undefined)?.[0];
    if (hit) p = { ok: true, status: 200, j: { id: hit.id } };
  }
  if (!p.ok || typeof p.j.id !== 'string') return fail(`Stripe (${creds.mode}) refused the promotion code: ${p.j.error?.message ?? p.status}`);
  await sb.patch('coupons', `id=eq.${c.id}`, { [cols.promo]: p.j.id, last_error: null, updated_at: new Date().toISOString() });
  return { ok: true, mode: creds.mode };
}

/** Turn the promotion code on or off in this mode's Stripe. Never deletes. */
export async function setStripeActive(env: StripeEnv, c: CouponRow, active: boolean, f: typeof fetch = fetch): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const { creds, reason } = stripeCredsFor(env);
  if (!creds) return { ok: true, skipped: reason };
  const promo = idsFor(c, creds.mode).promo;
  if (!promo) return { ok: true, skipped: `Not in ${creds.mode} Stripe yet.` };
  const r = await stripe(creds, 'POST', `/promotion_codes/${promo}`, { active: String(active) }, f);
  return r.ok ? { ok: true } : { ok: false, error: `Stripe: ${r.j.error?.message ?? r.status}` };
}

/** How many times a code was redeemed in this mode's Stripe. */
export async function stripeRedemptions(env: StripeEnv, c: CouponRow, f: typeof fetch = fetch): Promise<number | null> {
  const { creds } = stripeCredsFor(env);
  const promo = creds ? idsFor(c, creds.mode).promo : null;
  if (!creds || !promo) return null;
  const r = await stripe(creds, 'GET', `/promotion_codes/${promo}`, undefined, f);
  return r.ok && typeof r.j.times_redeemed === 'number' ? r.j.times_redeemed : null;
}

/** Look up an active live promotion code by its text (checkout). Null if there isn't one. */
export async function findPromoId(key: string, code: string, f: typeof fetch = fetch): Promise<string | null> {
  const r = await stripe({ key, mode: key.startsWith('sk_test_') ? 'test' : 'live' }, 'GET', `/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1`, undefined, f);
  return (r.j.data as { id: string }[] | undefined)?.[0]?.id ?? null;
}

/** Promotion-code IDs an invoice used. Handles the legacy `discount` and the newer `discounts` array. Pure. */
export function promoIdsFromInvoice(inv: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const take = (d: unknown) => { if (d && typeof d === 'object') { const x = d as { promotion_code?: unknown; promotion?: { promotion_code?: unknown } }; const pc = x.promotion_code ?? x.promotion?.promotion_code; if (typeof pc === 'string') out.add(pc); else if (pc && typeof pc === 'object' && typeof (pc as { id?: unknown }).id === 'string') out.add((pc as { id: string }).id); } };
  take(inv.discount);
  if (Array.isArray(inv.discounts)) for (const d of inv.discounts) take(d);
  return [...out];
}

/** "20% off for 3 months" — the plain-English line for a code. Pure. */
export function describeCoupon(c: Pick<CouponRow, 'percent_off' | 'amount_off_usd' | 'duration' | 'duration_months'>): string {
  const what = c.percent_off != null ? `${Number(c.percent_off)}% off` : `$${Number(c.amount_off_usd)} off`;
  return c.percent_off === 100 && c.duration === 'once' ? 'first month free' : `${what}${c.duration === 'once' ? ', once' : c.duration === 'forever' ? ', forever' : ` for ${c.duration_months} month${c.duration_months === 1 ? '' : 's'}`}`;
}
