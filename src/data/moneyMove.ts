// Money Move (brief §4.7): one specific, doable opportunity a week from the
// user's own skills, hours, budget and city. Pure rules + the post-filter.

export interface MoneyMove {
  title: string; why_you: string; startup_cost_usd: number | null; time_needed: string;
  earnings_low_usd: number | null; earnings_high_usd: number | null; earnings_label: 'estimate';
  steps: string[]; script: string; sources: { title: string; url: string }[];
}
export interface MoneyInputs { skills: string[]; hours_per_week: number | null; budget_usd: number | null; city: string | null; interests: string[]; declined: string[] }

export const MONEY_RULES = [
  'Nothing illegal, nothing that needs a license the person doesn\'t have, no gambling, no crypto or stock "pumps", no MLM or "recruit others" schemes, no reselling tickets above face value where banned.',
  'Never say "guaranteed", "passive income", "risk-free" or promise an amount. Earnings are a realistic range and always labelled estimate.',
  'It must fit the startup budget and the free hours, and be doable this week in or near the city.',
  'Every claim about local demand or prices needs a real source URL.',
];

const BANNED: RegExp[] = [/\bguarantee(d|s)?\b/i, /\brisk[- ]free\b/i, /\bpassive income\b/i, /\bget rich\b/i, /\bcrypto\b/i, /\bmeme ?coin\b/i, /\bforex\b/i, /\bsports? bet/i, /\bgambl/i, /\bcasino\b/i, /\bmlm\b/i, /\bmulti-level\b/i, /\bdownline\b/i, /\brecruit (others|people) (to|into)\b/i, /\bpump\b/i];
/** Post-filter: null if the move passes, otherwise why it was dropped. */
export function moneyMoveProblem(m: Pick<MoneyMove, 'title' | 'why_you' | 'steps' | 'script'>, inputs?: Pick<MoneyInputs, 'budget_usd'>, cost?: number | null): string | null {
  const text = [m.title, m.why_you, m.script, ...m.steps].join(' \n ');
  const hit = BANNED.find((r) => r.test(text));
  if (hit) return `breaks the rules (${hit.source.replace(/\\b/g, '')})`;
  if (inputs?.budget_usd != null && cost != null && cost > inputs.budget_usd * 1.1) return `costs $${cost} to start, over the $${inputs.budget_usd} budget`;
  if (!m.steps.length) return 'no steps';
  return null;
}
/** "Money Moves earned you $X." */
export const moneyEarned = (rows: { earned_usd: number | null }[]) => rows.reduce((s, r) => s + Number(r.earned_usd ?? 0), 0);
export const fmtRange = (lo: number | null, hi: number | null) => (lo == null && hi == null ? 'unknown' : lo != null && hi != null ? `$${lo.toLocaleString('en-US')}–$${hi.toLocaleString('en-US')}` : `$${(lo ?? hi)!.toLocaleString('en-US')}`);
