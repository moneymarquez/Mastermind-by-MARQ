// Coupons (owner only). The Coupons screen reads its rows straight from the
// table (RLS); everything that touches Stripe goes through here.
//   GET  /api/coupons/status   which Stripe mode this run uses, and why not if none
//   POST /api/coupons/create   save a code, then push it to Stripe if a key is available
//   POST /api/coupons/push     push an existing draft to Stripe (this mode)
//   POST /api/coupons/toggle   activate / deactivate (Stripe too; never deletes)
//   POST /api/coupons/stats    per code: waitlist signups, Stripe redemptions, revenue
import { requireOwner } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { stripeCredsFor, validateCouponInput, pushToStripe, setStripeActive, stripeRedemptions, describeCoupon } from '../lib/coupons';
import type { StripeEnv, CouponRow } from '../lib/coupons';

export type CouponsEnv = SbEnv & StripeEnv;
const COLS = 'id,code,label,owner_label,kind,percent_off,amount_off_usd,duration,duration_months,max_redemptions,expires_at,active,stripe_test_coupon_id,stripe_test_promo_id,stripe_live_coupon_id,stripe_live_promo_id,last_error';

export async function couponsRoute(request: Request, env: CouponsEnv, action: string): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const sb = new Sb(env);
  const b = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const one = async (id: unknown) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? (await sb.get<CouponRow>(`coupons?id=eq.${id}&user_id=eq.${user.id}&select=${COLS}`))[0] : undefined);
  try {
    if (action === 'status') {
      const { creds, reason } = stripeCredsFor(env);
      return json({ mode: creds?.mode ?? null, reason });
    }
    if (action === 'create') {
      const v = validateCouponInput(b);
      if (!v.ok) return json({ error: v.error }, 400);
      const [dupe] = await sb.get<{ id: string }>(`coupons?user_id=eq.${user.id}&code=ilike.${encodeURIComponent(v.value.code)}&select=id`);
      if (dupe) return json({ error: `${v.value.code} already exists.` }, 409);
      const [row] = await sb.insert<CouponRow>('coupons', { user_id: user.id, ...v.value });
      const push = await pushToStripe(env, sb, row);
      return json({ ok: true, id: row.id, push });
    }
    if (action === 'push') {
      const c = await one(b.id);
      if (!c) return json({ error: 'That code is gone.' }, 404);
      const r = await pushToStripe(env, sb, c);
      return json(r, r.ok ? 200 : 409);
    }
    if (action === 'toggle') {
      const c = await one(b.id);
      if (!c) return json({ error: 'That code is gone.' }, 404);
      const active = !!b.active;
      await sb.patch('coupons', `id=eq.${c.id}&user_id=eq.${user.id}`, { active, updated_at: new Date().toISOString() });
      const r = await setStripeActive(env, c, active);
      return json({ ok: r.ok, active, stripe: r }, r.ok ? 200 : 502);
    }
    if (action === 'stats') {
      const rows = await sb.get<CouponRow>(`coupons?user_id=eq.${user.id}&select=${COLS}`);
      const wl = await sb.get<{ code: string }>('waitlist?code=not.is.null&select=code&limit=5000');
      const rev = await sb.get<{ coupon_id: string | null; amount_usd: number }>('coupon_revenue?select=coupon_id,amount_usd&limit=5000');
      const out: Record<string, { signups: number; redeemed: number | null; paid: number; revenue: number; summary: string }> = {};
      for (const c of rows) {
        const mine = rev.filter((r) => r.coupon_id === c.id);
        out[c.id] = { signups: wl.filter((w) => w.code === c.code.toUpperCase()).length, redeemed: await stripeRedemptions(env, c), paid: mine.length, revenue: Math.round(mine.reduce((s, r) => s + Number(r.amount_usd), 0) * 100) / 100, summary: describeCoupon(c) };
      }
      return json({ stats: out });
    }
    return json({ error: 'Unknown coupons action.' }, 404);
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
}
