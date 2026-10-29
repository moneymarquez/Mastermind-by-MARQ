// The three scores on every AI output (spec Part 3). Pure: shared by the app
// (colors, overall) and the Worker (Logic and Trust checks). On-target needs
// a model and lives in worker/lib/scoring.ts.
//
//   Logic      the numbers make sense — deterministic checks in code
//   Trust      the research is real — sources present, reachable, fresh
//   On-target  it matches what was asked — a cheap model compares
//   Overall    the lowest of the three (one weak leg sinks the card)

export interface Check { name: string; pass: boolean; why: string; weight?: number; critical?: boolean }
export interface ScoreResult { score: number | null; checks: Check[] }
export interface ScoreRow { output_type: string; output_id: string; worker: string | null; logic: number | null; trust: number | null; on_target: number | null; overall: number | null; checks: { logic?: Check[]; trust?: Check[]; on_target?: Check[] }; rejected_reason?: string | null; created_at?: string }

export type Band = 'green' | 'yellow' | 'red';
/** Green 85–100, yellow 60–84, red under 60. Pure. */
export const band = (n: number | null | undefined): Band | null => (n == null ? null : n >= 85 ? 'green' : n >= 60 ? 'yellow' : 'red');
/** The lowest of the scores that exist. Pure. */
export const overallOf = (...xs: (number | null | undefined)[]): number | null => {
  const ok = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return ok.length ? Math.min(...ok) : null;
};
/** Weighted share of passed checks, 0–100; a failed critical check caps it at 40. Pure. */
export function scoreChecks(checks: Check[]): number | null {
  if (!checks.length) return null;
  const total = checks.reduce((s, c) => s + (c.weight ?? 1), 0);
  const got = checks.reduce((s, c) => s + (c.pass ? c.weight ?? 1 : 0), 0);
  let n = Math.round((got / total) * 100);
  if (checks.some((c) => c.critical && !c.pass)) n = Math.min(n, 40);
  return n;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[$,\s%]/g, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Budget a first test can carry (sample order + first batch), for MOQ checks. */
export const TEST_BUDGET_USD = 500;

/** Logic for a product: price, landed cost, margin, MOQ budget. Pure. */
export function productLogic(p: { sell?: unknown; supplier?: unknown; ship?: unknown; landed?: unknown; moq?: unknown; unit?: unknown; fees?: unknown }): ScoreResult {
  const sell = num(p.sell), supplier = num(p.supplier), ship = num(p.ship) ?? 0, fees = num(p.fees) ?? (sell != null ? sell * 0.03 + 0.3 : 0);
  const landed = num(p.landed) ?? (supplier != null ? supplier + ship : null);
  const checks: Check[] = [];
  checks.push({ name: 'Has a sell price', pass: sell != null && sell > 0, why: sell != null ? `$${sell}` : 'missing', critical: true });
  checks.push({ name: 'Has a landed cost', pass: landed != null && landed > 0, why: landed != null ? `$${landed.toFixed(2)}` : 'missing', critical: true });
  if (sell != null && landed != null && sell > 0) {
    const profit = sell - landed - fees;
    const margin = profit / sell;
    checks.push({ name: 'Sells above cost', pass: sell > landed, why: `$${sell} vs $${landed.toFixed(2)} landed`, critical: true });
    checks.push({ name: 'Margin is sane (20–85%)', pass: margin >= 0.2 && margin <= 0.85, why: `${Math.round(margin * 100)}% after fees`, critical: margin < 0.05 || margin > 0.95, weight: 2 });
    checks.push({ name: 'Real profit per order (≥ $5)', pass: profit >= 5, why: `$${profit.toFixed(2)} per order`, weight: 2 });
    checks.push({ name: 'Price in a sane range', pass: sell <= 2000 && landed <= 2000, why: sell > 2000 || landed > 2000 ? 'numbers look absurd for a test product' : 'ok', critical: true });
  }
  const moq = num(p.moq), unit = num(p.unit) ?? num(p.supplier);
  if (moq != null && unit != null) checks.push({ name: `MOQ fits a $${TEST_BUDGET_USD} test`, pass: moq * unit <= TEST_BUDGET_USD, why: `${moq} × $${unit} = $${(moq * unit).toFixed(0)}` });
  return { score: scoreChecks(checks), checks };
}

/** Logic for a lead: reachable, open, local business, in the searched city. Pure. */
export function leadLogic(l: { phone?: string | null; website?: string | null; status?: string | null; is_chain?: boolean | null; business_size?: string | null; city?: string | null; searchCity?: string | null }): ScoreResult {
  const checks: Check[] = [
    { name: 'Has a phone or website', pass: !!(l.phone || l.website), why: l.phone ? 'phone' : l.website ? 'website only' : 'neither', critical: true },
    { name: 'Business is open', pass: !/closed/i.test(l.status ?? ''), why: l.status ?? 'open' },
    { name: 'Not a chain', pass: !l.is_chain, why: l.is_chain ? 'chain' : 'independent', critical: !!l.is_chain },
    { name: 'Not a multi-location franchise', pass: l.business_size !== 'multi', why: l.business_size === 'multi' ? '3+ locations: check before calling' : 'single' },
  ];
  if (l.searchCity) checks.push({ name: 'In the searched city', pass: (l.city ?? '').toLowerCase() === l.searchCity.toLowerCase(), why: l.city ?? 'unknown' });
  return { score: scoreChecks(checks), checks };
}

/** Logic for a cold email: the problem it names is one we actually found. Pure. */
export function emailLogic(e: { finding_kind?: string | null; body?: string | null }, foundKinds: string[]): ScoreResult {
  const checks: Check[] = [
    { name: 'Names a real finding', pass: !!e.finding_kind && foundKinds.includes(e.finding_kind), why: e.finding_kind ? (foundKinds.includes(e.finding_kind) ? `${e.finding_kind} is in the audit` : `${e.finding_kind} is NOT in the audit`) : 'no finding', critical: true },
    { name: 'One question', pass: ((e.body ?? '').match(/\?/g) ?? []).length === 1, why: `${((e.body ?? '').match(/\?/g) ?? []).length} question marks` },
    { name: 'No links or prices', pass: !/https?:|www\.|\$/i.test(e.body ?? ''), why: 'cold emails stay plain text' },
    { name: 'Has an opt-out', pass: /reply "?stop"?/i.test(e.body ?? ''), why: 'required for cold email' },
  ];
  return { score: scoreChecks(checks), checks };
}

/** Logic for a supplier pick: the pick sells below the sell price, fits a test, same product. Pure. */
export function supplierLogic(payload: Record<string, unknown>, sellPrice: number | null): ScoreResult {
  const sups = Array.isArray(payload.suppliers) ? (payload.suppliers as Record<string, unknown>[]) : [];
  const pick = sups[Number(payload.pick ?? 0)] ?? sups[0];
  if (!pick) return { score: 0, checks: [{ name: 'Has a supplier', pass: false, why: 'none', critical: true }] };
  const unit = num(pick.unit_cost), ship = num(pick.ship_cost) ?? 0, landed = num(pick.landed) ?? (unit != null ? unit + ship : null);
  const checks: Check[] = [
    { name: 'Pick has a unit cost', pass: unit != null, why: unit != null ? `$${unit}` : 'unknown' },
    { name: 'Pick is the same product', pass: pick.same_product !== false, why: String(pick.listing_title ?? '') || 'not stated', critical: pick.same_product === false },
  ];
  if (landed != null && sellPrice != null) checks.push({ name: 'Landed cost under half the sell price', pass: landed <= sellPrice * 0.5, why: `$${landed.toFixed(2)} vs $${sellPrice}`, weight: 2 });
  const moq = num(pick.moq);
  if (moq != null && unit != null) checks.push({ name: `MOQ fits a $${TEST_BUDGET_USD} test`, pass: moq * unit <= TEST_BUDGET_USD, why: `${moq} × $${unit} = $${(moq * unit).toFixed(0)}` });
  const days = num(pick.ship_days);
  if (days != null) checks.push({ name: 'Ships in 15 days or less', pass: days <= 15, why: `${days} days` });
  return { score: scoreChecks(checks), checks };
}

/** Logic for whatever an approval card holds. Pure. */
export function approvalLogic(type: string, payload: Record<string, unknown>): ScoreResult {
  if (type === 'product_card') {
    const row = obj(payload.row), detail = obj(row.detail);
    return productLogic({ sell: row.sell_price, supplier: row.supplier_cost, ship: detail.ship_cost, landed: row.landed_cost });
  }
  if (type === 'product_pitch') {
    const m = obj(payload.math);
    return productLogic({ sell: m.sell ?? payload.sell_price, supplier: m.supplier ?? payload.supplier_cost, ship: m.ship, landed: m.landed });
  }
  if (type === 'supplier_pick') return supplierLogic(payload, num(payload.sell_price));
  // Other cards have no numbers to check: Logic only asks that they say something.
  const text = JSON.stringify(payload ?? {});
  const checks: Check[] = [{ name: 'Has content', pass: text.length > 40, why: `${text.length} characters` }];
  return { score: scoreChecks(checks), checks };
}

// ── Trust: sources ─────────────────────────────────────────────────────
/** Every http(s) URL in an output, de-duplicated. Pure. */
export function urlsIn(v: unknown, out = new Set<string>()): string[] {
  if (typeof v === 'string') { for (const m of v.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) out.add(m[0].replace(/[.,;]+$/, '')); }
  else if (Array.isArray(v)) v.forEach((x) => urlsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => urlsIn(x, out));
  return [...out];
}
/** Trust from what was found: sources present, reachable, fresh. Pure (reachability is passed in). */
export function trustFrom(o: { urls: string[]; reachable: Record<string, boolean>; claims: number; sourcedClaims: number; asOf?: string | null; now?: Date; needsSources: boolean }): ScoreResult {
  const checks: Check[] = [];
  if (!o.needsSources && !o.urls.length) return { score: null, checks: [{ name: 'No outside research to verify', pass: true, why: 'built from your own data' }] };
  checks.push({ name: 'Has sources', pass: o.urls.length > 0, why: `${o.urls.length} link${o.urls.length === 1 ? '' : 's'}`, critical: true, weight: 2 });
  if (o.claims > 0) checks.push({ name: 'Claims carry a source', pass: o.sourcedClaims / o.claims >= 0.7, why: `${o.sourcedClaims} of ${o.claims}`, weight: 2 });
  const tested = o.urls.filter((u) => u in o.reachable);
  if (tested.length) {
    const ok = tested.filter((u) => o.reachable[u]).length;
    checks.push({ name: 'Sources load', pass: ok / tested.length >= 0.8, why: `${ok} of ${tested.length} reachable`, critical: ok === 0, weight: 2 });
  }
  if (o.asOf) {
    const age = ((o.now ?? new Date()).getTime() - Date.parse(o.asOf)) / 86400000;
    if (Number.isFinite(age)) checks.push({ name: 'Data under 90 days old', pass: age <= 90, why: `${Math.round(age)} days old` });
  }
  return { score: scoreChecks(checks), checks };
}

export interface TrendRow { worker: string; avg7: number | null; avg30: number | null; n7: number; n30: number; sentBack: number }
/** Trust trend per worker: average overall over 7 and 30 days, plus the most
 *  common failed checks across all workers (and Marq's send-back reasons). Pure. */
export function trustTrend(rows: Pick<ScoreRow, 'worker' | 'overall' | 'checks' | 'rejected_reason' | 'created_at'>[], now = new Date()): { workers: TrendRow[]; failed: { name: string; count: number }[] } {
  const day = 86400000, t = now.getTime();
  const by = new Map<string, { s7: number[]; s30: number[]; back: number }>();
  const fails = new Map<string, number>();
  for (const r of rows) {
    const age = t - new Date(r.created_at ?? 0).getTime();
    if (age > 30 * day || age < 0) continue;
    const w = r.worker || 'Unknown';
    const e = by.get(w) ?? { s7: [], s30: [], back: 0 };
    if (r.overall != null) { e.s30.push(r.overall); if (age <= 7 * day) e.s7.push(r.overall); }
    if (r.rejected_reason) e.back++;
    by.set(w, e);
    for (const list of Object.values(r.checks ?? {})) for (const c of list ?? []) if (!c.pass) fails.set(c.name, (fails.get(c.name) ?? 0) + 1);
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const workers = [...by].map(([worker, e]) => ({ worker, avg7: avg(e.s7), avg30: avg(e.s30), n7: e.s7.length, n30: e.s30.length, sentBack: e.back }))
    .sort((a, b) => (a.avg7 ?? a.avg30 ?? 101) - (b.avg7 ?? b.avg30 ?? 101));
  const failed = [...fails].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  return { workers, failed };
}
