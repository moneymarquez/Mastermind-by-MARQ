// Meta ads campaign builder, DRAFTS ONLY (Oct 2026). A campaign, its ad
// sets and ads, generated from a product (or a client's product) and the
// contribution-margin math: break-even CPA is the bid ceiling, so no ad set
// is allowed to pay more for a sale than the sale leaves. Pure: no network.
// Drafts are saved as ai_approvals (type 'meta_ads_draft'). Nothing here, or
// anywhere in this build, calls the Meta Marketing API: "Push to Meta" stays
// off until a Meta ads key exists AND DRY_RUN is off, and even then it needs
// the approved draft and a passing spend check (metaPushGate).
import { profitMath, fmtRoas } from './ecomProfit';
import type { ProfitVerdict } from './ecomProfit';

export const META_SECRETS = ['META_ADS_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'] as const;
/** A small, fixed first test: two ad sets, three ads each, five days. */
export const META_TEST = { dailyBudgetUsd: 20, days: 5, minDailyUsd: 5, maxDailyUsd: 100 } as const;
/** Kill an ad set once it has spent this many break-even CPAs without a sale under the ceiling. */
export const KILL_AFTER_CPAS = 1.5;

export interface AdSource {
  kind: 'product' | 'client';
  /** ecom_products.id or crm_clients.id */
  id: string | null;
  name: string;
  sell: number; supplier: number; ship: number;
  adCpa?: number | null;
  angle?: string | null; buyer?: string | null; url?: string | null;
  /** For a client's product: the business name and where it sells. */
  business?: string | null; location?: string | null;
}
export interface MetaAdSet { name: string; optimization_goal: 'OFFSITE_CONVERSIONS'; billing_event: 'IMPRESSIONS'; bid_strategy: 'COST_CAP'; bid_amount_usd: number; daily_budget_usd: number; targeting: { geo: string; age_min: number; age_max: number; audience: string }; placements: string }
export interface MetaAd { name: string; ad_set: string; primary_text: string; headline: string; description: string; cta: 'SHOP_NOW' | 'ORDER_NOW'; creative: string; link: string | null }
export interface MetaDraft {
  version: 1;
  source: AdSource;
  math: { sell: number; landed: number; cm_before_ads: number; break_even_cpa: number; break_even_roas: string; cm_pct: number; verdict: ProfitVerdict; why: string; ad_cost_estimated: boolean };
  bid_ceiling_usd: number;
  campaign: { name: string; objective: 'OUTCOME_SALES'; buying_type: 'AUCTION'; status: 'PAUSED'; special_ad_categories: string[]; daily_budget_usd: number; days: number; total_budget_usd: number };
  ad_sets: MetaAdSet[];
  ads: MetaAd[];
  kill_rule: string;
  warnings: string[];
  /** Kill verdict or no margin: keep it as a draft, never push. */
  blocked: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100) / 100;
/** Collapses whitespace and cuts at a word boundary. */
const clean = (s: string | null | undefined, max = 140) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const cut = t.slice(0, max); const sp = cut.lastIndexOf(' '); return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '') + '…'; };
const money = (n: number) => `$${n.toFixed(2)}`;

