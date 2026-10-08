// /api/setup/* and /api/connect/* — the in-app Setup page (Appendix 5 Part 2).
// Platform keys live as Cloudflare Worker secrets (build rule B5): this
// handler reports which exist (never their values), tests each with a real
// minimal call, and — when CF_API_TOKEN + CF_ACCOUNT_ID are set — writes new
// ones through Cloudflare's API. Account connections (per user) are sealed
// with lib/vault.ts into ai_user_tokens, which only the service role reads.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { signState, verifyState } from '../lib/vault';
import { loadToken, saveToken } from '../lib/tokens';
import { search as parallelSearch } from '../lib/parallel';
import { PLATFORM_SETUP, ACCOUNT_SETUP, WRITABLE_SECRETS } from '../../src/data/setupCatalog';
import { toE164 } from '../lib/phone';

export interface SetupEnv extends SbEnv {
  ANTHROPIC_API_KEY?: string; TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_FROM_NUMBER?: string; DIGEST_TO_NUMBER?: string;
  CF_API_TOKEN?: string; CF_ACCOUNT_ID?: string; CF_WORKER_NAME?: string; ETSY_API_KEY?: string; CJ_API_KEY?: string; HIGGSFIELD_API_KEY?: string;
  INSTAGRAM_APP_ID?: string; INSTAGRAM_APP_SECRET?: string; TIKTOK_CLIENT_KEY?: string; TIKTOK_CLIENT_SECRET?: string; TOKEN_ENCRYPTION_KEY?: string;
  XAI_API_KEY?: string; FACEBOOK_APP_ID?: string; FACEBOOK_APP_SECRET?: string; PARALLEL_API_KEY?: string;
}
type Env = SetupEnv & Record<string, string | undefined>;

// What each OAuth connection asks for. The publish scopes let the Publisher
// post approved content; accounts connected before they were added must
// reconnect (the Setup card says so when the saved scope is missing them).
export const IG_SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';
export const TIKTOK_SCOPES = 'user.info.basic,video.list,video.publish';
// pages_show_list rides along so the token can see which Pages it may post to.
export const FB_SCOPES = 'pages_manage_posts,pages_read_engagement,pages_show_list';
const FB = 'https://graph.facebook.com/v23.0';
const scopeNote = (tok: Record<string, string>, scope: string) => (tok.scope && tok.scope.split(/[\s,]+/).includes(scope) ? ' Can post on your approval.' : ' Can\'t post yet — Disconnect and Connect again to grant posting.');
interface TestResult { ok: boolean; detail: string }

