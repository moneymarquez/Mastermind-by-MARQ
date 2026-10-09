// The one status system (brief §2c): pure rules that turn facts about the
// business into amber/red flags, plus the cron runner that stores them in
// ai_flags. Every list in E-commerce, Content, Made by Marq and HQ sorts by
// these, and HQ is the only thing that tells Marq about them.
//
// The rules are pure (evaluateFlags/diffFlags) and tested in
// tests/flags.test.ts; runFlagsTick gathers the facts with the service role
// on the five-minute cron.
import { Sb } from './sb';
import { DEFAULT_CAPS, AI_MONTHLY_ALERT_USD, spentInGroup } from './controls';
import type { SpendBucket } from './controls';
import type { SbEnv } from './sb';

export type FlagDomain = 'ecommerce' | 'content' | 'marketing' | 'master' | 'madeby' | 'personal';
export type Severity = 'amber' | 'red';
export interface FlagDraft { domain: FlagDomain; entity_type: string; entity_id: string; severity: Severity; rule: string; message: string; link?: string | null }

/** Every threshold in one object so Marq can tune them (system_controls.flag_thresholds overrides). */
export const DEFAULT_THRESHOLDS = {
  approvalAmberHours: 48,
  approvalRedHours: 96,
  stalledHours: 26,
  failuresAmber: 2,
  failuresRed: 3,
  noOrdersAmberDays: 7,
  noOrdersRedDays: 14,
  spendAmberPct: 0.8,
  /** Share of the week's orders with no site attribution before tracking counts as broken. */
  unattributedPct: 0.2,
};
export type Thresholds = typeof DEFAULT_THRESHOLDS;
export function thresholdsFrom(raw: unknown): Thresholds {
  const t = { ...DEFAULT_THRESHOLDS };
  if (raw && typeof raw === 'object') for (const k of Object.keys(t) as (keyof Thresholds)[]) {
    const v = Number((raw as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v > 0) t[k] = v;
  }
  return t;
}

const ENGINE_TO_FLAG: Record<string, FlagDomain> = { ecom: 'ecommerce', content: 'content', marketing: 'marketing', all: 'master', digest: 'master' };
export const flagDomainOf = (engineDomain: string): FlagDomain => ENGINE_TO_FLAG[engineDomain] ?? 'master';

export interface FlagFacts {
  now: number;
  approvals: { id: string; domain: string; title: string; created_at: string }[];
  /** Live, enabled, scheduled workers: when they last succeeded and how many runs in a row failed. */
  workers: { id: string; key: string; name: string; domain: string; scheduled: boolean; lastSuccessAt: string | null; failStreak: number }[];
  stores: { brand_id: string; name: string; launched_at: string; orders: number }[];
  funnels: { brand_id: string; name: string; flag: string }[];
  publishFailed: { id: string; concept: string; error: string | null }[];
  connections: { provider: string; status: string; note: string | null }[];
  /** Spend this period vs cap, per domain (daily AI caps) and per bucket (monthly). */
  spend: { key: string; label: string; spent: number; cap: number; domain: FlagDomain; /** a heads-up at the number, not a block */ alertOnly?: boolean }[];
  flops: { id: string; account: string; hook: string | null }[];
  /** Last 7 days of Shopify orders: how many, and how many no site could claim. */
  attribution?: { orders: number; unattributed: number };
}

const hoursSince = (iso: string | null, now: number) => (iso ? (now - new Date(iso).getTime()) / 3600000 : Infinity);
const money = (n: number) => `$${n.toFixed(2)}`;

export function evaluateFlags(f: FlagFacts, t: Thresholds = DEFAULT_THRESHOLDS): FlagDraft[] {
  const out: FlagDraft[] = [];
  for (const a of f.approvals) {
    const h = hoursSince(a.created_at, f.now);
    if (h > t.approvalAmberHours) out.push({ domain: flagDomainOf(a.domain), entity_type: 'approval', entity_id: a.id, severity: h > t.approvalRedHours ? 'red' : 'amber', rule: 'approval_waiting', message: `Waiting on you ${Math.floor(h / 24)}d: ${a.title}`.slice(0, 300), link: 'approvals' });
  }
  for (const w of f.workers) {
    const d = flagDomainOf(w.domain);
    if (w.failStreak >= t.failuresAmber) out.push({ domain: d, entity_type: 'worker', entity_id: w.id, severity: w.failStreak >= t.failuresRed ? 'red' : 'amber', rule: 'worker_failing', message: `${w.name} failed ${w.failStreak} runs in a row`, link: 'office' });
    else if (w.scheduled && hoursSince(w.lastSuccessAt, f.now) > t.stalledHours) out.push({ domain: d, entity_type: 'worker', entity_id: w.id, severity: 'red', rule: 'worker_stalled', message: w.lastSuccessAt ? `${w.name} stalled — no successful run in ${Math.floor(hoursSince(w.lastSuccessAt, f.now))}h` : `${w.name} stalled — it has never finished a run`, link: 'office' });
  }
  for (const s of f.stores) {
    if (s.orders > 0) continue;
    const days = hoursSince(s.launched_at, f.now) / 24;
    if (days >= t.noOrdersAmberDays) out.push({ domain: 'ecommerce', entity_type: 'brand', entity_id: s.brand_id, severity: days >= t.noOrdersRedDays ? 'red' : 'amber', rule: 'store_no_orders', message: `${s.name}: live ${Math.floor(days)} days, no orders yet`, link: 'stores' });
  }
  for (const b of f.funnels) {
    if (b.flag === 'kill' || b.flag === 'fix') out.push({ domain: 'ecommerce', entity_type: 'brand', entity_id: b.brand_id, severity: b.flag === 'kill' ? 'red' : 'amber', rule: 'funnel', message: `${b.name}: funnel says ${b.flag}`, link: 'stores' });
  }
  for (const p of f.publishFailed) out.push({ domain: 'content', entity_type: 'content_item', entity_id: p.id, severity: 'red', rule: 'publish_failed', message: `Not posted: ${p.concept.slice(0, 80)}${p.error ? ` — ${p.error.slice(0, 120)}` : ''}`, link: 'content' });
  for (const c of f.connections) {
    if (c.status !== 'failed') continue;
    if (/disconnected/i.test(c.note ?? '')) continue;
    out.push({ domain: 'master', entity_type: 'connection', entity_id: c.provider, severity: 'red', rule: 'connection_broken', message: `${c.provider} connection is failing: ${(c.note ?? 'test failed').slice(0, 160)}`, link: 'setup' });
  }
  for (const s of f.spend) {
    if (s.cap <= 0) continue;
    const pct = s.spent / s.cap;
    // An alert-only number (Anthropic's $40/month) is an amber heads-up when reached, never red or a block.
    if (s.alertOnly) { if (pct >= 1) out.push({ domain: s.domain, entity_type: 'spend', entity_id: s.key, severity: 'amber', rule: 'spend_alert', message: `${s.label}: ${money(s.spent)} (alert at ${money(s.cap)})`, link: 'hq' }); continue; }
    if (pct >= t.spendAmberPct) out.push({ domain: s.domain, entity_type: 'spend', entity_id: s.key, severity: pct >= 1 ? 'red' : 'amber', rule: 'spend_cap', message: `${s.label}: ${money(s.spent)} of ${money(s.cap)}${pct >= 1 ? ' — cap reached' : ` (${Math.round(pct * 100)}%)`}`, link: 'hq' });
  }
  for (const p of f.flops) out.push({ domain: 'content', entity_type: 'social_post', entity_id: p.id, severity: 'amber', rule: 'post_flop', message: `Flop on @${p.account}: ${(p.hook ?? 'post').slice(0, 80)}`, link: 'content' });
  const at = f.attribution;
  if (at && at.orders >= 5 && at.unattributed / at.orders > t.unattributedPct) out.push({ domain: 'ecommerce', entity_type: 'tracking', entity_id: 'site_attribution', severity: 'amber', rule: 'unattributed_orders', message: `${at.unattributed} of ${at.orders} orders this week came from no known site — site tracking may be broken`, link: 'ecom-orders' });
  return out;
}

export interface OpenFlag { id: string; rule: string; entity_type: string; entity_id: string; severity: Severity; message: string }
const keyOf = (x: { rule: string; entity_type: string; entity_id: string }) => `${x.rule}|${x.entity_type}|${x.entity_id}`;

/** What to insert, update and resolve so ai_flags matches the drafts. */
export function diffFlags(open: OpenFlag[], drafts: FlagDraft[]): { insert: FlagDraft[]; update: { id: string; severity: Severity; message: string }[]; resolve: string[] } {
  const openBy = new Map(open.map((o) => [keyOf(o), o]));
  const seen = new Set<string>();
  const insert: FlagDraft[] = [], update: { id: string; severity: Severity; message: string }[] = [];
  for (const d of drafts) {
    const k = keyOf(d);
    if (seen.has(k)) continue;
    seen.add(k);
    const o = openBy.get(k);
    if (!o) insert.push(d);
    else if (o.severity !== d.severity || o.message !== d.message) update.push({ id: o.id, severity: d.severity, message: d.message });
  }
  return { insert, update, resolve: open.filter((o) => !seen.has(keyOf(o))).map((o) => o.id) };
}

/** Red first, then amber, then everything else; stable otherwise. */
export function bySeverity<T>(rows: T[], sev: (r: T) => Severity | null | undefined): T[] {
  const rank = (s: Severity | null | undefined) => (s === 'red' ? 0 : s === 'amber' ? 1 : 2);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(sev(a.r)) - rank(sev(b.r)) || a.i - b.i).map((x) => x.r);
}

