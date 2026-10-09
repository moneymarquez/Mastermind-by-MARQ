// Every dollar between the customer and Marq, in one place. Change the rates
// here, not on a card. Defaults: Shopify Payments, Basic plan, US online
// card rate of 2.9% + 30¢ (Shopify pricing page; confirm it there before
// relying on it, Shopify changes rates by plan and region). The refund and
// chargeback allowance is 5% of the price; packaging and extras default to $0.
export interface FeeConfig { processingPct: number; processingFixedUsd: number; refundPct: number; packagingUsd: number }
export const FEES: FeeConfig = { processingPct: 2.9, processingFixedUsd: 0.3, refundPct: 5, packagingUsd: 0 };

export interface Breakdown { customer: number; supplier: number; ship: number; processing: number; packaging: number; refund: number; landed: number; profit: number; marginPct: number }
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The mini receipt for one order. Pure. */
export function breakdown(sell: number, supplier: number, ship: number, fees: FeeConfig = FEES): Breakdown {
  // Every line is rounded to cents first, so the receipt always adds up.
  const processing = sell > 0 ? r2((sell * fees.processingPct) / 100 + fees.processingFixedUsd) : 0;
  const refund = r2((sell * fees.refundPct) / 100);
  const s2 = r2(supplier), sh = r2(ship), pk = r2(fees.packagingUsd), cu = r2(sell);
  const landed = r2(s2 + sh + processing + pk + refund);
  const profit = r2(cu - landed);
  return { customer: cu, supplier: s2, ship: sh, processing, packaging: pk, refund, landed, profit, marginPct: sell > 0 ? r2((profit / cu) * 100) : 0 };
}