const errText = async (res: Response) => { const t = await res.text().catch(() => ''); try { const j = JSON.parse(t) as { error?: { message?: string } | string; message?: string; errors?: { message: string }[] }; return (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? j.errors?.[0]?.message ?? t.slice(0, 200); } catch { return t.slice(0, 200); } };

// ── Twilio: send a real text, report exactly what Twilio said ─────────
// The old check looked the from-number up in IncomingPhoneNumbers and
// treated any failure as "not found". Now the test is the thing that
// matters — can this account send from TWILIO_FROM_NUMBER to
// DIGEST_TO_NUMBER — and every Twilio answer is shown as-is, with the
// Account SID cut to its first 6 characters and the token never shown.
async function testTwilio(env: Env): Promise<TestResult> {
  const r = await testTwilioInner(env);
  const sid = (env.TWILIO_ACCOUNT_SID ?? '').trim();
  return sid ? { ...r, detail: r.detail.split(sid).join(`${sid.slice(0, 6)}…`) } : r;
}
async function testTwilioInner(env: Env): Promise<TestResult> {
  const sid = (env.TWILIO_ACCOUNT_SID ?? '').trim();
  const token = (env.TWILIO_AUTH_TOKEN ?? '').trim();
  const fromSaved = (env.TWILIO_FROM_NUMBER ?? '').trim();
  const toSaved = (env.DIGEST_TO_NUMBER ?? '').trim();
  // Sent the way Twilio needs it (+1…), whatever form it was saved in.
  const from = toE164(fromSaved);
  const to = toE164(toSaved);
  const missing = [['TWILIO_ACCOUNT_SID', sid], ['TWILIO_AUTH_TOKEN', token], ['TWILIO_FROM_NUMBER', from], ['DIGEST_TO_NUMBER', to]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { ok: false, detail: `Missing: ${missing.join(', ')}.` };
  const sidShown = `${sid.slice(0, 6)}…`;
  const redact = (t: string) => t.split(sid).join(sidShown).replace(/\s+/g, ' ').slice(0, 400);
  const e164 = (n: string) => /^\+[1-9]\d{7,14}$/.test(n);
  const shown = (saved: string, sent: string) => (saved === sent ? sent : `${sent} (saved as ${saved}; the + is added automatically)`);
  const lines: string[] = [`Account SID ${sidShown}.`, `From ${shown(fromSaved, from)}${e164(from) ? '' : ' — not a valid phone number'} → to ${shown(toSaved, to)}${e164(to) ? '' : ' — not a valid phone number'}.`];
  const auth = { Authorization: `Basic ${btoa(`${sid}:${token}`)}` };
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;

  // Clue only (doesn't decide pass/fail): does this SID own the number?
  const look = await fetch(`${base}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`, { headers: auth }).catch(() => null);
  if (look) {
    const raw = await look.text().catch(() => '');
    let count: number | string = '?';
    try { count = ((JSON.parse(raw) as { incoming_phone_numbers?: unknown[] }).incoming_phone_numbers ?? []).length; } catch { /* not JSON */ }
    lines.push(`Lookup GET /IncomingPhoneNumbers.json?PhoneNumber=… → HTTP ${look.status}, ${count} match${count === 1 ? '' : 'es'}${look.ok ? '' : ` — raw: ${redact(raw)}`}.`);
  } else lines.push('Lookup request failed to reach Twilio.');

  // A2P 10DLC: texting anyone but yourself from a 10-digit number needs a
  // registered brand + campaign. Clue only; the send below decides.
  const brands = await fetch('https://messaging.twilio.com/v1/a2p/BrandRegistrations', { headers: auth }).catch(() => null);
  if (brands?.ok) {
    const bj = (await brands.json().catch(() => ({}))) as { data?: { status?: string }[]; results?: { status?: string }[] };
    const list = bj.data ?? bj.results ?? [];
    const approved = list.some((x) => /approved|verified/i.test(x.status ?? ''));
    lines.push(`10DLC: ${approved ? 'registered' : list.length ? `in review (${list.map((x) => x.status).join(', ')})` : 'not registered yet — texts to leads may be filtered until it is'}.`);
  } else lines.push('10DLC: couldn\'t check registration (fine for toll-free numbers).');

  // The real test: send one text.
  const send = await fetch(`${base}/Messages.json`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: 'Mastermind: Twilio test — if you got this, texts work.' }).toString(),
  }).catch(() => null);
  if (!send) return { ok: false, detail: [...lines, 'Send request failed to reach Twilio.'].join('\n') };
  const sendRaw = await send.text().catch(() => '');
  let msg: { sid?: string; status?: string; code?: number; message?: string; more_info?: string; error_code?: number | null; error_message?: string | null } = {};
  try { msg = JSON.parse(sendRaw); } catch { /* not JSON */ }
  if (!send.ok) {
    lines.push(`Send POST /Messages.json → HTTP ${send.status}, Twilio error ${msg.code ?? '?'}: ${redact(msg.message ?? sendRaw)}${msg.more_info ? ` (${msg.more_info})` : ''}.`);
    return { ok: false, detail: lines.join('\n') };
  }
  lines.push(`Send POST /Messages.json → HTTP ${send.status}, message ${msg.sid ?? '?'} ${msg.status ?? ''}.`);
  // Accepted isn't delivered: carriers can still refuse it (e.g. 30032, an
  // unverified toll-free number). Check back once.
  if (msg.sid) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await fetch(`${base}/Messages/${msg.sid}.json`, { headers: auth }).catch(() => null);
    const m = st?.ok ? ((await st.json().catch(() => ({}))) as typeof msg) : null;
    if (m) {
      lines.push(`After 4s: ${m.status}${m.error_code ? `, Twilio error ${m.error_code}${m.error_message ? `: ${redact(m.error_message)}` : ''} (https://www.twilio.com/docs/api/errors/${m.error_code})` : ''}.`);
      if (m.status === 'failed' || m.status === 'undelivered') return { ok: false, detail: lines.join('\n') };
    }
  }
  return { ok: true, detail: lines.join('\n') };
}

