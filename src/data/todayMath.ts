// Pure maths for the Today screen: the weekly money scoreboard and the order
// approvals are shown in. No Supabase, no React, so it is unit-tested.

export type BoardPortal = 'E-commerce' | 'Made by' | 'Content' | 'Other';
export const BOARD_PORTALS: BoardPortal[] = ['E-commerce', 'Made by', 'Content', 'Other'];

export interface BoardRow { portal: BoardPortal; moneyIn: number; aiSpend: number; net: number }
export interface Board { rows: BoardRow[]; totalIn: number; totalSpend: number; net: number }

/** Which portal an AI cost ledger domain bills to. Lead Filter and the
 *  marketing orchestrator work LeadFlow, so "marketing" is Made by's. */
export function portalOfSpend(domain: string): BoardPortal {
  if (domain === 'ecom') return 'E-commerce';
  if (domain === 'content') return 'Content';
  if (domain === 'marketing' || domain === 'madeby') return 'Made by';
  return 'Other';
}

/** Monday 00:00 (local) of the week containing `now`, as YYYY-MM-DD. */
export function weekStart(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - back);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Money in vs AI spend per portal for the week.
 *  - E-commerce in: Shopify order totals.
 *  - Made by in: client invoices marked paid.
 *  - Other in: hand-entered ledger income (auto rows mirror the two above, so they're skipped to avoid double counting). */
export function moneyBoard(input: {
  orders: { total: number | string | null }[];
  invoices: { amount: number | string | null }[];
  ledgerIncome: { amount_usd: number | string | null; auto: boolean | null }[];
  spend: { domain: string; cost_usd: number | string | null }[];
}): Board {
  const n = (v: number | string | null | undefined) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
  const moneyIn: Record<BoardPortal, number> = { 'E-commerce': 0, 'Made by': 0, Content: 0, Other: 0 };
  const spend: Record<BoardPortal, number> = { 'E-commerce': 0, 'Made by': 0, Content: 0, Other: 0 };
  for (const o of input.orders) moneyIn['E-commerce'] += n(o.total);
  for (const i of input.invoices) moneyIn['Made by'] += n(i.amount);
  for (const l of input.ledgerIncome) if (!l.auto) moneyIn.Other += n(l.amount_usd);
  for (const s of input.spend) spend[portalOfSpend(s.domain)] += n(s.cost_usd);
  const round = (x: number) => Math.round(x * 100) / 100;
  const rows = BOARD_PORTALS.map((portal) => ({ portal, moneyIn: round(moneyIn[portal]), aiSpend: round(spend[portal]), net: round(moneyIn[portal] - spend[portal]) }));
  const totalIn = round(rows.reduce((s, r) => s + r.moneyIn, 0));
  const totalSpend = round(rows.reduce((s, r) => s + r.aiSpend, 0));
  return { rows, totalIn, totalSpend, net: round(totalIn - totalSpend) };
}

/** Approvals in the order to act on them: money first, then oldest. */
export function sortApprovals<T extends { is_money?: boolean | null; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(!!b.is_money) - Number(!!a.is_money) || a.created_at.localeCompare(b.created_at));
}

/** "3d", "5h", "12m" since an ISO time. */
export function ageOf(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
