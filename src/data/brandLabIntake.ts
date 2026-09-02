import { askClaude, extractJson } from '../lib/ai';
import type { BrandLabIntake, Niche } from './types';
import type { CrmClientWithChildren } from './useClientCRM';

export interface ExtractionResult {
  intake: BrandLabIntake;
  /** Keys the model actually filled — everything else was not in the transcript. */
  extractedFields: (keyof BrandLabIntake)[];
}

const EMPTY_INTAKE: BrandLabIntake = {
  business: null, audience: null, niche_slug: null, niche_custom: null, bottleneck_verbatim: null, budget: null,
  services: null, geography: null, wants: null, dont_wants: null, competitors: null, quotes: [],
};

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || /^(null|n\/a|none|not mentioned|unknown)$/i.test(t)) return null;
  return t;
}

/** One model call: a pasted discovery-call transcript → the intake fields.
 *  The contract is "null means it wasn't said" — the system prompt is
 *  explicit that guessing is worse than a blank, and the parser enforces
 *  it a second time (any "N/A"-style filler collapses to null). The
 *  bottleneck is captured in the client's own words, not paraphrased,
 *  because that's the line that ends up on the site. */
export async function extractIntakeFromTranscript(transcript: string, niches: Niche[]): Promise<ExtractionResult> {
  const presetList = niches.filter((n) => n.slug !== 'other').map((n) => `${n.slug} = ${n.name}`).join('; ');
  const text = await askClaude({
    system:
      'You extract structured facts from a recorded business discovery call between a marketing/web operator and a ' +
      'business owner. Respond with ONLY a JSON object, no prose. Every value must come from the transcript. If the ' +
      'transcript does not state something, the value MUST be null — never infer, never fill in a plausible default, ' +
      'never summarize something into existence. A blank is correct; a guess is a defect.\n\n' +
      'Fields:\n' +
      '- business: the business name plus what they actually do, in one line (string or null)\n' +
      `- niche_slug: the best match from this preset list, or "other" if none fits: ${presetList}\n` +
      '- niche_custom: when niche_slug is "other", the niche in a few words; otherwise null\n' +
      '- audience: who their customers are, as described (string or null)\n' +
      '- bottleneck_verbatim: what they said is holding the business back — QUOTE THEM, their exact words, ' +
      'lightly trimmed for filler only (string or null)\n' +
      '- budget: any budget or price they mentioned, as said (string or null)\n' +
      '- services: services or products they offer (string or null)\n' +
      '- geography: service area, city, region (string or null)\n' +
      '- wants: things they explicitly said they want (string or null)\n' +
      '- dont_wants: things they explicitly said they do not want (string or null)\n' +
      '- competitors: competitors or reference sites they named (string or null)\n' +
      '- quotes: an array of 0-5 short direct quotes worth putting on a website, verbatim (array of strings, may be empty)',
    messages: [{ role: 'user', content: `TRANSCRIPT:\n\n${transcript}` }],
    maxTokens: 1800,
  });
  const raw = extractJson<Record<string, unknown>>(text);
  const intake: BrandLabIntake = {
    business: clean(raw.business),
    audience: clean(raw.audience),
    niche_slug: (() => {
      const s = clean(raw.niche_slug);
      if (!s) return null;
      return niches.some((n) => n.slug === s) ? s : 'other';
    })(),
    niche_custom: clean(raw.niche_custom),
    bottleneck_verbatim: clean(raw.bottleneck_verbatim),
    budget: clean(raw.budget),
    services: clean(raw.services),
    geography: clean(raw.geography),
    wants: clean(raw.wants),
    dont_wants: clean(raw.dont_wants),
    competitors: clean(raw.competitors),
    quotes: Array.isArray(raw.quotes) ? raw.quotes.map(clean).filter((q): q is string => !!q).slice(0, 5) : [],
  };
  const extractedFields = (Object.keys(intake) as (keyof BrandLabIntake)[]).filter((k) =>
    k === 'quotes' ? intake.quotes.length > 0 : intake[k] !== null,
  );
  return { intake, extractedFields };
}

/** Path C — an existing CRM client. No model call: the audit answers are
 *  already the client's own words, keyed by audit_questions.key, so they
 *  map straight onto the intake fields. Anything not covered stays null. */
export function intakeFromClient(client: CrmClientWithChildren): ExtractionResult {
  const a = client.audit?.answers ?? {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = clean(a[k]);
      if (v) return v;
    }
    return null;
  };
  const intake: BrandLabIntake = {
    ...EMPTY_INTAKE,
    business: client.business_name ? `${client.business_name}${pick('rapport') ? ` — ${pick('rapport')}` : ''}` : null,
    audience: pick('positioning'),
    bottleneck_verbatim: pick('bottleneck'),
    wants: pick('vision'),
    services: null,
    geography: null,
  };
  const extractedFields = (Object.keys(intake) as (keyof BrandLabIntake)[]).filter((k) =>
    k === 'quotes' ? intake.quotes.length > 0 : intake[k] !== null,
  );
  return { intake, extractedFields };
}

export { EMPTY_INTAKE };
