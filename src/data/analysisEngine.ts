// The analysis engine — ONE implementation, two output modes.
//
// This module is deliberately dependency-free: it does not import
// src/lib/ai (which needs a signed-in Supabase session and therefore can
// only run in the browser) and it does not import the Anthropic SDK. It
// takes an `ask` function instead. That's what lets the same prompts serve
// two callers that have nothing else in common:
//
//   src/data/clientAnalysis.ts   → browser, internal CRM, askClaude()
//   worker/handlers/audit.ts     → Cloudflare Worker, public site, direct SDK
//
// A public visitor has no Mastermind session, so the public path CANNOT go
// through askClaude. That's the whole reason for the injection rather than
// a second copy of the prompts. Editing a prompt here changes both
// surfaces at once, which is the point — see the "one shared module, two
// output modes" requirement.

/** The minimum a question needs to expose to be analysable. The internal
 *  CRM's AuditQuestion (src/data/types.ts) satisfies this structurally, as
 *  does the public site's hardcoded question set — neither needs adapting. */
export interface AnalysisQuestion {
  key: string;
  category: string;
  prompt: string;
}

export interface AskFn {
  (opts: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; maxTokens?: number }): Promise<string>;
}

/** Answers arrive as strings from the internal form and as numbers from the
 *  public site's numeric steps. Normalised here rather than at each call
 *  site so neither caller has to care. */
export type AnalysisAnswers = Record<string, string | number | null | undefined>;

/** Per-answer reliability. Untagged is treated as estimated everywhere —
 *  an untagged number is one nobody explicitly stood behind. */
export type AnalysisConfidence = Record<string, string | undefined>;

function annotate(answer: string, confidence: string | undefined): string {
  const tag = confidence === 'confirmed' ? 'CONFIRMED' : 'ESTIMATED/UNVERIFIED';
  return `Answer [${tag}]: ${answer}`;
}

/** Groups the answered questions under their category headings. Shared by
 *  both modes so the model sees an identical picture of the business
 *  either way — only the instructions differ. */
export function buildQA(
  questions: AnalysisQuestion[],
  answers: AnalysisAnswers,
  confidence: AnalysisConfidence = {},
): string {
  let currentCategory = '';
  let qa = '';
  for (const q of questions) {
    if (q.category !== currentCategory) {
      currentCategory = q.category;
      qa += `\n### ${currentCategory}\n`;
    }
    const raw = answers[q.key];
    const a = raw == null ? '' : String(raw).trim();
    qa += `\n${q.prompt}\n${a ? annotate(a, confidence[q.key]) : 'Answer: (not answered)'}\n`;
  }
  return qa;
}

// ── Internal mode ─────────────────────────────────────────────────────────
// The full five-section proposal Cristopher reviews, hand-edits, and sends.
// Never shown to a public visitor.
const INTERNAL_SYSTEM = (businessName: string) =>
  `You are Nova, writing a marketing audit and proposal for Cristopher (Made by Marq) to send to a prospective ` +
  `client, "${businessName}". He just ran a discovery conversation covering rapport, vision, positioning, unit ` +
  'economics, marketing/acquisition, lifetime value, and the core bottleneck — the answers below are grouped by ' +
  "category, in his own words (or the client's, if this came from the public questionnaire). " +
  'Write the proposal in exactly this structure, using these five markdown ## headers in this exact order: ' +
  '"Where Things Stand Today", "What Sets Them Apart", "The Plan", "Investment", "Next Steps". ' +
  '## Where Things Stand Today — an honest, specific read of their current position based on the answers, no ' +
  'generic filler. ## What Sets Them Apart — pull out genuine differentiators from what they actually told you, ' +
  'even if they did not frame it that way themselves. ## The Plan — a concrete, phased marketing plan that ' +
  'directly addresses their stated bottleneck and acquisition gaps. ## Investment — write one short placeholder ' +
  'paragraph noting the specific pricing is attached separately as its own proposal; do not invent dollar ' +
  'amounts here, Cristopher fills those in from his own pricing builder. ## Next Steps — 2 to 4 concrete next ' +
  'actions. Be direct and specific, grounded only in what they actually said — never invent numbers or facts ' +
  'they did not give you, and never leave a section blank. ' +
  'Every answer is tagged CONFIRMED or ESTIMATED/UNVERIFIED. Treat ESTIMATED numbers as the rough guesses they ' +
  'are — you may reason from them, but hedge the language and, where a soft number is load-bearing for a ' +
  'recommendation, say plainly that it should be measured before betting on it. Never restate an ESTIMATED ' +
  'figure as established fact.';

