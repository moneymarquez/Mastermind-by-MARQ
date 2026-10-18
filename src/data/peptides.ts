// Peptides (brief §4.8): tracking only. No AI dosing suggestions, ever.

export const PEPTIDE_FOOTER = 'Tracking only. Not medical advice. Talk to a doctor.';

/** The ONLY system prompt the Peptides AI summary uses. A test checks the
 *  no-dosing rule is in it. */
export const PEPTIDE_SYSTEM_PROMPT = [
  'You summarize a person\'s own peptide tracking log: what they logged, how consistently, what effects they wrote down, and what is running low.',
  'RULE: Never recommend, suggest, adjust or comment on amounts, doses, compounds, cycles, stacking or protocols. Do not give dosing advice of any kind, even if asked. If asked, say you only summarize their own log and they should talk to a doctor.',
  'Only restate numbers the person logged. Do not invent effects or interpret them medically.',
  `End every answer with: "${PEPTIDE_FOOTER}"`,
].join('\n');

export interface PeptideRow { id: string; name: string; amount: string | null; unit: string | null; days: string[]; times: string[]; vial_remaining: number | null; per_dose: number | null; reorder_at_doses: number | null; cost_per_month: number | null; active: boolean }
/** Doses left in the vial, if the person logged both numbers. */
export function dosesLeft(p: Pick<PeptideRow, 'vial_remaining' | 'per_dose'>): number | null {
  if (p.vial_remaining == null || !p.per_dose || p.per_dose <= 0) return null;
  return Math.floor(p.vial_remaining / p.per_dose);
}
export function needsReorder(p: Pick<PeptideRow, 'vial_remaining' | 'per_dose' | 'reorder_at_doses'>): boolean {
  const left = dosesLeft(p);
  return left != null && left <= (p.reorder_at_doses ?? 3);
}
/** Doses per week from the logged schedule. */
export function dosesPerWeek(p: Pick<PeptideRow, 'days' | 'times'>): number {
  return (p.days.length || 0) * Math.max(1, p.times.length);
}
export const monthlyCost = (rows: Pick<PeptideRow, 'cost_per_month' | 'active'>[]) => rows.filter((r) => r.active).reduce((s, r) => s + Number(r.cost_per_month ?? 0), 0);
/** Is a dose scheduled now (day key + HH:MM)? */
export function dueNow(p: Pick<PeptideRow, 'days' | 'times' | 'active'>, day: string, hhmm: string): boolean {
  return p.active && p.days.includes(day) && p.times.includes(hhmm);
}
