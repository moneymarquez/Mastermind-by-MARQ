import { describe, it, expect } from 'vitest';
import { stripeCredsFor, validateCouponInput, couponParams, promoParams, pushToStripe, setStripeActive, promoIdsFromInvoice, describeCoupon, findPromoId } from '../worker/lib/coupons';
import type { CouponRow } from '../worker/lib/coupons';

const row = (o: Partial<CouponRow> = {}): CouponRow => ({ id: 'c1', code: 'MARQ20', label: 'Promoter', owner_label: null, kind: 'promoter', percent_off: 20, amount_off_usd: null, duration: 'repeating', duration_months: 3, max_redemptions: null, expires_at: null, active: true, stripe_test_coupon_id: null, stripe_test_promo_id: null, stripe_live_coupon_id: null, stripe_live_promo_id: null, last_error: null, ...o });
const fakeSb = () => { const patches: Record<string, unknown>[] = []; return { patches, sb: { patch: async (_t: string, _f: string, b: Record<string, unknown>) => { patches.push(b); } } as never }; };
const stripeMock = (handler: (path: string, method: string, body: string) => { status?: number; json: unknown }) => {
  const calls: { path: string; method: string; body: string; auth: string }[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://api.stripe.com/v1', ''); const body = String(init.body ?? '');
    calls.push({ path, method: init.method ?? 'GET', body, auth: (init.headers as Record<string, string>).Authorization });
    const r = handler(path, init.method ?? 'GET', body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe('which Stripe key a run may use', () => {
  it('uses only the test key while test mode is on, never the live one', () => {
    expect(stripeCredsFor({ DRY_RUN: '1', STRIPE_SECRET_KEY: 'sk_live_x' }).creds).toBeNull();
    expect(stripeCredsFor({ DRY_RUN: '1', STRIPE_SECRET_KEY: 'sk_live_x' }).reason).toMatch(/STRIPE_TEST_SECRET_KEY/);
    expect(stripeCredsFor({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_live_oops' }).creds).toBeNull();
    expect(stripeCredsFor({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }).creds).toEqual({ key: 'sk_test_abc', mode: 'test' });
  });
  it('uses the live key when test mode is off', () => {
    expect(stripeCredsFor({ STRIPE_SECRET_KEY: 'sk_live_x' }).creds).toEqual({ key: 'sk_live_x', mode: 'live' });
    expect(stripeCredsFor({}).creds).toBeNull();
  });
});

describe('validateCouponInput', () => {
  it('accepts a percent code and upper-cases it', () => {
    expect(validateCouponInput({ code: 'james20', percent_off: '20', duration: 'repeating', duration_months: '3', owner_label: 'James' })).toMatchObject({ ok: true, value: { code: 'JAMES20', percent_off: 20, duration: 'repeating', duration_months: 3, owner_label: 'James' } });
  });
  it('needs exactly one of percent or dollars, a sane code, and months when repeating', () => {
    expect(validateCouponInput({ code: 'AB' }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC_1', percent_off: 10 }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC', percent_off: 10, amount_off_usd: 5 }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC' }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC', percent_off: 101 }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC', percent_off: 10, duration: 'repeating' }).ok).toBe(false);
    expect(validateCouponInput({ code: 'ABC', amount_off_usd: 5 }).ok).toBe(true);
  });
});

describe('Stripe request bodies', () => {
  it('builds the coupon: percent, duration, months and limit', () => {
    expect(couponParams(row({ max_redemptions: 20 }))).toMatchObject({ percent_off: '20', duration: 'repeating', duration_in_months: '3', max_redemptions: '20', name: 'Promoter' });
    expect(couponParams(row({ percent_off: null, amount_off_usd: 5, duration: 'once', duration_months: null }))).toMatchObject({ amount_off: '500', currency: 'usd', duration: 'once' });
  });
  it('builds the promotion code in the current and the classic shape', () => {
    const p = promoParams(row({ expires_at: '2026-12-31T00:00:00Z' }), 'co_1');
    expect(p).toMatchObject({ code: 'MARQ20', 'promotion[type]': 'coupon', 'promotion[coupon]': 'co_1' });
    expect(p.expires_at).toBe(String(Date.parse('2026-12-31T00:00:00Z') / 1000));
    expect(promoParams(row(), 'co_1', true)).toMatchObject({ coupon: 'co_1' });
  });
});

describe('pushToStripe', () => {
  it('in test mode creates the coupon then the promotion code and saves test IDs only', async () => {
    const { f, calls } = stripeMock((p) => (p === '/coupons' ? { json: { id: 'co_test' } } : { json: { id: 'promo_test' } }));
    const { sb, patches } = fakeSb();
    const r = await pushToStripe({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }, sb, row(), f);
    expect(r).toEqual({ ok: true, mode: 'test' });
    expect(calls.map((c) => c.path)).toEqual(['/coupons', '/promotion_codes']);
    expect(calls.every((c) => c.auth === 'Bearer sk_test_abc')).toBe(true);
    expect(patches.some((p) => p.stripe_test_coupon_id === 'co_test')).toBe(true);
    expect(patches.some((p) => p.stripe_test_promo_id === 'promo_test')).toBe(true);
    expect(patches.some((p) => 'stripe_live_promo_id' in p)).toBe(false);
  });
  it('does nothing in test mode without a test key (the live key is never used)', async () => {
    const { f, calls } = stripeMock(() => ({ json: {} }));
    const r = await pushToStripe({ DRY_RUN: '1', STRIPE_SECRET_KEY: 'sk_live_x' }, fakeSb().sb, row(), f);
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it('falls back to the classic coupon parameter on an older API version', async () => {
    let tries = 0;
    const { f, calls } = stripeMock((p) => {
      if (p === '/coupons') return { json: { id: 'co_1' } };
      return ++tries === 1 ? { status: 400, json: { error: { message: 'Received unknown parameter: promotion' } } } : { json: { id: 'promo_1' } };
    });
    const r = await pushToStripe({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }, fakeSb().sb, row(), f);
    expect(r.ok).toBe(true);
    expect(calls.at(-1)!.body).toContain('coupon=co_1');
  });
  it('is safe to repeat: an existing promotion code is not created twice', async () => {
    const { f, calls } = stripeMock(() => ({ json: {} }));
    const r = await pushToStripe({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }, fakeSb().sb, row({ stripe_test_coupon_id: 'co', stripe_test_promo_id: 'promo' }), f);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });
  it('keeps the error on the row when Stripe refuses', async () => {
    const { f } = stripeMock(() => ({ status: 400, json: { error: { message: 'Invalid percent_off' } } }));
    const { sb, patches } = fakeSb();
    const r = await pushToStripe({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }, sb, row(), f);
    expect(r.ok).toBe(false);
    expect(String(patches.at(-1)!.last_error)).toContain('Invalid percent_off');
  });
});

describe('deactivate and lookups', () => {
  it('deactivating turns the promotion code off and never deletes', async () => {
    const { f, calls } = stripeMock(() => ({ json: { id: 'promo' } }));
    const r = await setStripeActive({ DRY_RUN: '1', STRIPE_TEST_SECRET_KEY: 'sk_test_abc' }, row({ stripe_test_promo_id: 'promo_x' }), false, f);
    expect(r.ok).toBe(true);
    expect(calls[0]).toMatchObject({ path: '/promotion_codes/promo_x', method: 'POST' });
    expect(calls[0].body).toBe('active=false');
  });
  it('finds a live promotion code by its text for checkout', async () => {
    const { f, calls } = stripeMock(() => ({ json: { data: [{ id: 'promo_live' }] } }));
    expect(await findPromoId('sk_live_x', 'FOUNDING', f)).toBe('promo_live');
    expect(calls[0].path).toContain('code=FOUNDING');
    expect(calls[0].path).toContain('active=true');
  });
});

describe('promoIdsFromInvoice and describeCoupon', () => {
  it('reads promotion codes from the legacy discount and the discounts array', () => {
    expect(promoIdsFromInvoice({ discount: { promotion_code: 'promo_a' } })).toEqual(['promo_a']);
    expect(promoIdsFromInvoice({ discounts: [{ promotion_code: 'promo_b' }, { promotion: { promotion_code: 'promo_c' } }, 'di_123'] }).sort()).toEqual(['promo_b', 'promo_c']);
    expect(promoIdsFromInvoice({})).toEqual([]);
  });
  it('says it in plain English', () => {
    expect(describeCoupon({ percent_off: 20, amount_off_usd: null, duration: 'repeating', duration_months: 3 })).toBe('20% off for 3 months');
    expect(describeCoupon({ percent_off: 100, amount_off_usd: null, duration: 'once', duration_months: null })).toBe('first month free');
    expect(describeCoupon({ percent_off: null, amount_off_usd: 5, duration: 'forever', duration_months: null })).toBe('$5 off, forever');
  });
});