async function testPlatform(id: string, env: Env, sb: Sb): Promise<TestResult> {
  switch (id) {
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) return { ok: false, detail: 'ANTHROPIC_API_KEY is not set.' };
      const res = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
      return res.ok ? { ok: true, detail: 'Key accepted by the Anthropic API.' } : { ok: false, detail: `Anthropic ${res.status}: ${await errText(res)}` };
    }
    case 'twilio': return testTwilio(env);
    case 'cloudflare_secrets': {
      if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { ok: false, detail: 'CF_API_TOKEN and CF_ACCOUNT_ID must be added by hand once (see the steps).' };
      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; result?: { status?: string }; errors?: { message: string }[] };
      return j.success ? { ok: true, detail: `Token ${j.result?.status ?? 'valid'}. Save buttons on this page will write Worker secrets.` } : { ok: false, detail: `Cloudflare: ${j.errors?.[0]?.message ?? res.status}` };
    }
    case 'push':
      return env.VITE_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { ok: true, detail: `Keys present. ${await sb.count('push_subscriptions')} device subscription(s) on file.` }
        : { ok: false, detail: `Missing: ${[!env.VITE_VAPID_PUBLIC_KEY && 'VITE_VAPID_PUBLIC_KEY', !env.VAPID_PRIVATE_KEY && 'VAPID_PRIVATE_KEY'].filter(Boolean).join(', ')}.` };
    case 'etsy': {
      if (!env.ETSY_API_KEY) return { ok: false, detail: 'ETSY_API_KEY is not set.' };
      const res = await fetch('https://openapi.etsy.com/v3/application/openapi-ping', { headers: { 'x-api-key': env.ETSY_API_KEY } });
      return res.ok ? { ok: true, detail: 'Etsy answered the ping.' } : { ok: false, detail: `Etsy ${res.status}: ${await errText(res)}` };
    }
    case 'cj': {
      if (!env.CJ_API_KEY) return { ok: false, detail: 'CJ_API_KEY is not set.' };
      const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: env.CJ_API_KEY }) });
      const j = (await res.json().catch(() => ({}))) as { result?: boolean; message?: string };
      return j.result ? { ok: true, detail: 'CJ issued an access token.' } : { ok: false, detail: `CJ: ${j.message ?? res.status}` };
    }
    case 'xai': {
      if (!env.XAI_API_KEY) return { ok: false, detail: 'XAI_API_KEY is not set.' };
      const res = await fetch('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${env.XAI_API_KEY}` } });
      if (!res.ok) return { ok: false, detail: `xAI ${res.status}: ${await errText(res)}` };
      const j = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
      return { ok: true, detail: `Key works. ${(j.data ?? []).length} models available${j.data?.length ? ` (${j.data.slice(0, 3).map((m) => m.id).join(', ')}…)` : ''}.` };
    }
    case 'parallel': {
      if (!env.PARALLEL_API_KEY) return { ok: false, detail: 'PARALLEL_API_KEY is not set.' };
      try {
        const hits = await parallelSearch(env, { objective: 'What is Masterminds by MARQ? (connection test)', maxResults: 1 });
        return { ok: true, detail: `Parallel answered: ${hits.length} result${hits.length === 1 ? '' : 's'}. One search costs about half a cent.` };
      } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : String(e) }; }
    }
    case 'higgsfield':
      return env.HIGGSFIELD_API_KEY ? { ok: true, detail: 'Key saved. Checked on first real use (no free test call exists).' } : { ok: false, detail: 'HIGGSFIELD_API_KEY is not set.' };
    default:
      return { ok: false, detail: `Unknown provider ${id}.` };
  }
}

