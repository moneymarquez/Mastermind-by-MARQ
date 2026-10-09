import { describe, it, expect } from 'vitest';
import { resolveShopifyToken, shopifyMode, webhookSecretFor, clientCredentialsToken, shopifyGql, ShopifyAuthError } from '../worker/lib/shopify';

const okToken = (calls: { url: string; body: string }[], token = 'atk_new') => (async (url: string, init: RequestInit) => {
  calls.push({ url, body: String(init.body) });
  return new Response(JSON.stringify({ access_token: token, scope: 'read_orders,write_products', expires_in: 86399 }), { status: 200 });
}) as unknown as typeof fetch;

const client = { shop: 'https://MARQ-goods.myshopify.com/', client_id: 'cid', client_secret: 'csec' };
const NOW = Date.parse('2026-10-09T12:00:00Z');

describe('Shopify connection modes', () => {
  it('tells the two kinds of connection apart', () => {
    expect(shopifyMode({ shop: 'a.myshopify.com', token: 'shpat_x' })).toBe('token');
    expect(shopifyMode(client)).toBe('client');
    expect(shopifyMode({ shop: 'a.myshopify.com' })).toBeNull();
    expect(shopifyMode(null)).toBeNull();
  });
  it('signs webhooks with the client secret for Dev Dashboard apps, the API secret key otherwise', () => {
    expect(webhookSecretFor(client)).toBe('csec');
    expect(webhookSecretFor({ shop: 'a.myshopify.com', token: 'shpat_x', webhook_secret: 'wh' })).toBe('wh');
    expect(webhookSecretFor(null, 'env')).toBe('env');
  });
});

describe('client credentials grant', () => {
  it('posts the grant to the shop and returns the token', async () => {
    const calls: { url: string; body: string }[] = [];
    const t = await clientCredentialsToken('marq-goods.myshopify.com', 'cid', 'csec', okToken(calls));
    expect(calls[0].url).toBe('https://marq-goods.myshopify.com/admin/oauth/access_token');
    expect(calls[0].body).toContain('grant_type=client_credentials');
    expect(calls[0].body).toContain('client_id=cid');
    expect(t).toMatchObject({ access_token: 'atk_new', expires_in: 86399 });
  });
  it('explains a shop_not_permitted refusal', async () => {
    const f = (async () => new Response(JSON.stringify({ error: 'shop_not_permitted' }), { status: 400 })) as unknown as typeof fetch;
    await expect(clientCredentialsToken('a.myshopify.com', 'x', 'y', f)).rejects.toThrow(/same Shopify organization/);
  });
});

describe('resolveShopifyToken', () => {
  it('uses a legacy shpat_ token as is', async () => {
    const r = await resolveShopifyToken({ shop: 'a.myshopify.com', token: 'shpat_x' });
    expect(r).toEqual({ shop: 'a.myshopify.com', token: 'shpat_x', updated: null });
  });
  it('fetches a token the first time and caches it with its expiry', async () => {
    const calls: { url: string; body: string }[] = [];
    const r = await resolveShopifyToken(client, { now: NOW, fetch: okToken(calls) });
    expect(r.shop).toBe('marq-goods.myshopify.com');
    expect(r.token).toBe('atk_new');
    expect(r.updated?.access_expires_at).toBe(new Date(NOW + 86399 * 1000).toISOString());
    expect(calls).toHaveLength(1);
  });
  it('reuses a cached token that is still good', async () => {
    const calls: { url: string; body: string }[] = [];
    const cached = { ...client, access_token: 'atk_old', access_expires_at: new Date(NOW + 60 * 60 * 1000).toISOString() };
    const r = await resolveShopifyToken(cached, { now: NOW, fetch: okToken(calls) });
    expect(r.token).toBe('atk_old');
    expect(r.updated).toBeNull();
    expect(calls).toHaveLength(0);
  });
  it('refreshes 5 minutes before expiry, and when forced after a 401', async () => {
    const calls: { url: string; body: string }[] = [];
    const soon = { ...client, access_token: 'atk_old', access_expires_at: new Date(NOW + 2 * 60 * 1000).toISOString() };
    expect((await resolveShopifyToken(soon, { now: NOW, fetch: okToken(calls) })).token).toBe('atk_new');
    const fresh = { ...client, access_token: 'atk_old', access_expires_at: new Date(NOW + 10 * 60 * 60 * 1000).toISOString() };
    expect((await resolveShopifyToken(fresh, { now: NOW, force: true, fetch: okToken(calls, 'atk_forced') })).token).toBe('atk_forced');
    expect(calls).toHaveLength(2);
  });
  it('refuses a connection without a store domain', async () => {
    await expect(resolveShopifyToken({ token: 'shpat_x', shop: 'example.com' })).rejects.toThrow(/myshopify\.com/);
  });
});

describe('shopifyGql', () => {
  it('turns a 401 into ShopifyAuthError so the caller can refresh', async () => {
    const f = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    await expect(shopifyGql('a.myshopify.com', 't', '{ shop { name } }', {}, f)).rejects.toBeInstanceOf(ShopifyAuthError);
  });
});

import { missingScopes } from '../worker/lib/shopify';
describe('missingScopes', () => {
  it('lists the required scopes the install did not grant', () => {
    expect(missingScopes(['read_products', 'write_products'])).toEqual(['read_orders', 'write_publications', 'read_analytics']);
  });
  it('treats write_X as covering read_X', () => {
    expect(missingScopes(['write_orders', 'write_products', 'write_publications', 'read_analytics'])).toEqual([]);
  });
});