/** Two corrections are "the same" when their normalized words match. */
export function correctionKey(reason: string): string {
  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'it', 'this', 'that', 'to', 'of', 'and', 'too', 'not', 'isn', 'aren', 'wasn', 'don', 'doesn', 'be', 'was', 'for', 'in', 'on']);
  return reason.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, '')).sort().join(' ').slice(0, 200);
}

// ── Cron runner ───────────────────────────────────────────────────────
const SCHEDULED_KEYS = new Set(['scout', 'analyst', 'lead_filter', 'inbound_tracker', 'content_analytics', 'orchestrator']);

export async function gatherFacts(sb: Sb, u: string, now = Date.now()): Promise<{ facts: FlagFacts; thresholds: Thresholds }> {
  const since30 = new Date(now - 30 * 86400000).toISOString();
  const since7 = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const month = new Date(now).toISOString().slice(0, 7);
  const today = new Date(now).toISOString().slice(0, 10);
  const [approvals, workers, runs, builds, reads, failedItems, conns, controls, caps, ledger, aiSpend, flops, aiMonth] = await Promise.all([
    sb.get<{ id: string; domain: string; title: string; created_at: string }>(`ai_approvals?user_id=eq.${u}&status=eq.pending&select=id,domain,title,created_at&limit=200`),
    sb.get<{ id: string; key: string; name: string; domain: string; enabled: boolean }>(`ai_workers?user_id=eq.${u}&enabled=eq.true&select=id,key,name,domain,enabled`),
    sb.get<{ worker_id: string; status: string; created_at: string }>(`ai_worker_runs?user_id=eq.${u}&created_at=gte.${since30}&order=created_at.desc&select=worker_id,status,created_at&limit=2000`),
    sb.get<{ brand_id: string; launched_at: string | null }>(`ecom_store_builds?user_id=eq.${u}&launched_at=not.is.null&select=brand_id,launched_at`),
    sb.get<{ entity_id: string; payload: { flag?: string }; status: string; created_at: string }>(`ai_approvals?user_id=eq.${u}&type=eq.brand_read&order=created_at.desc&select=entity_id,payload,status,created_at&limit=50`),
    sb.get<{ id: string; concept: string; publish_error: string | null }>(`content_items?user_id=eq.${u}&publish_status=eq.failed&select=id,concept,publish_error&limit=50`),
    sb.get<{ provider: string; status: string; note: string | null }>(`ai_connections?user_id=eq.${u}&select=provider,status,note`),
    sb.get<{ flag_thresholds: unknown; monthly_caps: Record<string, number> }>(`system_controls?user_id=eq.${u}&select=flag_thresholds,monthly_caps`),
    sb.get<{ domain: string; daily_cap_usd: number }>(`ai_domain_caps?user_id=eq.${u}&select=domain,daily_cap_usd`),
    sb.get<{ bucket: string | null; amount_usd: number }>(`biz_ledger?user_id=eq.${u}&kind=eq.expense&date=gte.${month}-01&bucket=not.is.null&select=bucket,amount_usd`),
    sb.get<{ domain: string; cost_usd: number }>(`ai_cost_ledger?user_id=eq.${u}&date=eq.${today}&select=domain,cost_usd`),
    sb.get<{ id: string; account_id: string; hook: string | null }>(`social_posts?user_id=eq.${u}&grade=eq.1&posted_at=gte.${since7}&select=id,account_id,hook&limit=20`),
    sb.get<{ cost_usd: number }>(`ai_cost_ledger?user_id=eq.${u}&date=gte.${month}-01&select=cost_usd&limit=5000`),
  ]);
  const brandIds = [...new Set([...builds.map((b) => b.brand_id), ...reads.map((r) => r.entity_id)])];
  const week = await sb.get<{ site_id: string | null }>(`ecom_orders?user_id=eq.${u}&placed_at=gte.${new Date(now - 7 * 86400000).toISOString()}&select=site_id&limit=2000`).catch(() => []);
  const [brands, orders, accts] = await Promise.all([
    brandIds.length ? sb.get<{ id: string; name: string }>(`ecom_brands?id=in.(${brandIds.join(',')})&select=id,name`) : Promise.resolve([]),
    brandIds.length ? sb.get<{ brand_id: string; placed_at: string }>(`ecom_orders?user_id=eq.${u}&brand_id=in.(${brandIds.join(',')})&select=brand_id,placed_at&limit=2000`) : Promise.resolve([]),
    flops.length ? sb.get<{ id: string; handle: string }>(`social_accounts?id=in.(${[...new Set(flops.map((f) => f.account_id))].join(',')})&select=id,handle`) : Promise.resolve([]),
  ]);
  const nameOf = (id: string) => brands.find((b) => b.id === id)?.name ?? 'Store';
  const lastBuild = new Map<string, string>();
  for (const b of builds) if (b.launched_at && (!lastBuild.has(b.brand_id) || b.launched_at < lastBuild.get(b.brand_id)!)) lastBuild.set(b.brand_id, b.launched_at);
  const latestRead = new Map<string, string>();
  for (const r of reads) if (!latestRead.has(r.entity_id) && r.status !== 'killed') latestRead.set(r.entity_id, String(r.payload?.flag ?? ''));
  const capOf = (d: string) => Number(caps.find((c) => c.domain === d)?.daily_cap_usd ?? 1);
  const spend: FlagFacts['spend'] = ['ecom', 'content', 'marketing'].map((d) => ({ key: `ai:${d}`, label: `AI spend today (${d === 'ecom' ? 'e-commerce' : d})`, spent: aiSpend.filter((r) => r.domain === d).reduce((s, r) => s + Number(r.cost_usd), 0), cap: capOf(d), domain: flagDomainOf(d) }));
  const monthly = { ...DEFAULT_CAPS, ...(controls[0]?.monthly_caps ?? {}) };
  const byBucket: Partial<Record<SpendBucket, number>> = {};
  for (const l of ledger) if (l.bucket) byBucket[l.bucket as SpendBucket] = (byBucket[l.bucket as SpendBucket] ?? 0) + Number(l.amount_usd);
  // Higgsfield counts inside the e-commerce cap (spentInGroup), so it isn't counted twice here.
  for (const [bucket, cap] of Object.entries(monthly)) spend.push({ key: `month:${bucket}`, label: `${bucket[0].toUpperCase()}${bucket.slice(1)} spend this month`, spent: spentInGroup(bucket as SpendBucket, byBucket), cap: Number(cap), domain: bucket === 'marketing' ? 'marketing' : bucket === 'ecommerce' || bucket === 'visual' ? 'ecommerce' : 'master' });
  spend.push({ key: 'ai:month', label: 'AI (Anthropic) spend this month', spent: aiMonth.reduce((s, r) => s + Number(r.cost_usd), 0), cap: AI_MONTHLY_ALERT_USD, domain: 'master', alertOnly: true });
  const facts: FlagFacts = {
    now,
    approvals,
    workers: workers.map((w) => {
      const mine = runs.filter((r) => r.worker_id === w.id);
      let failStreak = 0;
      for (const r of mine) { if (r.status === 'failed') failStreak++; else if (r.status === 'done') break; }
      return { id: w.id, key: w.key, name: w.name, domain: w.domain, scheduled: SCHEDULED_KEYS.has(w.key), lastSuccessAt: mine.find((r) => r.status === 'done')?.created_at ?? null, failStreak };
    }),
    stores: [...lastBuild.entries()].map(([brand_id, launched_at]) => ({ brand_id, name: nameOf(brand_id), launched_at, orders: orders.filter((o) => o.brand_id === brand_id && o.placed_at >= launched_at).length })),
    funnels: [...latestRead.entries()].map(([brand_id, flag]) => ({ brand_id, name: nameOf(brand_id), flag })),
    publishFailed: failedItems.map((i) => ({ id: i.id, concept: i.concept, error: i.publish_error })),
    connections: conns,
    spend,
    flops: flops.map((p) => ({ id: p.id, account: accts.find((a) => a.id === p.account_id)?.handle ?? 'account', hook: p.hook })),
    attribution: { orders: week.length, unattributed: week.filter((o) => !o.site_id).length },
  };
  return { facts, thresholds: thresholdsFrom(controls[0]?.flag_thresholds) };
}

