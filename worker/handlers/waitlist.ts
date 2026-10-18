// Waitlist + site switches (Addendum 2 §1).
//   GET  /api/site/config      public: launch_mode, the founding offer and spots left
//   POST /api/waitlist         public: join the waitlist (honeypot + per-IP limit)
//   POST /api/waitlist/mode    owner: set launch_mode ('waitlist' | 'open')
//   POST /api/waitlist/sync    owner: push signups not yet in MailerLite
//   POST /api/waitlist/launch  owner: open the doors + a MailerLite campaign DRAFT to the list
// The signup is always saved. The MailerLite push, and anything that could
// email someone, follows DRY_RUN: while test mode is on, signups wait (marked
// unsynced) and the launch button only previews.
import { requireOwner, OWNER_USER_ID } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { isDryRun } from '../lib/dryRun';
import type { DryRunEnv } from '../lib/dryRun';
import { upsertSubscriber, createLaunchDraft, launchCampaignBody } from '../lib/mailerlite';
import type { MailerLiteEnv } from '../lib/mailerlite';
import { cleanWaitlistInput, foundingOffer, parseMode, DEFAULT_COPY } from '../lib/waitlist';
import type { SiteConfig } from '../lib/waitlist';
import { senderFor } from '../lib/senders';
import type { SenderEnv } from '../lib/senders';

export type WaitlistEnv = SbEnv & DryRunEnv & MailerLiteEnv & SenderEnv & { APP_ORIGIN?: string };
const now = () => new Date().toISOString();
const noStore = { 'cache-control': 'no-store' };

async function loadConfig(sb: Sb): Promise<SiteConfig> {
  const [[mode], [offer], [copy], taken] = await Promise.all([
    sb.get<{ value: unknown }>(`site_settings?user_id=eq.${OWNER_USER_ID}&key=eq.launch_mode&select=value`),
    sb.get<{ config: Record<string, unknown> }>(`launch_offers?user_id=eq.${OWNER_USER_ID}&key=eq.founding&select=config`),
    sb.get<{ value: { headline?: string; sub?: string } }>(`site_settings?user_id=eq.${OWNER_USER_ID}&key=eq.waitlist_copy&select=value`),
    sb.count(`waitlist?founding_spot=eq.true&select=id`).catch(() => 0),
  ]);
  return { launch_mode: parseMode(mode?.value), founding: foundingOffer(offer?.config, taken), copy: { headline: copy?.value?.headline || DEFAULT_COPY.headline, sub: copy?.value?.sub || DEFAULT_COPY.sub } };
}