async function testAccount(id: string, tok: Record<string, string>): Promise<TestResult> {
  switch (id) {
    case 'github': {
      const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tok.token}`, 'User-Agent': 'mastermind-by-marq', Accept: 'application/vnd.github+json' } });
      if (!res.ok) return { ok: false, detail: `GitHub ${res.status}: ${await errText(res)}` };
      const u = (await res.json()) as { login: string };
      return { ok: true, detail: `Connected as ${u.login}.` };
    }
    case 'cloudflare_pages': {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${tok.account_id}/pages/projects`, { headers: { Authorization: `Bearer ${tok.token}` } });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; result?: unknown[]; errors?: { message: string }[] };
      return j.success ? { ok: true, detail: `Token can read Pages (${(j.result ?? []).length} project(s)).` } : { ok: false, detail: `Cloudflare: ${j.errors?.[0]?.message ?? res.status}` };
    }
    case 'shopify': {
      const shop = (tok.shop ?? '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!/\.myshopify\.com$/.test(shop)) return { ok: false, detail: 'Store domain must look like yourstore.myshopify.com.' };
      const res = await fetch(`https://${shop}/admin/api/2025-07/shop.json`, { headers: { 'X-Shopify-Access-Token': tok.token } });
      if (!res.ok) return { ok: false, detail: `Shopify ${res.status}: ${await errText(res)}` };
      const j = (await res.json()) as { shop: { name: string; plan_display_name?: string } };
      return { ok: true, detail: `Connected to ${j.shop.name}${j.shop.plan_display_name ? ` (${j.shop.plan_display_name})` : ''}.` };
    }
    case 'instagram': {
      const res = await fetch(`https://graph.instagram.com/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(tok.token)}`);
      if (!res.ok) return { ok: false, detail: `Instagram ${res.status}: ${await errText(res)}` };
      const j = (await res.json()) as { username: string; account_type?: string };
      return { ok: true, detail: `Connected as @${j.username}${j.account_type ? ` (${j.account_type})` : ''}.${scopeNote(tok, 'instagram_business_content_publish')}` };
    }
    case 'tiktok': {
      const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', { headers: { Authorization: `Bearer ${tok.token}` } });
      const j = (await res.json().catch(() => ({}))) as { data?: { user?: { display_name?: string } }; error?: { code?: string; message?: string } };
      return res.ok && (!j.error || j.error.code === 'ok') ? { ok: true, detail: `Connected as ${j.data?.user?.display_name ?? 'your TikTok'}.${scopeNote(tok, 'video.publish')}` } : { ok: false, detail: `TikTok: ${j.error?.message ?? res.status}` };
    }
    case 'facebook': {
      const res = await fetch(`${FB}/me/accounts?fields=name&limit=25&access_token=${encodeURIComponent(tok.token)}`);
      if (!res.ok) return { ok: false, detail: `Facebook ${res.status}: ${await errText(res)}` };
      const j = (await res.json()) as { data?: { name: string }[] };
      const pages = j.data ?? [];
      return pages.length ? { ok: true, detail: `Connected — ${pages.length} Page${pages.length === 1 ? '' : 's'}: ${pages.map((p) => p.name).join(', ')}.` } : { ok: false, detail: 'Connected, but no Pages were shared. Reconnect and tick the Pages to use.' };
    }
    default: return { ok: false, detail: `Unknown account ${id}.` };
  }
}

async function recordStatus(sb: Sb, userId: string, provider: string, r: TestResult) {
  await sb.insert('ai_connections', { user_id: userId, provider, status: r.ok ? 'connected' : 'failed', last_tested_at: new Date().toISOString(), note: r.detail.slice(0, 2000), updated_at: new Date().toISOString() }, { upsert: 'user_id,provider' }).catch((e) => console.error('ai_connections', e));
}