/** Recompute one owner's flags and write the difference. */
export async function syncFlags(sb: Sb, u: string, now = Date.now()): Promise<{ opened: FlagDraft[]; resolved: number }> {
  const { facts, thresholds } = await gatherFacts(sb, u, now);
  const drafts = evaluateFlags(facts, thresholds);
  const open = await sb.get<OpenFlag>(`ai_flags?user_id=eq.${u}&resolved_at=is.null&select=id,rule,entity_type,entity_id,severity,message`);
  const d = diffFlags(open, drafts);
  const ts = new Date(now).toISOString();
  if (d.insert.length) await sb.insert('ai_flags', d.insert.map((x) => ({ ...x, user_id: u, link: x.link ?? null, opened_at: ts, updated_at: ts })));
  for (const x of d.update) await sb.patch('ai_flags', `id=eq.${x.id}`, { severity: x.severity, message: x.message, updated_at: ts });
  if (d.resolve.length) await sb.patch('ai_flags', `id=in.(${d.resolve.join(',')})`, { resolved_at: ts, updated_at: ts });
  return { opened: d.insert, resolved: d.resolve.length };
}

/** Five-minute cron: every account that runs workers. */
export async function runFlagsTick(env: SbEnv): Promise<void> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = new Sb(env);
  const owners = await sb.get<{ user_id: string }>('ai_workers?key=eq.orchestrator&select=user_id');
  for (const o of owners) {
    try { await syncFlags(sb, o.user_id); } catch (e) { console.error('flags tick', o.user_id, e); }
  }
}
