// E-commerce routes, October build.
//   POST /api/webhooks/shopify        orders/create + orders/fulfilled (HMAC-verified, no login)
//   GET  /api/ecom/client-stores      owner: every subscriber's stores, revenue, flags, last run
//   POST /api/ecom/video              "Make a video" for the picked direction (checkSpend)
//   POST /api/ecom/register-webhooks  subscribe the connected shop to order webhooks now
import { requireUser, isOwnerUser } from '../lib/auth';
import { requestDomain, markPurchased, connectDomain } from '../lib/siteDomains';
import type { DryRunEnv } from '../lib/dryRun';
import { getShopifyToken, withShopify, webhookSecretFor } from '../lib/shopify';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import type { VaultEnv } from '../lib/vault';
import { loadToken } from '../lib/tokens';
import { recordShopifyOrder, registerShopifyWebhooks, shopifyHmacValid } from '../lib/ecomOctober';
import type { ShopifyOrder } from '../lib/ecomOctober';
import { makeVideo } from '../lib/visual';

export type EcomEnv = SbEnv & VaultEnv & DryRunEnv & { SHOPIFY_WEBHOOK_SECRET?: string; APP_ORIGIN?: string };
const cleanShop = (s: string) => s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

export async function shopifyWebhook(request: Request, env: EcomEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  const raw = await request.text();
  const shop = cleanShop(request.headers.get('x-shopify-shop-domain') ?? '');
  const topic = request.headers.get('x-shopify-topic') ?? '';
  const sb = new Sb(env);
  const [owner] = shop ? await sb.get<{ user_id: string }>(`ecom_shops?shop_domain=eq.${encodeURIComponent(shop)}&select=user_id`) : [];
  if (!owner) return new Response('Unknown shop', { status: 404 });
  const tok = await loadToken(env, sb, owner.user_id, 'shopify');
  const secret = webhookSecretFor(tok, env.SHOPIFY_WEBHOOK_SECRET ?? '');
  if (!(await shopifyHmacValid(secret, raw, request.headers.get('x-shopify-hmac-sha256')))) return new Response('Bad signature', { status: 401 });
  let order: ShopifyOrder;
  try { order = JSON.parse(raw) as ShopifyOrder; } catch { return new Response('Bad JSON', { status: 400 }); }
  if (topic === 'orders/fulfilled') {
    await sb.patch('ecom_orders', `user_id=eq.${owner.user_id}&external_id=eq.${order.id}`, { fulfillment_status: 'fulfilled', updated_at: new Date().toISOString() }).catch(() => {});
    return json({ ok: true });
  }
  const r = await recordShopifyOrder(sb, owner.user_id, shop, order);
  return json({ ok: true, ...r });
}

/** POST /api/ecom/beacon — public, no login. Every generated product site
 *  sends {site, event: 'view' | 'buy_click'} here with navigator.sendBeacon
 *  (text/plain, so no CORS preflight). Counts only for a live site's slug. */