// ── Public mode ───────────────────────────────────────────────────────────
// What a stranger sees on the results screen seconds after submitting. Its
// job is to prove the diagnosis is real without being the deliverable —
// enough that they believe the call is worth twenty minutes, not so much
// that they can act on it alone.
//
// The hard rules (pricing, service names, the plan itself) are business
// constraints, not style preferences: this text is shown to someone who has
// not been qualified and may be a competitor.
const PUBLIC_SYSTEM = (businessName: string) =>
  `You are writing the short diagnosis a local business owner sees immediately after finishing Made by Marq's ` +
  `free online business audit. The business is "${businessName}". Cristopher will walk them through the detail ` +
  'on a call — your job is to name the real problem credibly enough that they book it.\n\n' +
  'Write ONE paragraph of 40 to 90 words. No headers, no lists, no greeting, no sign-off.\n\n' +
  'It must:\n' +
  '- Name the single core problem their answers actually point to, and wrap that phrase in **double asterisks**. ' +
  'Use exactly one such phrase — a short diagnosis like **visibility, not retention** or **positioning, not effort**, ' +
  'not a whole sentence.\n' +
  '- Show you read their specific answers: refer to their situation concretely enough that it could not be a form letter.\n' +
  '- State that there are a specific number of things to fix first (two, three, or four — pick what their answers ' +
  'support) WITHOUT naming or describing any of them.\n' +
  '- Mention that one of those fixes is free and can be done this week.\n' +
  '- End by pointing at a short call with Cristopher.\n\n' +
  'It must NOT, under any circumstances:\n' +
  '- Mention price, cost, budget, packages, retainers, or what anything is worth.\n' +
  '- Name any specific service, tool, platform, or tactic (no "Google Business Profile", no "SEO", no "post more").\n' +
  '- Explain HOW to fix anything, or give a step they could act on without the call.\n' +
  '- Invent numbers or facts they did not give you.\n\n' +
  'Answers tagged ESTIMATED/UNVERIFIED are rough guesses — you may reason from them, but never quote one back as ' +
  'established fact. Be plain and direct. Do not flatter them, and do not use the words "exciting", ' +
  '"opportunity", or "journey".';

export type AnalysisMode = 'internal' | 'public';

export interface PublicDiagnosis {
  /** The full paragraph, asterisk markers stripped — this is what the API
   *  contract returns as diagnosis_text and what gets stored. */
  text: string;
  /** The core-problem phrase the results screen renders bold, and the
   *  before/after fragments around it. Split server-side so the public
   *  site never has to parse model output itself. */
  pre: string;
  core: string;
  post: string;
}

/** Splits the model's **marked** core phrase out of the paragraph. Falls
 *  back to the whole paragraph as `pre` when the model omits the markers,
 *  so the results screen still renders correctly rather than showing raw
 *  asterisks or an empty diagnosis. */
export function splitDiagnosis(raw: string): PublicDiagnosis {
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  const m = cleaned.match(/\*\*(.+?)\*\*/s);
  if (!m) {
    return { text: cleaned.replace(/\*\*/g, ''), pre: cleaned.replace(/\*\*/g, ''), core: '', post: '' };
  }
  const pre = cleaned.slice(0, m.index ?? 0);
  const core = m[1];
  const post = cleaned.slice((m.index ?? 0) + m[0].length);
  return { text: `${pre}${core}${post}`.replace(/\*\*/g, ''), pre, core, post };
}

