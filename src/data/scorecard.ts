// Business Scaler client scorecard (Masterminds Growth Blueprint, "Scorecard
// (one per client)" and "Levers"). Pure: no network. Stored in the existing
// client_metrics table (schema_125), so no migration: the baseline is the
// one `kind='baseline'` row, current values are the newest `kind='snapshot'`
// row. Revenue, leads and rating use their own columns; the metrics that
// table has no column for, and the 90-day targets, ride in `note` as JSON
// ({"scorecard":1,...}). Tested in tests/scorecard.test.ts.

export type MetricKey = 'revenue' | 'leads' | 'close_rate' | 'avg_ticket' | 'repeat_rate' | 'reviews_month' | 'rating' | 'response_min';
export interface MetricDef { key: MetricKey; label: string; unit: '$' | '%' | '' | '★' | 'min'; lowerIsBetter?: boolean; column?: 'monthly_revenue' | 'leads_month' | 'google_rating'; hint: string }

export const METRICS: MetricDef[] = [
  { key: 'revenue', label: 'Monthly revenue', unit: '$', column: 'monthly_revenue', hint: 'From POS, books or Stripe' },
  { key: 'leads', label: 'Leads / month', unit: '', column: 'leads_month', hint: 'Calls, forms, DMs, quotes' },
  { key: 'close_rate', label: 'Close rate', unit: '%', hint: 'Leads that buy' },
  { key: 'avg_ticket', label: 'Average ticket', unit: '$', hint: 'Revenue ÷ orders' },
  { key: 'repeat_rate', label: 'Repeat rate (90-day)', unit: '%', hint: 'Customers who come back' },
  { key: 'reviews_month', label: 'New reviews / month', unit: '', hint: 'Google, last 30 days' },
  { key: 'rating', label: 'Google rating', unit: '★', column: 'google_rating', hint: 'Main listing' },
  { key: 'response_min', label: 'Response time', unit: 'min', lowerIsBetter: true, hint: 'Lead to first reply, median' },
];
export type Values = Partial<Record<MetricKey, number | null>>;

/** Default 90-day targets from a baseline: the blueprint's "realistic lift" per metric. Pure. */
export function defaultTarget(key: MetricKey, base: number): number {
  switch (key) {
    case 'revenue': return Math.round(base * 1.2);
    case 'leads': return Math.ceil(base * 1.3);
    case 'close_rate': return Math.min(100, Math.round(base + 5));
    case 'avg_ticket': return Math.round(base * 1.08 * 100) / 100;
    case 'repeat_rate': return Math.min(100, Math.round(base + 5));
    case 'reviews_month': return Math.max(8, Math.ceil(base * 3));
    case 'rating': return Math.min(5, Math.round((base + 0.1) * 10) / 10);
    case 'response_min': return Math.max(5, Math.min(15, Math.round(base / 2)));
  }
}

export interface MetricsRow { id?: string; kind: string; monthly_revenue?: number | null; leads_month?: number | null; google_rating?: number | null; note?: string | null; captured_at?: string }
interface NoteJson { scorecard: 1; values?: Values; targets?: Values }
function readNote(note: string | null | undefined): NoteJson | null {
  if (!note || !note.startsWith('{')) return null;
  try { const o = JSON.parse(note) as NoteJson; return o && o.scorecard === 1 ? o : null; } catch { return null; }
}

/** A client_metrics row → metric values (columns + the note's JSON). Pure. */
export function valuesOf(row: MetricsRow | null | undefined): Values {
  if (!row) return {};
  const v: Values = { ...(readNote(row.note)?.values ?? {}) };
  for (const m of METRICS) if (m.column && row[m.column] != null) v[m.key] = Number(row[m.column]);
  return v;
}
export const targetsOf = (row: MetricsRow | null | undefined): Values => readNote(row?.note)?.targets ?? {};

/** Metric values (and optional targets) → the columns to write. Pure. */
export function rowFor(values: Values, targets?: Values): { monthly_revenue: number | null; leads_month: number | null; google_rating: number | null; note: string } {
  const rest: Values = {};
  for (const m of METRICS) if (!m.column && values[m.key] != null) rest[m.key] = values[m.key];
  const n = (k: MetricKey) => (values[k] == null ? null : Number(values[k]));
  return { monthly_revenue: n('revenue'), leads_month: n('leads'), google_rating: n('rating'), note: JSON.stringify({ scorecard: 1, values: rest, ...(targets ? { targets } : {}) }) };
}

/** How far from baseline to target the current value is: 0 = still at (or below) baseline, 1 = target hit. Null without a baseline. Pure. */
export function progress(m: MetricDef, base: number | null | undefined, now: number | null | undefined, target: number | null | undefined): number | null {
  if (base == null) return null;
  const t = target ?? defaultTarget(m.key, base);
  const cur = now ?? base;
  const gap = m.lowerIsBetter ? base - t : t - base;
  if (gap <= 0) return 1;
  const moved = m.lowerIsBetter ? base - cur : cur - base;
  return Math.max(0, Math.min(1, moved / gap));
}