export async function siteBeacon(request: Request, env: EcomEnv): Promise<Response> {
  const cors = { 'access-control-allow-origin': '*' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  const text = (await request.text().catch(() => '')).slice(0, 500);
  let b: { site?: unknown; event?: unknown } = {};
  try { b = JSON.parse(text); } catch { return new Response(null, { status: 204, headers: cors }); }
  const slug = String(b.site ?? '');
  const event = b.event === 'buy_click' ? 'buy_click' : b.event === 'view' ? 'view' : '';
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !event) return new Response(null, { status: 204, headers: cors });
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/ecom_site_hit`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_slug: slug, p_event: event }) }).catch(() => {});
  return new Response(null, { status: 204, headers: cors });
}

export async function ecomRoute(request: Request, env: EcomEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const sb = new Sb(env);
  const b = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
  try {
    if (path === 'video') {
      const brandId = String(b.brand_id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(brandId) || !String(b.prompt ?? '').trim()) return json({ error: 'brand_id and prompt are required.' }, 400);
      return json(await makeVideo(sb, user.id, brandId, String(b.prompt), b.resolution === '720p' ? '720p' : '480p'));
    }
    if (path === 'site-domain') {
      const siteId = String(b.site_id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(siteId)) return json({ error: 'site_id is required.' }, 400);
      const action = String(b.action ?? '');
      const r = action === 'request' ? await requestDomain(sb, user.id, siteId, String(b.domain ?? ''))
        : action === 'purchased' ? await markPurchased(sb, user.id, siteId)
        : action === 'connect' || action === 'check' ? await connectDomain(env, sb, user.id, siteId, action === 'check')
        : null;
      if (!r) return json({ error: 'action must be request, purchased, connect or check.' }, 400);
      return json(r, r.ok ? 200 : 409);
    }
    if (path === 'register-webhooks') {
      const conn = await getShopifyToken(env, sb, user.id).catch(() => null);
      if (!conn) return json({ error: 'Shopify isn\'t connected. Setup → Accounts → Shopify.' }, 409);
      const shop = conn.shop;
      const r = await withShopify(env, sb, user.id, (sh, t) => registerShopifyWebhooks(sh, t, `${env.APP_ORIGIN ?? new URL(request.url).origin}/api/webhooks/shopify`));
      await sb.insert('ecom_shops', { user_id: user.id, shop_domain: shop, webhooks_registered_at: r.ok ? new Date().toISOString() : null }, { upsert: 'shop_domain' }).catch(() => {});
      return json(r, r.ok ? 200 : 502);
    }
    if (path === 'client-stores') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      // Every other account with a brand: read-only roster for Marq.
      const brands = await sb.get<{ id: string; user_id: string; name: string; current_step: number; health: string; last_activity_at: string }>(`ecom_brands?user_id=neq.${user.id}&select=id,user_id,name,current_step,health,last_activity_at&order=last_activity_at.desc&limit=300`);
      const users = [...new Set(brands.map((x) => x.user_id))];
      if (!users.length) return json({ clients: [] });
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [profiles, orders, flags, runs, builds] = await Promise.all([
        sb.get<{ id: string; display_name: string | null; email?: string | null }>(`profiles?id=in.(${users.join(',')})&select=id,display_name`),
        sb.get<{ user_id: string; brand_id: string; total: number }>(`ecom_orders?user_id=in.(${users.join(',')})&placed_at=gte.${since}&select=user_id,brand_id,total`),
        sb.get<{ user_id: string; severity: string }>(`ai_flags?user_id=in.(${users.join(',')})&resolved_at=is.null&select=user_id,severity`),
        sb.get<{ user_id: string; created_at: string; status: string }>(`ai_worker_runs?user_id=in.(${users.join(',')})&order=created_at.desc&limit=500&select=user_id,created_at,status`),
        sb.get<{ brand_id: string; live_url: string | null }>(`ecom_store_builds?user_id=in.(${users.join(',')})&live_url=not.is.null&select=brand_id,live_url`),
      ]);
      const clients = users.map((uid) => ({
        user_id: uid, name: profiles.find((p) => p.id === uid)?.display_name ?? 'Subscriber',
        stores: brands.filter((x) => x.user_id === uid).map((x) => ({ ...x, live_url: builds.find((bb) => bb.brand_id === x.id)?.live_url ?? null, revenue30: orders.filter((o) => o.brand_id === x.id).reduce((s, o) => s + Number(o.total), 0), orders30: orders.filter((o) => o.brand_id === x.id).length })),
        revenue30: orders.filter((o) => o.user_id === uid).reduce((s, o) => s + Number(o.total), 0),
        red: flags.filter((f) => f.user_id === uid && f.severity === 'red').length, amber: flags.filter((f) => f.user_id === uid && f.severity === 'amber').length,
        last_run: runs.find((r) => r.user_id === uid) ?? null,
      }));
      return json({ clients });
    }
    return json({ error: `Unknown e-commerce route ${path}` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
