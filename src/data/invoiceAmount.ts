// Shared with src/components/screens/DocumentPreview.tsx's Invoice renderer
// so an invoice's total is computed identically everywhere it's read —
// notably by useBudgeting.ts, which needs this exact number to merge paid
// invoices into a period's income total.
export function moneyValue(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function computeInvoiceTotal(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  const items = Array.isArray(data.line_items) ? (data.line_items as Record<string, unknown>[]) : [];
  const subtotal = items.reduce((sum, r) => sum + moneyValue(r.qty) * moneyValue(r.rate), 0);
  const taxPct = moneyValue(data.tax_percent);
  return subtotal + subtotal * (taxPct / 100);
}