export async function setupRoute(request: Request, env: SetupEnv, path: string): Promise<Response> {
  const e = env as Env;
  const url = new URL(request.url);
  if (path === 'oauth/callback') return oauthCallback(request, e);
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const sb = new Sb(env);
  const owner = isOwnerUser(user);
  let b: Record<string, unknown> = {};
  if (request.method === 'POST') { try { b = (await request.json()) as Record<string, unknown>; } catch { b = {}; } }
  try {
    if (path === 'status') {
      const conns = await sb.get<{ provider: string; status: string; last_tested_at: string | null; note: string | null }>(`ai_connections?user_id=eq.${user.id}&select=provider,status,last_tested_at,note`);
      const tokens = await sb.get<{ provider: string; updated_at: string }>(`ai_user_tokens?user_id=eq.${user.id}&select=provider,updated_at`);
      return json({
        owner,
        canWriteSecrets: !!(e.CF_API_TOKEN && e.CF_ACCOUNT_ID),
        platform: owner ? PLATFORM_SETUP.map((p) => ({ id: p.id, present: p.fields.map((f) => ({ secret: f.secret, set: !!e[f.secret] })) })) : [],
        accounts: ACCOUNT_SETUP.map((a) => ({ id: a.id, connected: tokens.some((t) => t.provider === a.id), appReady: a.connect !== 'oauth' || a.fields.every((f) => !!e[f.secret]) })),
        connections: conns,
        encryption: e.TOKEN_ENCRYPTION_KEY ? 'dedicated key' : 'derived from the service key',
        replyWebhook: `${url.origin}/api/digest/reply`,
        smsWebhook: `${url.origin}/api/sms/inbound`,
        oauthRedirect: `${url.origin}/api/connect/oauth/callback`,
      });
    }
    if (path === 'test') {
      const id = String(b.provider ?? '');
      const acct = ACCOUNT_SETUP.find((a) => a.id === id);
      if (acct) {
        const tok = await loadToken(e, sb, user.id, id);
        const r = tok ? await testAccount(id, tok) : { ok: false, detail: 'Not connected yet.' };
        await recordStatus(sb, user.id, id, r);
        return json(r);
      }
      if (!owner) return json({ error: 'Platform keys are admin only.' }, 403);
      const r = await testPlatform(id, e, sb);
      await recordStatus(sb, user.id, id, r);
      return json(r);
    }
    if (path === 'secret') {
      if (!owner) return json({ error: 'Platform keys are admin only.' }, 403);
      const name = String(b.name ?? ''); const value = String(b.value ?? '').trim();
      if (!WRITABLE_SECRETS.includes(name)) return json({ error: `${name} is not a key this page manages.` }, 400);
      if (!value) return json({ error: 'Empty value.' }, 400);
      if (!e.CF_API_TOKEN || !e.CF_ACCOUNT_ID) return json({ error: 'This page can\'t save keys until CF_API_TOKEN and CF_ACCOUNT_ID are added by hand (Cloudflare card, step 4). Until then, add this one in Cloudflare → Workers & Pages → mastermind-by-marq → Settings → Variables and Secrets → Add → Secret.', manual: true }, 409);
      const script = e.CF_WORKER_NAME || 'mastermind-by-marq';
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${e.CF_ACCOUNT_ID}/workers/scripts/${script}/secrets`, { method: 'PUT', headers: { Authorization: `Bearer ${e.CF_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ name, text: value, type: 'secret_text' }) });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: { message: string }[] };
      if (!j.success) return json({ error: `Cloudflare refused: ${j.errors?.[0]?.message ?? res.status}` }, 502);
      return json({ ok: true, detail: `${name} saved as a Worker secret. It takes effect on the next request (a few seconds). Press Test.` });
    }
    if (path === 'token') {
      const id = String(b.provider ?? '');
      const entry = ACCOUNT_SETUP.find((a) => a.id === id && a.connect === 'token');
      if (!entry) return json({ error: 'Unknown token connection.' }, 400);
      const tok: Record<string, string> = {};
      for (const f of entry.fields) { const v = String((b.values as Record<string, unknown> | undefined)?.[f.secret] ?? '').trim(); if (!v && !f.optional) return json({ error: `${f.label} is required.` }, 400); if (v) tok[f.secret] = v; }
      const r = await testAccount(id, tok);
      if (r.ok) await saveToken(e, sb, user.id, id, tok, { tested: new Date().toISOString() });
      // Incoming order webhooks find their account by shop domain.
      if (r.ok && id === 'shopify') await sb.insert('ecom_shops', { user_id: user.id, shop_domain: tok.shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() }, { upsert: 'shop_domain' }).catch(() => {});
      await recordStatus(sb, user.id, id, r);
      return json(r, r.ok ? 200 : 400);
    }
    if (path === 'disconnect') {
      const id = String(b.provider ?? '');
      await sb.remove('ai_user_tokens', `user_id=eq.${user.id}&provider=eq.${id}`);
      await recordStatus(sb, user.id, id, { ok: false, detail: 'Disconnected.' });
      return json({ ok: true });
    }
    if (path === 'oauth/start') {
      const id = String(url.searchParams.get('provider') ?? b.provider ?? '');
      const redirect = `${url.origin}/api/connect/oauth/callback`;
      const state = await signState(e, { u: user.id, p: id });
      if (id === 'instagram') {
        if (!e.INSTAGRAM_APP_ID) return json({ error: 'Mastermind\'s Instagram app isn\'t set up yet (INSTAGRAM_APP_ID missing).' }, 409);
        return json({ url: `https://www.instagram.com/oauth/authorize?client_id=${e.INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${IG_SCOPES}&state=${state}` });
      }
      if (id === 'tiktok') {
        if (!e.TIKTOK_CLIENT_KEY) return json({ error: 'Mastermind\'s TikTok app isn\'t set up yet (TIKTOK_CLIENT_KEY missing).' }, 409);
        return json({ url: `https://www.tiktok.com/v2/auth/authorize/?client_key=${e.TIKTOK_CLIENT_KEY}&scope=${TIKTOK_SCOPES}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&state=${state}` });
      }
      if (id === 'facebook') {
        if (!e.FACEBOOK_APP_ID) return json({ error: 'Mastermind\'s Facebook app isn\'t set up yet (FACEBOOK_APP_ID missing).' }, 409);
        return json({ url: `https://www.facebook.com/v23.0/dialog/oauth?client_id=${e.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${FB_SCOPES}&state=${state}` });
      }
      return json({ error: 'That connection doesn\'t use OAuth.' }, 400);
    }
    return json({ error: `Unknown setup route ${path}` }, 404);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