export async function siteConfig(request: Request, env: WaitlistEnv): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 405);
  try { return new Response(JSON.stringify(await loadConfig(new Sb(env))), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' } }); }
  // Any trouble: the safe public state is the waitlist.
  catch { return new Response(JSON.stringify({ launch_mode: 'waitlist', founding: foundingOffer(null, 0), copy: DEFAULT_COPY }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
}

async function ipHash(env: SbEnv, request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${env.SUPABASE_SERVICE_ROLE_KEY.slice(-12)}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Push one stored signup to MailerLite. Never throws; the outcome is written on the row. */
export async function syncRow(env: WaitlistEnv, sb: Sb, row: { id: string; email: string; name: string | null; code: string | null; founding_spot: boolean }): Promise<'synced' | 'waiting' | 'failed'> {
  if (isDryRun(env)) return 'waiting';
  try {
    await upsertSubscriber(env, { email: row.email, name: row.name, founding: row.founding_spot, code: row.code });
    await sb.patch('waitlist', `id=eq.${row.id}`, { mailerlite_synced_at: now(), mailerlite_error: null });
    return 'synced';
  } catch (e) {
    await sb.patch('waitlist', `id=eq.${row.id}`, { mailerlite_error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }).catch(() => {});
    return 'failed';
  }
}

export async function waitlistJoin(request: Request, env: WaitlistEnv, ctx?: { waitUntil: (p: Promise<unknown>) => void }): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ error: 'Send the form as JSON.' }, 400);
  // Honeypot: a real person never fills the hidden "website" field. Bots get a fake success.
  if (String(b.website ?? '').trim()) return json({ ok: true, spot: 0, founding: false, already: false });
  const clean = cleanWaitlistInput(b);
  if (!clean.ok) return json({ error: clean.error }, 400);
  const v = clean.value;
  const sb = new Sb(env);
  const cfg = await loadConfig(sb).catch(() => null);
  const limit = cfg?.founding.limit ?? 100;
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/waitlist_join`, {
    method: 'POST', headers: sb.headers,
    body: JSON.stringify({ p_owner: OWNER_USER_ID, p_email: v.email, p_name: v.name, p_code: v.code, p_source: v.source, p_utm: v.utm, p_ip_hash: await ipHash(env, request), p_limit: limit }),
  });
  const out = (await res.json().catch(() => ({}))) as { spot?: number; founding?: boolean; existing?: boolean; message?: string };
  if (!res.ok) return json(/rate_limited/.test(out.message ?? '') ? { error: 'Too many signups from this connection. Try again in an hour.' } : { error: 'Couldn\'t save that. Try again in a moment.' }, /rate_limited/.test(out.message ?? '') ? 429 : 500);
  if (!out.existing) {
    const [row] = await sb.get<{ id: string; email: string; name: string | null; code: string | null; founding_spot: boolean }>(`waitlist?email=eq.${encodeURIComponent(v.email)}&select=id,email,name,code,founding_spot`);
    if (row) { const job = syncRow(env, sb, row); if (ctx) ctx.waitUntil(job); else await job; }
  }
  return new Response(JSON.stringify({ ok: true, spot: out.spot ?? 0, founding: !!out.founding, already: !!out.existing }), { headers: { 'content-type': 'application/json', ...noStore } });
}

export async function waitlistAdmin(request: Request, env: WaitlistEnv, action: string): Promise<Response> {
  const user = await requireOwner(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = new Sb(env);
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const setMode = (mode: string) => sb.insert('site_settings', { user_id: OWNER_USER_ID, key: 'launch_mode', value: mode, updated_at: now() }, { upsert: 'user_id,key' });
  try {
    if (action === 'mode') {
      const mode = parseMode(b.mode);
      await setMode(mode);
      return json({ ok: true, launch_mode: mode });
    }
    if (action === 'sync') {
      if (isDryRun(env)) { const n = await sb.count('waitlist?mailerlite_synced_at=is.null&select=id'); return json({ ok: true, dry_run: true, waiting: n, detail: `Test mode is on, so ${n} signup${n === 1 ? ' is' : 's are'} waiting. They go to MailerLite once test mode is off.` }); }
      const rows = await sb.get<{ id: string; email: string; name: string | null; code: string | null; founding_spot: boolean }>('waitlist?mailerlite_synced_at=is.null&select=id,email,name,code,founding_spot&order=spot_number.asc&limit=200');
      let synced = 0, failed = 0;
      for (const r of rows) { const o = await syncRow(env, sb, r); if (o === 'synced') synced++; else failed++; }
      return json({ ok: failed === 0, synced, failed, detail: `${synced} sent to MailerLite${failed ? `, ${failed} failed (see each row's error)` : ''}.` });
    }
    if (action === 'launch') {
      const fromEmail = (senderFor(env, 'app') ?? '').match(/<([^>]+)>/)?.[1] ?? 'hello@mastermindsbymarq.com';
      const link = `${env.APP_ORIGIN ?? new URL(request.url).origin}/?signup`;
      if (isDryRun(env)) {
        // Test mode: show exactly what would happen. Nothing is flipped or created.
        return json({ ok: true, dry_run: true, would: { launch_mode: 'open', campaign: launchCampaignBody({ groupId: '(Masterminds Waitlist)', fromEmail, link }) }, detail: 'Test mode is on: nothing changed. With test mode off, this opens the doors and creates the campaign draft in MailerLite.' });
      }
      const draft = await createLaunchDraft(env, { fromEmail, link });
      await setMode('open');
      return json({ ok: true, launch_mode: 'open', campaign_id: draft.id, detail: 'The site is open. A campaign draft to the whole waitlist is in MailerLite: review it and press Send there.' });
    }
    return json({ error: 'Unknown waitlist action.' }, 404);
  } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502); }
}
