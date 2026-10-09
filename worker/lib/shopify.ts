// The one way to talk to an owner's Shopify store (addendum §7). Every
// Admin API call — Launcher, order webhooks, webhook registration, the
// Setup test — gets its token through getShopifyToken / withShopify, never
// by reading the vault directly.
//
// Two kinds of connection, both sealed in the vault under provider "shopify":
//   (a) legacy custom app: { shop, token: "shpat_…" } — permanent token.
//   (b) Dev Dashboard app (every app created since Jan 1, 2026):
//       { shop, client_id, client_secret } — we run the client credentials
//       grant (POST https://{shop}/admin/oauth/access_token) for an Admin
//       API token that lives ~24h (expires_in 86399), cache it in the same
//       vault record (access_token, access_expires_at), and fetch a new one
//       5 minutes before it expires or on any 401.
// Webhook HMACs are signed with the app's secret: client_secret for (b),
// the "API secret key" (webhook_secret) for (a).
import type { Sb } from './sb';
import type { VaultEnv } from './vault';
import { loadToken, saveToken } from './tokens';
import type { Token } from './tokens';

export const SHOPIFY_API = '2025-07';
const REFRESH_EARLY_MS = 5 * 60 * 1000;

export const cleanShop = (s: string) => (s ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
export const isShopDomain = (s: string) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleanShop(s));
/** Which kind of connection a vault record is. Pure. */
export const shopifyMode = (tok: Token | null): 'token' | 'client' | null => (!tok ? null : tok.client_id && tok.client_secret ? 'client' : tok.token ? 'token' : null);
/** The secret Shopify signs this app's webhooks with. Pure. */
export const webhookSecretFor = (tok: Token | null, fallback = ''): string => (shopifyMode(tok) === 'client' ? tok!.client_secret : tok?.webhook_secret) || fallback;

export class ShopifyAuthError extends Error {}

/** Client credentials grant → { access_token, expires_in, scope }. */
export async function clientCredentialsToken(shop: string, clientId: string, clientSecret: string, f: typeof fetch = fetch): Promise<{ access_token: string; expires_in: number; scope: string }> {
  const res = await f(`https://${cleanShop(shop)}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string; errors?: string };
  if (!res.ok || !j.access_token) {
    const why = j.error_description || j.error || j.errors || `HTTP ${res.status}`;
    throw new ShopifyAuthError(`Shopify wouldn't issue a token: ${why}${/shop_not_permitted/.test(String(why)) ? ' — the app and the store have to be in the same Shopify organization.' : /invalid_client|401/.test(String(why)) ? ' — check the Client ID and Secret, and that the app is installed on this store.' : ''}`);
  }
  return { access_token: j.access_token, expires_in: j.expires_in ?? 86399, scope: j.scope ?? '' };
}

/** The usable token for a vault record, and the updated record when it
 *  had to fetch a new one (so the caller can save the cache). */
export async function resolveShopifyToken(tok: Token, opts: { force?: boolean; now?: number; fetch?: typeof fetch } = {}): Promise<{ shop: string; token: string; updated: Token | null }> {
  const shop = cleanShop(tok.shop);
  if (!isShopDomain(shop)) throw new Error('The Shopify connection needs the store domain (yourstore.myshopify.com). Reconnect it in Setup → Shopify.');
  const mode = shopifyMode(tok);
  if (mode === 'token') return { shop, token: tok.token, updated: null };
  if (mode !== 'client') throw new Error('Shopify isn\'t connected. Setup → Accounts → Shopify.');
  const now = opts.now ?? Date.now();
  const exp = Date.parse(tok.access_expires_at ?? '');
  if (!opts.force && tok.access_token && Number.isFinite(exp) && exp - REFRESH_EARLY_MS > now) return { shop, token: tok.access_token, updated: null };
  const t = await clientCredentialsToken(shop, tok.client_id, tok.client_secret, opts.fetch);
  const updated: Token = { ...tok, access_token: t.access_token, access_expires_at: new Date(now + t.expires_in * 1000).toISOString(), ...(t.scope ? { scope: t.scope } : {}) };
  return { shop, token: t.access_token, updated };
}

/** The Admin API token for a user's store, cached and refreshed. Null when not connected. */
export async function getShopifyToken(env: VaultEnv, sb: Sb, userId: string, opts: { force?: boolean } = {}): Promise<{ shop: string; token: string; record: Token } | null> {
  const tok = await loadToken(env, sb, userId, 'shopify');
  if (!shopifyMode(tok)) return null;
  const r = await resolveShopifyToken(tok!, opts);
  if (r.updated) await saveToken(env, sb, userId, 'shopify', r.updated, { refreshed: new Date().toISOString() }).catch(() => {});
  return { shop: r.shop, token: r.token, record: r.updated ?? tok! };
}

/** Run Admin API work with a token; on a 401 get a fresh token and try once more. */
export async function withShopify<T>(env: VaultEnv, sb: Sb, userId: string, fn: (shop: string, token: string, record: Token) => Promise<T>): Promise<T> {
  const first = await getShopifyToken(env, sb, userId);
  if (!first) throw new Error('Shopify isn\'t connected. Setup → Accounts → Shopify.');
  try { return await fn(first.shop, first.token, first.record); } catch (e) {
    if (!(e instanceof ShopifyAuthError) || shopifyMode(first.record) !== 'client') throw e;
    const again = await getShopifyToken(env, sb, userId, { force: true });
    return fn(again!.shop, again!.token, again!.record);
  }
}

/** Admin GraphQL. A 401 throws ShopifyAuthError so withShopify can refresh. */
export async function shopifyGql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}, f: typeof fetch = fetch): Promise<T> {
  const res = await f(`https://${cleanShop(shop)}/admin/api/${SHOPIFY_API}/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (res.status === 401) throw new ShopifyAuthError('Shopify rejected the token (401).');
  const j = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] | string };
  if (!res.ok || j.errors) {
    const msg = typeof j.errors === 'string' ? j.errors : j.errors?.map((e) => e.message).join('; ');
    throw new Error(`Shopify: ${msg || `HTTP ${res.status}`}${/access|scope|permission/i.test(msg ?? '') ? ' — the app needs read_orders, read_products, write_products, write_publications and read_analytics (Setup → Accounts → Shopify).' : ''}`);
  }
  return j.data as T;
}