export function buildMetaDraft(src: AdSource, opts: { dailyBudgetUsd?: number; days?: number } = {}): MetaDraft {
  const m = profitMath({ sell: src.sell, supplier: src.supplier, ship: src.ship, adCpa: src.adCpa ?? null });
  const daily = Math.min(META_TEST.maxDailyUsd, Math.max(META_TEST.minDailyUsd, Math.round(opts.dailyBudgetUsd ?? META_TEST.dailyBudgetUsd)));
  const days = Math.min(14, Math.max(1, Math.round(opts.days ?? META_TEST.days)));
  const ceiling = floor2(Math.max(0, m.breakEvenCpa));
  const who = clean(src.business) || clean(src.name, 60);
  const name = clean(src.name, 60);
  const geo = clean(src.location, 60) || 'United States';
  const warnings: string[] = [];
  if (m.verdict === 'Kill') warnings.push(`Kill verdict: ${m.verdictWhy} Don't run paid ads on this; sell it through content, the list and bundles.`);
  else if (m.verdict === 'Test') warnings.push(`Test verdict: ${m.verdictWhy}`);
  if (m.estimated.adCost) warnings.push('Ad cost per sale is an estimate (30% of price) until real ads have run.');
  if (ceiling < 5 && ceiling > 0) warnings.push(`Break-even CPA is only ${money(ceiling)}: Meta rarely delivers sales that cheap on cold traffic.`);
  if (ceiling * 2 > daily) warnings.push(`A daily budget of ${money(daily)} buys under 2 sales at the ceiling; learning will be slow.`);
  const blocked = m.verdict === 'Kill' || ceiling <= 0;
  const setNames = ['Broad (Advantage+ audience)', clean(src.buyer, 80) ? `Interest: ${clean(src.buyer, 90)}` : 'Lookalike: past buyers / engagers'];
  const perSet = r2(daily / setNames.length);
  const ad_sets: MetaAdSet[] = setNames.map((a, i) => ({ name: `${name} · ${i === 0 ? 'Broad' : 'Interest'} · CC ${money(ceiling)}`, optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS', bid_strategy: 'COST_CAP', bid_amount_usd: ceiling, daily_budget_usd: perSet, targeting: { geo, age_min: 21, age_max: 60, audience: a }, placements: 'Advantage+ placements' }));
  const angle = clean(src.angle, 120);
  const hooks = [
    { k: 'Problem', text: angle || `The easiest fix you'll buy this month: ${name}.`, cr: 'Demo video, 9:16, first 2 seconds show the problem, then the product fixing it.' },
    { k: 'Proof', text: `I didn't think it'd work. Real customers on ${name}.`, cr: 'UGC-style review, handheld, captions on.' },
    { k: 'Offer', text: `${name}, ${money(src.sell)}. Ships fast${src.kind === 'client' ? ` from ${who}` : ''}.`, cr: 'Product still on a clean background, price on screen.' },
  ];
  const ads: MetaAd[] = ad_sets.flatMap((s) => hooks.map((h) => ({ name: `${s.name.split(' · ')[1]} · ${h.k}`, ad_set: s.name, primary_text: h.text, headline: clean(`${name}${src.kind === 'client' ? ` · ${who}` : ''}`, 40), description: `${money(src.sell)}`, cta: src.kind === 'client' ? 'ORDER_NOW' as const : 'SHOP_NOW' as const, creative: h.cr, link: src.url ?? null })));
  return {
    version: 1, source: src,
    math: { sell: m.sell, landed: m.landed, cm_before_ads: m.cmBeforeAds, break_even_cpa: m.breakEvenCpa, break_even_roas: fmtRoas(m.breakEvenRoas), cm_pct: m.cmPct, verdict: m.verdict, why: m.verdictWhy, ad_cost_estimated: m.estimated.adCost },
    bid_ceiling_usd: ceiling,
    campaign: { name: (src.business ? `${clean(src.business, 50)} · ${name} · Sales test` : `${name} · Sales test`).slice(0, 120), objective: 'OUTCOME_SALES', buying_type: 'AUCTION', status: 'PAUSED', special_ad_categories: [], daily_budget_usd: daily, days, total_budget_usd: r2(daily * days) },
    ad_sets, ads,
    kill_rule: `Pause an ad set when it has spent ${money(r2(ceiling * KILL_AFTER_CPAS))} (${KILL_AFTER_CPAS}× the ${money(ceiling)} break-even CPA) without a sale under ${money(ceiling)}.`,
    warnings, blocked,
  };
}

export interface PushGateInput { hasKey: boolean; dryRun: boolean; approvalStatus: string | null; blocked: boolean; spend?: { verdict: 'allow' | 'needs_approval' | 'block'; reason: string } | null }
/** May "Push to Meta" be pressed? Every reason it can't, in order. Pure.
 *  Even when enabled, this build answers "not built": nothing reaches Meta. */
export function metaPushGate(i: PushGateInput): { enabled: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!i.hasKey) reasons.push(`Add the Meta ads key (${META_SECRETS.join(' + ')}) in Setup → Platform keys.`);
  if (i.dryRun) reasons.push('DRY_RUN is on: nothing is pushed to Meta in test mode.');
  if (i.approvalStatus !== 'approved') reasons.push(i.approvalStatus === 'pending' ? 'Approve the draft first (it is waiting in Approvals).' : 'This draft was not approved.');
  if (i.blocked) reasons.push('The margin math says Kill: no paid ads on this product.');
  if (i.spend && i.spend.verdict === 'block') reasons.push(`Spend check: ${i.spend.reason}`);
  return { enabled: reasons.length === 0, reasons };
}