export interface ScoreLine { m: MetricDef; base: number | null; now: number | null; target: number | null; progress: number | null }
export interface Scorecard { lines: ScoreLine[]; weakest: ScoreLine | null; hasBaseline: boolean }

/** The scorecard: every metric with baseline, now, 90-day target and progress,
 *  plus the weakest one (least progress toward its target; ties go to the
 *  metric earliest in the blueprint's leak-first order). Pure. */
export function scorecard(baseline: MetricsRow | null | undefined, latest: MetricsRow | null | undefined): Scorecard {
  const b = valuesOf(baseline), n = valuesOf(latest), t = targetsOf(baseline);
  const lines = METRICS.map((m) => {
    const base = b[m.key] ?? null;
    const target = t[m.key] ?? (base != null ? defaultTarget(m.key, base) : null);
    return { m, base, now: n[m.key] ?? null, target, progress: progress(m, base, n[m.key], target) };
  });
  const scored = lines.filter((l) => l.progress != null);
  let weakest: ScoreLine | null = null;
  for (const k of WEAKEST_ORDER) { const l = scored.find((x) => x.m.key === k)!; if (l && (!weakest || l.progress! < weakest.progress!)) weakest = l; }
  if (weakest && weakest.progress! >= 1) weakest = null;
  return { lines, weakest, hasBaseline: scored.length > 0 };
}
/** Leak-first: fix response, reviews and close rate before buying demand. */
const WEAKEST_ORDER: MetricKey[] = ['response_min', 'reviews_month', 'close_rate', 'repeat_rate', 'avg_ticket', 'rating', 'leads', 'revenue'];

/** The static lever library (blueprint "Levers: what the bot spots and what it proposes"), keyed by the metric it moves. */
export interface Play { title: string; detail: string; autonomy: string; proof: string; step: number }
export const LEVERS: Record<MetricKey, Play> = {
  response_min: { title: 'Speed to lead', detail: 'Instant SMS and email reply to every form and missed call, routed to the owner\'s phone; missed-call text-back in 60 seconds.', autonomy: 'Approve setup, then the bot runs it', proof: 'Median minutes to first reply', step: 4 },
  reviews_month: { title: 'Reviews and Google profile', detail: 'Ask every customer for a review (no gating, no incentives), fix categories, hours and photos, reply to every review, weekly posts.', autonomy: 'Bot drafts; you approve the first batch', proof: 'Reviews per month, profile calls', step: 4 },
  close_rate: { title: 'Unfollowed quotes', detail: 'Follow up every open quote on days 2, 5 and 10; offer financing on day 5 for tickets over about $1k.', autonomy: 'Auto after the first approval', proof: 'Quote close rate', step: 4 },
  repeat_rate: { title: 'Win-backs and retention', detail: 'Consented email and SMS win-back to dormant customers with a time-boxed offer; membership or reminders for regulars.', autonomy: 'Approve each campaign', proof: '90-day repeat rate, reactivated revenue', step: 6 },
  avg_ticket: { title: 'Pricing and offer', detail: '+5–10% test on low-elasticity items, bundles and add-ons aimed at the top complaint; financing for big jobs.', autonomy: 'Approve; the client decides', proof: 'Average ticket, margin per job', step: 6 },
  rating: { title: 'Fix the top complaint', detail: 'Cluster 1–3 star reviews (own and competitors\'), fix the #1 cause, and reply to each one publicly.', autonomy: 'Bot researches; you approve replies', proof: 'Rating, share of 4–5 star reviews', step: 4 },
  leads: { title: 'Capture demand', detail: 'Local SEO and map-pack terms, partnerships with businesses that share the buyer, then small ad tests where capacity exists.', autonomy: 'Approve spend; auto pause-and-cut rules', proof: 'Leads per month by source', step: 5 },
  revenue: { title: 'Stack the leaks, then scale', detail: 'Revenue follows the other seven: fix the weakest leak first, then put budget behind what proved itself.', autonomy: 'Bot ranks; you approve', proof: 'Monthly revenue vs. baseline', step: 8 },
};

/** "$1,240", "34%", "4.6★", "45 min", "12". Pure. */
export function fmtMetric(m: MetricDef, v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (m.unit === '$') return `$${Math.round(v).toLocaleString('en-US')}`;
  if (m.unit === '%') return `${Math.round(v * 10) / 10}%`;
  if (m.unit === '★') return `${v}★`;
  if (m.unit === 'min') return `${Math.round(v)} min`;
  return Math.round(v * 10) / 10 + '';
}
