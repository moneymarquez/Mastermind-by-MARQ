// Contribution margin after ads: the number every e-commerce product decision
// is judged on (Masterminds Growth Blueprint). Built on the same fee config as
// the per-order receipt (src/data/ecomFees.ts), plus an ad cost per purchase.
// Pure: no I/O, safe to import from both the app and the worker.
import { FEES } from './ecomFees';
import type { FeeConfig } from './ecomFees';

/** Ad cost per purchase when no real CPA is known: an ESTIMATE, as a % of price.
 *  30% is a common cold-traffic planning number for impulse DTC products;
 *  replace it with a product's real CPA (detail.ad_cpa) once ads have run. */
export const DEFAULT_AD_CPA_PCT = 30;
/** Marketplace / platform commission per order (% of price). Own Shopify store = 0. ESTIMATE. */
export const DEFAULT_PLATFORM_FEE_PCT = 0;
/** Verdict thresholds on contribution margin % after ads. */
export const VERDICT_RULES = { scaleMinPct: 20, testMinPct: 10 } as const;

export type ProfitVerdict = 'Scale' | 'Test' | 'Kill';

export interface ProfitInputs {
  sell: number;
  supplier: number;
  ship: number;
  /** Real ad cost per purchase, if known. Otherwise estimated from adCpaPct. */
  adCpa?: number | null;
  adCpaPct?: number;
  platformFeePct?: number;
  fees?: FeeConfig;
}

export interface ProfitMath {
  sell: number;
  /** Product + shipping + packaging. */
  landed: number;
  /** Payment processing (Shopify rate). */
  paymentFee: number;
  /** Marketplace / platform commission. */
  platformFee: number;
  /** Refund / chargeback allowance. */
  returns: number;
  /** Ad cost per purchase. */
  adCost: number;
  /** Which inputs are estimates, not measured. */
  estimated: { adCost: boolean; platformFee: boolean; returns: boolean };
  /** Contribution before ads = what one sale leaves to pay for ads. Also the break-even CPA. */
  cmBeforeAds: number;
  cmBeforeAdsPct: number;
  /** Contribution margin after ads, $ and % of price. */
  cm: number;
  cmPct: number;
  /** Max ad cost per purchase before a sale loses money. */
  breakEvenCpa: number;
  /** Revenue per $1 of ads needed to break even (Infinity if no margin before ads). */
  breakEvenRoas: number;
  verdict: ProfitVerdict;
  verdictWhy: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;

export function profitVerdict(cmPct: number, rules = VERDICT_RULES): ProfitVerdict {
  if (cmPct >= rules.scaleMinPct) return 'Scale';
  if (cmPct >= rules.testMinPct) return 'Test';
  return 'Kill';
}

/** Full contribution-margin math for one unit sold through paid ads. Pure. */
export function profitMath(i: ProfitInputs): ProfitMath {
  const fees = i.fees ?? FEES;
  const sell = r2(Math.max(0, i.sell));
  const landed = r2(i.supplier + i.ship + fees.packagingUsd);
  const paymentFee = sell > 0 ? r2((sell * fees.processingPct) / 100 + fees.processingFixedUsd) : 0;
  const platformPct = i.platformFeePct ?? DEFAULT_PLATFORM_FEE_PCT;
  const platformFee = r2((sell * platformPct) / 100);
  const returns = r2((sell * fees.refundPct) / 100);
  const knownCpa = i.adCpa != null && Number.isFinite(i.adCpa) && i.adCpa >= 0;
  const adCost = r2(knownCpa ? Number(i.adCpa) : (sell * (i.adCpaPct ?? DEFAULT_AD_CPA_PCT)) / 100);
  const cmBeforeAds = r2(sell - landed - paymentFee - platformFee - returns);
  const cm = r2(cmBeforeAds - adCost);
  const pct = (n: number) => (sell > 0 ? r2((n / sell) * 100) : 0);
  const cmPct = pct(cm);
  const breakEvenCpa = Math.max(0, cmBeforeAds);
  const breakEvenRoas = cmBeforeAds > 0 ? r2(sell / cmBeforeAds) : Infinity;
  const verdict = profitVerdict(cmPct);
  const verdictWhy = verdict === 'Scale'
    ? `${cmPct.toFixed(0)}% margin after ads (≥ ${VERDICT_RULES.scaleMinPct}%): ${money(cm)} per sale.`
    : verdict === 'Test'
      ? `${cmPct.toFixed(0)}% margin after ads (${VERDICT_RULES.testMinPct}–${VERDICT_RULES.scaleMinPct}%): test small, cut if CPA goes over ${money(breakEvenCpa)}.`
      : `${cmPct.toFixed(0)}% margin after ads (under ${VERDICT_RULES.testMinPct}%): ${cm < 0 ? `loses ${money(-cm)} per sale` : `only ${money(cm)} per sale`}.`;
  return {
    sell, landed, paymentFee, platformFee, returns, adCost,
    estimated: { adCost: !knownCpa, platformFee: i.platformFeePct == null, returns: true },
    cmBeforeAds, cmBeforeAdsPct: pct(cmBeforeAds), cm, cmPct, breakEvenCpa, breakEvenRoas, verdict, verdictWhy,
  };
}

/** Reads optional measured numbers off a product's detail blob. */
export function profitFromProduct(sell: number, supplier: number, ship: number, detail?: Record<string, unknown> | null): ProfitMath {
  const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return profitMath({ sell, supplier, ship, adCpa: n(detail?.ad_cpa), platformFeePct: n(detail?.platform_fee_pct) ?? undefined });
}

export const fmtRoas = (r: number) => (Number.isFinite(r) ? `${r.toFixed(2)}×` : 'never (no margin)');
