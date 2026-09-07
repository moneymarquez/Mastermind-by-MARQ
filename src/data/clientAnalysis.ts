import { askClaude } from '../lib/ai';
import type { AnswerConfidence, AuditQuestion, Service, SuggestedService } from './types';

/** Answers carry a per-key Confirmed/Estimated tag from the discovery
 *  call. Anything untagged is treated as estimated — the cautious default,
 *  since an untagged number is one nobody explicitly stood behind. */
function annotate(answer: string, confidence: string | undefined): string {
  const tag = confidence === 'confirmed' ? 'CONFIRMED' : 'ESTIMATED/UNVERIFIED';
  return `Answer [${tag}]: ${answer}`;
}

function buildQA(
  questions: AuditQuestion[],
  answers: Record<string, string>,
  confidence: Record<string, string>,
): string {
  let currentCategory = '';
  let qa = '';
  for (const q of questions) {
    if (q.category !== currentCategory) {
      currentCategory = q.category;
      qa += `\n### ${currentCategory}\n`;
    }
    const a = answers[q.key]?.trim();
    qa += `\n${q.prompt}\n${a ? annotate(a, confidence[q.key]) : 'Answer: (not answered)'}\n`;
  }
  return qa;
}

/** The analysis engine (Part 2 of the Client Audit/Analysis/Invoicing
 *  build) — takes a client's audit answers (grouped by the editable
 *  audit_questions bank, not a hardcoded set) and produces a proposal in
 *  the exact five-section format already proven for client work: Where
 *  Things Stand Today / What Sets Them Apart / The Plan / Investment /
 *  Next Steps. Investment is deliberately left as a placeholder — pricing
 *  itself lives in the Package & Pricing Builder (client_pricing_items),
 *  not invented by the model. Cristopher reviews and hand-edits the
 *  output before anything is sent; "Regenerate" just re-runs this against
 *  whatever the current answers are. */
export async function generateClientAnalysis(
  businessName: string,
  questions: AuditQuestion[],
  answers: Record<string, string>,
  confidence: Record<string, string> = {},
): Promise<string> {
  const qa = buildQA(questions, answers, confidence);

  return askClaude({
    system:
      `You are Nova, writing a marketing audit and proposal for Cristopher (Made by Marq) to send to a prospective ` +
      `client, "${businessName}". He just ran a discovery conversation covering rapport, vision, positioning, unit ` +
      'economics, marketing/acquisition, lifetime value, and the core bottleneck — the answers below are grouped by ' +
      'category, in his own words (or the client\'s, if this came from the public questionnaire). ' +
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
      'figure as established fact.',
    messages: [{ role: 'user', content: qa }],
    maxTokens: 2000,
  });
}

export interface TranscriptExtraction {
  answers: Record<string, string>;
  confidence: Record<string, AnswerConfidence>;
}

/** Alternative to Live Capture for the same audit — instead of typing
 *  answers live during the call, paste an already-transcribed recording
 *  (e.g. from Call Recordings) and let Nova pull each question's answer
 *  out of it directly. Only returns keys the transcript actually answers;
 *  the caller merges these into blanks rather than overwriting anything
 *  already on the record — a transcript extraction is an inference, not a
 *  replacement for something Cristopher already confirmed. Every filled
 *  answer comes back tagged "estimated": it's the model's read of what was
 *  said, not a value he typed himself, same convention as an untagged
 *  Live Capture answer. */
export async function extractAnswersFromTranscript(
  businessName: string,
  questions: AuditQuestion[],
  transcript: string,
): Promise<TranscriptExtraction> {
  const menu = questions.map((q) => `- key: "${q.key}" — [${q.category}] ${q.prompt}`).join('\n');

  const raw = await askClaude({
    system:
      `You are Nova, pulling structured discovery answers out of a raw call transcript for Cristopher (Made by ` +
      `Marq)'s conversation with "${businessName}". Below is his question bank (key, category, prompt), then the ` +
      'transcript. For every question the transcript actually answers — even partially or implied — extract the ' +
      "answer in the client's own words, condensed to what actually matters, no filler. Skip a question entirely " +
      "if the transcript doesn't address it at all — do not guess or invent an answer to fill a gap. " +
      'Respond with ONLY a JSON object, no prose and no markdown fence, shaped: {"<question key>": "<extracted ' +
      'answer>", ...} — only include keys you actually found an answer for.',
    messages: [{ role: 'user', content: `### Question bank\n${menu}\n\n### Transcript\n${transcript}` }],
    maxTokens: 1600,
  });

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return { answers: {}, confidence: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { answers: {}, confidence: {} };
  }
  if (!parsed || typeof parsed !== 'object') return { answers: {}, confidence: {} };

  const validKeys = new Set(questions.map((q) => q.key));
  const answers: Record<string, string> = {};
  const confidence: Record<string, AnswerConfidence> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!validKeys.has(key) || typeof value !== 'string' || !value.trim()) continue;
    answers[key] = value.trim();
    confidence[key] = 'estimated';
  }
  return { answers, confidence };
}

/** The Service Matcher — the branch that runs alongside the written
 *  analysis in the system flow. Given the same audit answers plus the
 *  master catalog, Claude flags which services this business actually
 *  needs and why. Constrained to real catalog names so the result can be
 *  matched back to priced rows rather than inventing services that don't
 *  exist; anything unmatched is dropped by the caller. */
export async function matchServices(
  businessName: string,
  questions: AuditQuestion[],
  answers: Record<string, string>,
  confidence: Record<string, string>,
  catalog: Service[],
): Promise<SuggestedService[]> {
  const active = catalog.filter((s) => s.active);
  const menu = active
    .map((s) => `- ${s.name} [${s.category}] — ${s.price_type === 'monthly' ? `$${s.default_price}/mo` : `$${s.default_price} one-time`}`)
    .join('\n');

  const raw = await askClaude({
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
  const out: SuggestedService[] = [];
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
