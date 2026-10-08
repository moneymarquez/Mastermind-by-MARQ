// Guardrails that protect real money (brief §2d): the kill switch and the
// spending guardrail. checkSpend is pure and tested; the rest reads/writes
// system_controls and biz_ledger with the service role.
//
// Nothing that sends, posts, spends or publishes runs unless the switch for
// its domain is off AND checkSpend allows it.
import { Sb } from './sb';

export type ControlDomain = 'ecommerce' | 'content' | 'marketing';
export type SpendBucket = 'marketing' | 'visual' | 'research' | 'supplier' | 'ai' | 'other';
export interface Controls {
  paused_all: boolean; paused_ecommerce: boolean; paused_content: boolean; paused_marketing: boolean;
  per_action_approval_over_usd: number;
  monthly_caps: Partial<Record<SpendBucket, number>>;
  stores_per_product: number;
  flag_thresholds: Record<string, number>;
}
export const DEFAULT_CONTROLS: Controls = {
  paused_all: false, paused_ecommerce: false, paused_content: false, paused_marketing: false,
  per_action_approval_over_usd: 25,
  monthly_caps: { marketing: 100, visual: 60, research: 40 },
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

export interface SpendAction { bucket: SpendBucket; label: string }
export interface SpendState { spentThisMonth: Partial<Record<SpendBucket, number>>; controls: Controls; domain?: ControlDomain | null }
export type SpendVerdict = { verdict: 'allow' | 'needs_approval' | 'block'; reason: string };

/** The Finance/Guardrail rule. Paused → block. Over the bucket's monthly
 *  cap → block. Over the per-action threshold → needs Marq, however sure
 *  the bot is. Otherwise allow. */
export function checkSpend(action: SpendAction, amountUsd: number, state: SpendState): SpendVerdict {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return { verdict: 'block', reason: 'Not a valid amount.' };
  const c = state.controls;
  if (isPaused(c, state.domain ?? null)) return { verdict: 'block', reason: 'Paused by the kill switch.' };
  const cap = c.monthly_caps[action.bucket];
  const spent = state.spentThisMonth[action.bucket] ?? 0;
  if (cap != null && spent + amountUsd > cap + 1e-9) return { verdict: 'block', reason: `${action.label} would put ${action.bucket} at $${(spent + amountUsd).toFixed(2)} — over this month's $${cap.toFixed(2)} cap.` };
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
  const [controls, spent] = await Promise.all([loadControls(sb, u), spentThisMonth(sb, u)]);
  return checkSpend(action, amountUsd, { controls, spentThisMonth: spent, domain });
}

/** An allowed bot spend becomes a business expense in the Ledger. */
export async function recordSpend(sb: Sb, u: string, action: SpendAction, amountUsd: number, ref?: { type: string; id: string }): Promise<void> {
  await sb.insert('biz_ledger', { user_id: u, kind: 'expense', amount_usd: Number(amountUsd.toFixed(2)), category: action.bucket === 'visual' || action.bucket === 'research' || action.bucket === 'ai' ? 'ai_usage' : action.bucket, bucket: action.bucket, party: action.label.slice(0, 120), auto: true, ref_type: ref?.type ?? null, ref_id: ref?.id ?? null });
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
