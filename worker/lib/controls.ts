// Guardrails that protect real money (brief §2d): the kill switch and the
// spending guardrail. checkSpend is pure and tested; the rest reads/writes
// system_controls and biz_ledger with the service role.
//
// Nothing that sends, posts, spends or publishes runs unless the switch for
// its domain is off AND checkSpend allows it.
import { Sb } from './sb';

export type ControlDomain = 'ecommerce' | 'content' | 'marketing';
export type SpendBucket = 'ecommerce' | 'marketing' | 'visual' | 'research' | 'supplier' | 'ai' | 'xai' | 'twilio' | 'other';
export interface Controls {
  paused_all: boolean; paused_ecommerce: boolean; paused_content: boolean; paused_marketing: boolean;
  per_action_approval_over_usd: number;
  monthly_caps: Partial<Record<SpendBucket, number>>;
  stores_per_product: number;
  flag_thresholds: Record<string, number>;
}
/** Monthly caps, USD (Addendum 2 §4). Marq can edit every one in HQ.
 *  - ecommerce: domains, samples, product images (Higgsfield counts INSIDE it)
 *  - marketing: boosts and promo for Masterminds
 *  - visual: Higgsfield on its own, $15, images only; video waits for the first sale
 *  - research: Parallel; xai: texting replies (the free model takes over at the cap); twilio: texts
 *  Anthropic keeps its daily per-domain caps and alerts at $40 a month (flags.ts). */
export const DEFAULT_CAPS: Partial<Record<SpendBucket, number>> = { ecommerce: 50, marketing: 50, visual: 15, research: 15, xai: 5, twilio: 10 };
export const AI_MONTHLY_ALERT_USD = 40;
/** Buckets that count toward another bucket's cap too. */
export const PARENT_BUCKET: Partial<Record<SpendBucket, SpendBucket>> = { visual: 'ecommerce' };
/** What one cap includes: itself plus the buckets that live inside it. Pure. */
export const spentInGroup = (bucket: SpendBucket, spent: Partial<Record<SpendBucket, number>>): number =>
  (spent[bucket] ?? 0) + (Object.entries(PARENT_BUCKET) as [SpendBucket, SpendBucket][]).filter(([, p]) => p === bucket).reduce((s, [c]) => s + (spent[c] ?? 0), 0);

export const DEFAULT_CONTROLS: Controls = {
  paused_all: false, paused_ecommerce: false, paused_content: false, paused_marketing: false,
  per_action_approval_over_usd: 25,
  monthly_caps: { ...DEFAULT_CAPS },
  stores_per_product: 1,
  flag_thresholds: {},
};

/** Engine domains (ecom/content/marketing/all) → the switch that governs them. */
export function controlDomainOf(engineDomain: string): ControlDomain | null {
  if (engineDomain === 'ecom' || engineDomain === 'ecommerce') return 'ecommerce';
  if (engineDomain === 'content') return 'content';
  if (engineDomain === 'marketing') return 'marketing';
  return null;
}
export function isPaused(c: Controls, domain: ControlDomain | null): boolean {
  if (c.paused_all) return true;
  if (!domain) return false;
  return !!c[`paused_${domain}` as const];
}

/** needsFirstSale: off until the brand has made a real sale (Higgsfield video, extra domains, paid promotion for products). */
export interface SpendAction { bucket: SpendBucket; label: string; needsFirstSale?: boolean }
export interface SpendState { spentThisMonth: Partial<Record<SpendBucket, number>>; controls: Controls; domain?: ControlDomain | null; hasSale?: boolean }
export type SpendVerdict = { verdict: 'allow' | 'needs_approval' | 'block'; reason: string };

/** The Finance/Guardrail rule. Paused → block. Over the bucket's monthly
 *  cap → block. Over the per-action threshold → needs Marq, however sure
 *  the bot is. Otherwise allow. */
export function checkSpend(action: SpendAction, amountUsd: number, state: SpendState): SpendVerdict {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return { verdict: 'block', reason: 'Not a valid amount.' };
  const c = state.controls;
  if (isPaused(c, state.domain ?? null)) return { verdict: 'block', reason: 'Paused by the kill switch.' };
  if (action.needsFirstSale && !state.hasSale) return { verdict: 'block', reason: `${action.label} is off until the first real sale.` };
  const cap = c.monthly_caps[action.bucket];
  const spent = spentInGroup(action.bucket, state.spentThisMonth);
  if (cap != null && spent + amountUsd > cap + 1e-9) return { verdict: 'block', reason: `${action.label} would put ${action.bucket} at $${(spent + amountUsd).toFixed(2)} — over this month's $${cap.toFixed(2)} cap.` };
  // Money inside another bucket (Higgsfield inside e-commerce) also has to fit that bucket's cap.
  const parent = PARENT_BUCKET[action.bucket];
  const pcap = parent ? c.monthly_caps[parent] : undefined;
  if (parent && pcap != null && spentInGroup(parent, state.spentThisMonth) + amountUsd > pcap + 1e-9) return { verdict: 'block', reason: `${action.label} would put ${parent} (which includes ${action.bucket}) over this month's $${pcap.toFixed(2)} cap.` };
  if (amountUsd > c.per_action_approval_over_usd) return { verdict: 'needs_approval', reason: `$${amountUsd.toFixed(2)} is over the $${c.per_action_approval_over_usd.toFixed(2)} you approve yourself.` };
  return { verdict: 'allow', reason: cap != null ? `$${(cap - spent - amountUsd).toFixed(2)} left in ${action.bucket} this month.` : 'Within limits.' };
}