/** Internal mode — the full proposal. Returns markdown with the five
 *  required ## headers. */
export async function generateInternalAnalysis(
  ask: AskFn,
  businessName: string,
  questions: AnalysisQuestion[],
  answers: AnalysisAnswers,
  confidence: AnalysisConfidence = {},
): Promise<string> {
  return ask({
    system: INTERNAL_SYSTEM(businessName),
    messages: [{ role: 'user', content: buildQA(questions, answers, confidence) }],
    maxTokens: 2000,
  });
}

/** Public mode — the short, deliberately incomplete diagnosis shown on the
 *  results screen. Never contains pricing or the service catalog. */
export async function generatePublicDiagnosis(
  ask: AskFn,
  businessName: string,
  questions: AnalysisQuestion[],
  answers: AnalysisAnswers,
  confidence: AnalysisConfidence = {},
): Promise<PublicDiagnosis> {
  const raw = await ask({
    system: PUBLIC_SYSTEM(businessName),
    messages: [{ role: 'user', content: buildQA(questions, answers, confidence) }],
    maxTokens: 400,
  });
  return splitDiagnosis(raw);
}

// ── Service matcher ───────────────────────────────────────────────────────
// The branch that runs alongside the written analysis. INTERNAL ONLY — its
// output names real catalog services and is never returned to the public
// site under any mode.
export interface MatchableService {
  name: string;
  category: string;
  price_type: string;
  default_price: number;
  active: boolean;
}

export interface MatchedService {
  name: string;
  category: string;
  reason: string;
}

export async function matchServicesWith(
  ask: AskFn,
  businessName: string,
  questions: AnalysisQuestion[],
  answers: AnalysisAnswers,
  confidence: AnalysisConfidence,
  catalog: MatchableService[],
): Promise<MatchedService[]> {
  const active = catalog.filter((s) => s.active);
  const menu = active
    .map((s) => `- ${s.name} [${s.category}] — ${s.price_type === 'monthly' ? `$${s.default_price}/mo` : `$${s.default_price} one-time`}`)
    .join('\n');

  const raw = await ask({
    system:
      `You are Nova, helping Cristopher (Made by Marq) scope a marketing engagement for "${businessName}". ` +
      'Below are his discovery answers, then his master service catalog. Pick ONLY the services this business ' +
      'genuinely needs based on what they actually said — the ones that attack their stated bottleneck first. ' +
      'Be disciplined: 3 to 6 services, not a wish list. Padding the list to raise the invoice is the exact ' +
      'failure mode to avoid; if only three things matter, name three. ' +
      'Answers tagged ESTIMATED/UNVERIFIED are rough guesses — do not let a soft number alone justify a service. ' +
      'Respond with ONLY a JSON array, no prose and no markdown fence, shaped: ' +
      '[{"name":"<exact service name from the catalog>","category":"<its category>","reason":"<one specific sentence tied to what they said>"}]. ' +
      'The name must match a catalog entry character-for-character.',
    messages: [{ role: 'user', content: `${buildQA(questions, answers, confidence)}\n\n### Service catalog\n${menu}` }],
    maxTokens: 1200,
  });

  // Models occasionally wrap JSON in a fence despite instructions — take
  // the outermost array rather than trusting the response is bare.
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // Only keep names that resolve to a real catalog entry — a hallucinated
  // service would otherwise reach the pricing builder with no price.
  const byName = new Map(active.map((s) => [s.name.toLowerCase(), s]));
  const out: MatchedService[] = [];
  for (const item of parsed) {
    const row = item as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name : '';
    const match = byName.get(name.trim().toLowerCase());
    if (!match) continue;
    out.push({
      name: match.name,
      category: match.category,
      reason: typeof row.reason === 'string' ? row.reason : '',
    });
  }
  return out;
}