/** Browser lands here from Instagram/TikTok/Facebook; no bearer token, so the signed
 *  state carries who started it. Always ends by sending the browser back to
 *  the Setup screen with ?connected= or ?connect_error=. */
async function oauthCallback(request: Request, e: Env): Promise<Response> {
  const url = new URL(request.url);
  const back = (q: string) => Response.redirect(`${url.origin}/?screen=setup&${q}`, 302);
  const st = await verifyState(e, url.searchParams.get('state') ?? '');
  if (!st) return back('connect_error=expired');
  const code = url.searchParams.get('code');
  if (!code) return back(`connect_error=${encodeURIComponent(url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'denied')}`);
  const redirect = `${url.origin}/api/connect/oauth/callback`;
  const sb = new Sb(e);
  try {
    let tok: Record<string, string>;
    if (st.p === 'instagram') {
      const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: new URLSearchParams({ client_id: e.INSTAGRAM_APP_ID ?? '', client_secret: e.INSTAGRAM_APP_SECRET ?? '', grant_type: 'authorization_code', redirect_uri: redirect, code }) });
      const raw = (await res.json()) as { access_token?: string; user_id?: string | number; permissions?: string | string[]; error_message?: string; data?: { access_token?: string; user_id?: string | number; permissions?: string | string[] }[] };
      const j = raw.data?.[0] ?? raw;
      if (!j.access_token) throw new Error(raw.error_message ?? `token exchange ${res.status}`);
      const long = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${e.INSTAGRAM_APP_SECRET}&access_token=${j.access_token}`);
      const lj = (await long.json()) as { access_token?: string; expires_in?: number };
      const perms = Array.isArray(j.permissions) ? j.permissions.join(',') : (j.permissions ?? IG_SCOPES);
      tok = { token: lj.access_token ?? j.access_token, user_id: String(j.user_id ?? ''), scope: perms, refreshed_at: new Date().toISOString(), expires_at: new Date(Date.now() + (lj.expires_in ?? 3600) * 1000).toISOString() };
    } else if (st.p === 'tiktok') {
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: e.TIKTOK_CLIENT_KEY ?? '', client_secret: e.TIKTOK_CLIENT_SECRET ?? '', code, grant_type: 'authorization_code', redirect_uri: redirect }) });
      const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string; error_description?: string };
      if (!j.access_token) throw new Error(j.error_description ?? `token exchange ${res.status}`);
      tok = { token: j.access_token, refresh_token: j.refresh_token ?? '', open_id: j.open_id ?? '', scope: j.scope ?? '', expires_at: new Date(Date.now() + (j.expires_in ?? 86400) * 1000).toISOString() };
    } else if (st.p === 'facebook') {
      const res = await fetch(`${FB}/oauth/access_token?client_id=${e.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${e.FACEBOOK_APP_SECRET}&code=${encodeURIComponent(code)}`);
      const j = (await res.json()) as { access_token?: string; error?: { message?: string } };
      if (!j.access_token) throw new Error(j.error?.message ?? `token exchange ${res.status}`);
      const long = await fetch(`${FB}/oauth/access_token?grant_type=fb_exchange_token&client_id=${e.FACEBOOK_APP_ID}&client_secret=${e.FACEBOOK_APP_SECRET}&fb_exchange_token=${j.access_token}`);
      const lj = (await long.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
      const perms = (await (await fetch(`${FB}/me/permissions?access_token=${lj.access_token ?? j.access_token}`)).json().catch(() => ({}))) as { data?: { permission: string; status: string }[] };
      tok = { token: lj.access_token ?? j.access_token, scope: (perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission).join(','), expires_at: lj.expires_in ? new Date(Date.now() + lj.expires_in * 1000).toISOString() : '' };
    } else throw new Error('unknown provider');
    await saveToken(e, sb, st.u, st.p, tok, { connected: new Date().toISOString(), scope: tok.scope });
    const r = await testAccount(st.p, tok);
    await recordStatus(sb, st.u, st.p, r);
    return back(`connected=${st.p}`);
  } catch (err) {
    return back(`connect_error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`);
  }
}