export function controlsFrom(row: Partial<Controls> | null | undefined): Controls {
  if (!row) return { ...DEFAULT_CONTROLS };
  return {
    paused_all: !!row.paused_all, paused_ecommerce: !!row.paused_ecommerce, paused_content: !!row.paused_content, paused_marketing: !!row.paused_marketing,
    per_action_approval_over_usd: Number(row.per_action_approval_over_usd ?? DEFAULT_CONTROLS.per_action_approval_over_usd),
    monthly_caps: { ...DEFAULT_CONTROLS.monthly_caps, ...(row.monthly_caps ?? {}) },
    stores_per_product: Math.min(2, Math.max(1, Number(row.stores_per_product ?? 1))),
    flag_thresholds: row.flag_thresholds ?? {},
  };
}

/** Before schema_121 is applied the table doesn't exist: that reads as
 *  "nothing paused, default limits", never as an error. */
export async function loadControls(sb: Sb, u: string): Promise<Controls> {
  const [row] = await sb.get<Partial<Controls>>(`system_controls?user_id=eq.${u}&select=*`);
  return controlsFrom(row);
}

export async function spentThisMonth(sb: Sb, u: string, at = new Date()): Promise<Partial<Record<SpendBucket, number>>> {
  const month = at.toISOString().slice(0, 7);
  const rows = await sb.get<{ bucket: SpendBucket | null; amount_usd: number }>(`biz_ledger?user_id=eq.${u}&kind=eq.expense&date=gte.${month}-01&bucket=not.is.null&select=bucket,amount_usd`);
  const out: Partial<Record<SpendBucket, number>> = {};
  for (const r of rows) if (r.bucket) out[r.bucket] = (out[r.bucket] ?? 0) + Number(r.amount_usd);
  return out;
}

/** checkSpend against live state. */
export async function guardSpend(sb: Sb, u: string, action: SpendAction, amountUsd: number, domain: ControlDomain | null): Promise<SpendVerdict> {
  const [controls, spent, hasSale] = await Promise.all([loadControls(sb, u), spentThisMonth(sb, u), action.needsFirstSale ? hasRealSale(sb, u) : Promise.resolve(true)]);
  return checkSpend(action, amountUsd, { controls, spentThisMonth: spent, domain, hasSale });
}

/** True once a real order has come in from a brand's site or product. An order nobody can place (test orders, strays) doesn't count. */
export async function hasRealSale(sb: Sb, u: string): Promise<boolean> {
  const rows = await sb.get<{ id: string }>(`ecom_orders?user_id=eq.${u}&brand_id=not.is.null&total=gt.0&select=id&limit=1`);
  return rows.length > 0;
}

/** An allowed bot spend becomes a business expense in the Ledger. */
export async function recordSpend(sb: Sb, u: string, action: SpendAction, amountUsd: number, ref?: { type: string; id: string }): Promise<void> {
  await sb.insert('biz_ledger', { user_id: u, kind: 'expense', amount_usd: Number(amountUsd.toFixed(2)), category: ['visual', 'research', 'ai', 'xai'].includes(action.bucket) ? 'ai_usage' : action.bucket, bucket: action.bucket, party: action.label.slice(0, 120), auto: true, ref_type: ref?.type ?? null, ref_id: ref?.id ?? null });
}

/** Flip a switch, leave an HQ log line (ai_tasks) and a flag so it shows everywhere. */
export async function setPaused(sb: Sb, u: string, which: 'all' | ControlDomain, paused: boolean): Promise<Controls> {
  const col = `paused_${which}`;
  await sb.insert('system_controls', { user_id: u, [col]: paused, updated_at: new Date().toISOString() }, { upsert: 'user_id' });
  const ts = new Date().toISOString();
  await sb.insert('ai_tasks', { user_id: u, domain: which === 'content' ? 'content' : which === 'marketing' ? 'marketing' : 'ecom', body: `control:${which}:${paused ? 'paused' : 'resumed'}:${ts}`, instructions: `${paused ? 'Paused' : 'Resumed'} ${which === 'all' ? 'everything' : which}`, status: 'done', note: paused ? 'Kill switch on: no runs, posts, sends or spend until resumed. Queued work waits.' : 'Kill switch off: queued work resumes on the next tick.' }).catch(() => {});
  if (paused) await sb.insert('ai_flags', { user_id: u, domain: which === 'all' ? 'master' : which, entity_type: 'control', entity_id: which, severity: 'red', rule: 'paused', message: `${which === 'all' ? 'Everything' : which[0].toUpperCase() + which.slice(1)} is paused by the kill switch`, link: 'hq', opened_at: ts, updated_at: ts }).catch(() => {});
  else await sb.patch('ai_flags', `user_id=eq.${u}&rule=eq.paused&entity_id=eq.${which}&resolved_at=is.null`, { resolved_at: ts, updated_at: ts }).catch(() => {});
  return loadControls(sb, u);
}
