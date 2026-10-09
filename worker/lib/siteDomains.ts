// A product site's own domain (addendum §5). Buying one costs money, so:
//   1. "Buy domain" → checkSpend → an approval in Inbox (~$10–15/yr).
//   2. Approved → the site shows "Buy {domain}" as a one-tap checklist step.
//      Cloudflare's API can manage domains already in the account but has
//      no public call to register a new one, so Marq buys it himself at
//      Cloudflare Registrar (decision logged in BUILD_DECISIONS.md).
//   3. "I bought it" → the expense lands in the Ledger.
//   4. "Connect" → the domain is attached to the site's Pages project with
//      the user's Pages token; "Check" flips it to active once Cloudflare
//      has verified it. Until then the site runs on its free *.pages.dev URL.
import type { Sb } from './sb';
import type { VaultEnv } from './vault';
import { loadToken } from './tokens';
import { guardSpend, recordSpend } from './controls';
import { isDryRun } from './dryRun';
import type { DryRunEnv } from './dryRun';

export const DOMAIN_COST_USD = 12;
const now = () => new Date().toISOString();
/** A registrable domain name (no scheme, no path). Pure. */
export const cleanDomain = (s: string) => (s ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
export const isDomain = (s: string) => /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(cleanDomain(s));

interface SiteRow { id: string; brand_id: string; slug: string; domain: string | null; domain_status: string; pages_project: string | null }
async function siteOf(sb: Sb, u: string, id: string): Promise<SiteRow> {
  const [s] = await sb.get<SiteRow>(`ecom_sites?id=eq.${id}&user_id=eq.${u}&select=id,brand_id,slug,domain,domain_status,pages_project`);
  if (!s) throw new Error('That site is gone.');
  return s;
}

export async function requestDomain(sb: Sb, u: string, siteId: string, domainIn: string): Promise<{ ok: boolean; status: string; detail: string }> {
  const domain = cleanDomain(domainIn);
  if (!isDomain(domain)) return { ok: false, status: 'invalid', detail: 'That doesn\'t look like a domain (e.g. voltgrip.com).' };
  const site = await siteOf(sb, u, siteId);
  // The first site's domain is allowed; every one after it waits for the first real sale.
  const [other] = await sb.get<{ id: string }>(`ecom_sites?user_id=eq.${u}&id=neq.${siteId}&domain_status=in.(proposed,awaiting_purchase,purchased,connecting,active)&select=id&limit=1`);
  const v = await guardSpend(sb, u, { bucket: 'ecommerce', label: `Domain ${domain}`, needsFirstSale: !!other }, DOMAIN_COST_USD, 'ecommerce');
  if (v.verdict === 'block') return { ok: false, status: 'blocked', detail: v.reason };
  await sb.patch('ecom_sites', `id=eq.${site.id}&user_id=eq.${u}`, { domain, domain_status: 'proposed', updated_at: now() });
  await sb.insert('ai_approvals', { user_id: u, domain: 'ecom', type: 'buy_domain', entity_type: 'brand', entity_id: site.brand_id, title: `Buy domain ${domain} (~$10–15/yr) for ${site.slug}`, payload: { site_id: site.id, domain, amount: DOMAIN_COST_USD, summary: `${site.slug} runs on its free pages.dev address until this is bought.` }, is_money: true, amount_usd: DOMAIN_COST_USD, confidence: 'hard' });
  return { ok: true, status: 'proposed', detail: `Waiting in Inbox: buy ${domain}.` };
}

/** Approval applier: the purchase is OK'd; it becomes a checklist step. */
export async function approveDomain(sb: Sb, u: string, raw: Record<string, unknown>): Promise<{ site_id: string; domain: string }> {
  const siteId = String(raw.site_id ?? ''), domain = cleanDomain(String(raw.domain ?? ''));
  if (!siteId || !isDomain(domain)) throw new Error('The approval has no site or domain.');
  await sb.patch('ecom_sites', `id=eq.${siteId}&user_id=eq.${u}`, { domain, domain_status: 'awaiting_purchase', updated_at: now() });
  return { site_id: siteId, domain };
}

export async function markPurchased(sb: Sb, u: string, siteId: string): Promise<{ ok: boolean; status: string; detail: string }> {
  const site = await siteOf(sb, u, siteId);
  if (!site.domain || site.domain_status !== 'awaiting_purchase') return { ok: false, status: site.domain_status, detail: 'Approve the domain in Inbox first.' };
  await sb.patch('ecom_sites', `id=eq.${site.id}&user_id=eq.${u}`, { domain_status: 'purchased', updated_at: now() });
  await recordSpend(sb, u, { bucket: 'ecommerce', label: `Domain ${site.domain}` }, DOMAIN_COST_USD, { type: 'ecom_site', id: site.id }).catch(() => {});
  return { ok: true, status: 'purchased', detail: `${site.domain} recorded in the Ledger. Next: Connect.` };
}

type Cf<T> = { success?: boolean; result?: T; errors?: { message: string }[] };
export async function connectDomain(env: VaultEnv & DryRunEnv, sb: Sb, u: string, siteId: string, check = false, f: typeof fetch = fetch): Promise<{ ok: boolean; status: string; detail: string }> {
  const site = await siteOf(sb, u, siteId);
  if (!site.domain || !['purchased', 'connecting', 'failed', 'active'].includes(site.domain_status)) return { ok: false, status: site.domain_status, detail: 'Buy the domain first, then tap "I bought it".' };
  if (!site.pages_project) return { ok: false, status: site.domain_status, detail: 'Launch the site first; the domain attaches to its Pages project.' };
  const tok = await loadToken(env, sb, u, 'cloudflare_pages');
  if (!tok?.token || !tok.account_id) return { ok: false, status: site.domain_status, detail: 'Cloudflare Pages isn\'t connected. Setup → Accounts → Cloudflare Pages.' };
  if (isDryRun(env)) return { ok: true, status: site.domain_status, detail: `Dry run: would attach ${site.domain} to Pages project ${site.pages_project}. Nothing changed.` };
  const base = `https://api.cloudflare.com/client/v4/accounts/${tok.account_id}/pages/projects/${site.pages_project}/domains`;
  const headers = { Authorization: `Bearer ${tok.token}`, 'content-type': 'application/json' };
  const res = check
    ? await f(`${base}/${site.domain}`, { headers })
    : await f(base, { method: 'POST', headers, body: JSON.stringify({ name: site.domain }) });
  const j = (await res.json().catch(() => ({}))) as Cf<{ status?: string; verification_data?: { status?: string; error_message?: string } }>;
  const already = !check && j.errors?.some((e) => /already/i.test(e.message));
  if (!j.success && !already) {
    const why = j.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    await sb.patch('ecom_sites', `id=eq.${site.id}&user_id=eq.${u}`, { domain_status: 'failed', last_error: why.slice(0, 500), updated_at: now() });
    return { ok: false, status: 'failed', detail: `Cloudflare: ${why}${res.status === 403 ? ' — the Pages token needs Account → Cloudflare Pages → Edit.' : ''}` };
  }
  const active = j.result?.status === 'active';
  await sb.patch('ecom_sites', `id=eq.${site.id}&user_id=eq.${u}`, { domain_status: active ? 'active' : 'connecting', last_error: null, updated_at: now() });
  return { ok: true, status: active ? 'active' : 'connecting', detail: active ? `${site.domain} is live on this site.` : `Attached. Cloudflare is verifying ${site.domain} (${j.result?.verification_data?.status ?? j.result?.status ?? 'pending'}); tap Check in a few minutes.` };
}
