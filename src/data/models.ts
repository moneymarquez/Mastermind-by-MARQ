// The one place that maps a job (role) to a Claude model, and what each
// model costs. Workers read their model from the roster row (seeded from
// WORKERS in ecom.ts, which takes it from here) or a per-worker override set
// in Office; server handlers outside the worker engine use ROLE_MODEL
// directly. Change a model here and every caller follows.
//
// Model IDs follow the current Claude lineup: Opus 5.5 and Sonnet 5.5 are
// the newest of their tiers, and Haiku 4.5 is the newest Haiku (there is no
// Haiku 5.5 — see docs/BUILD_DECISIONS.md). Older IDs stay in the price
// table so past ledger rows and per-worker overrides keep working.

export const MODELS = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-4-5',
  fable: 'claude-fable-5-1',
} as const;

export type Role =
  | 'master'      // HQ: judgment across the whole business, a few runs a day
  | 'domain'      // E-commerce / Content / Marketing orchestrators
  | 'writer'      // captions, product copy, brand voice, emails, contracts
  | 'parse'       // parsing, classification, import extraction, formatting research
  | 'assistant'   // Nova chat, daily plan, stocks commentary, dispatch extraction
  | 'sms';        // two-way texting replies (see SMS_PROVIDER)

export const ROLE_MODEL: Record<Role, string> = {
  master: MODELS.opus,
  domain: MODELS.sonnet,
  writer: MODELS.sonnet,
  parse: MODELS.haiku,
  assistant: MODELS.opus,
  // Used only when SMS_PROVIDER is 'claude'.
  sms: MODELS.haiku,
};

/** Who answers two-way texts: Grok (xAI) by default, per Marq's choice;
 *  'claude' swaps in ROLE_MODEL.sms (one less vendor). */
export const SMS_PROVIDER: 'grok' | 'claude' = 'grok';

/** $ per million tokens [input, output], list prices. Unknown models are
 *  billed at the most expensive rate so a typo can't under-count spend. */
export const PRICE: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
  'claude-haiku-4-5-20251001': [1, 5],
  'claude-sonnet-5': [3, 15],
  'claude-opus-5': [5, 25],
  'claude-fable-5-1': [10, 50],
};
export const FALLBACK_PRICE: [number, number] = [10, 50];

/** Models the Office may switch a worker to. */
export const ALLOWED_MODELS = [MODELS.haiku, MODELS.sonnet, MODELS.opus, MODELS.fable, 'claude-sonnet-5', 'claude-opus-5'];

/** Batch API jobs (non-urgent nightly grading/audits) are billed at half. */
export const BATCH_DISCOUNT = 0.5;

export function costOf(model: string, tokensIn: number, tokensOut: number, searches = 0, opts: { batch?: boolean; cachedIn?: number } = {}): number {
  const [i, o] = PRICE[model] ?? FALLBACK_PRICE;
  // Cache reads bill at a tenth of the input price.
  const cached = Math.min(opts.cachedIn ?? 0, tokensIn);
  const base = ((tokensIn - cached) * i + cached * i * 0.1 + tokensOut * o) / 1_000_000;
  return base * (opts.batch ? BATCH_DISCOUNT : 1) + searches * 0.01;
}
