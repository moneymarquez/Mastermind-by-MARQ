import { askClaude, extractJson } from '../lib/ai';
import { briefSummary, nicheSummary } from './brandLabSpec';
import { specText } from './brandLabPrompts';
import { ROUND_CRITERIA } from './types';
import type { BrandLabBrief, BrandLabRound, FunctionalSpec, Niche, RoundCriterionKey, RoundScore } from './types';

// Step 6 — the judgment loop. Claude Design has no API, so this is the
// paste-back: the operator runs the prompt, pastes what came back, and
// Nova scores it against the SAME eight named criteria every round. The
// consistency is the point — a written-down rubric applied identically
// at 2am is worth more than live watching would have been, and it leaves
// a record of why a direction was chosen.

const HTML_CHAR_CAP = 70_000;

/** A Claude Design export is mostly inline CSS, SVG paths, and base64
 *  images — none of which the judge needs. Strip those, keep the DOM +
 *  copy + class names (mobile rules survive in <style>, which stays). */
export function condenseHtml(html: string): { text: string; truncated: boolean } {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '<svg… />')
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'data:…')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  const truncated = t.length > HTML_CHAR_CAP;
  if (truncated) t = `${t.slice(0, HTML_CHAR_CAP)}\n[… truncated for scoring — ${html.length.toLocaleString()} chars in full …]`;
  return { text: t, truncated };
}

function dataUrlToImage(dataUrl: string): { mediaType: string; data: string } | undefined {
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return undefined;
  return { mediaType: m[1], data: m[2] };
}

interface RawScore {
  criteria?: { key?: string; score?: number | string; note?: string }[];
  matches?: unknown;
  drifted?: unknown;
  missing?: unknown;
  revision_prompt?: string;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : []);

function normalize(raw: RawScore): RoundScore {
  const byKey = new Map<string, { score: number; note: string }>();
  for (const c of raw.criteria ?? []) {
    if (!c.key) continue;
    const n = Math.round(Number(c.score));
    byKey.set(c.key, { score: Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1, note: (c.note ?? '').trim() });
  }
  const criteria = ROUND_CRITERIA.map((c) => {
    const got = byKey.get(c.key);
    return { key: c.key as RoundCriterionKey, score: got?.score ?? 1, note: got?.note || 'Not assessed — scored as failing rather than guessed.' };
  });
  const overall = Math.round((criteria.reduce((s, c) => s + c.score, 0) / criteria.length) * 10) / 10;
  return {
    criteria,
    matches: strList(raw.matches),
    drifted: strList(raw.drifted),
    missing: strList(raw.missing),
    revision_prompt: (raw.revision_prompt ?? '').trim() || 'No revision prompt was produced — re-score this round.',
    overall,
    scored_at: new Date().toISOString(),
  };
}

export async function scoreRound(
  brief: BrandLabBrief,
  spec: FunctionalSpec,
  niche: Niche | null,
  round: BrandLabRound,
  previous: BrandLabRound | null,
): Promise<RoundScore> {
  if (!round.pasted_html && !round.screenshot_data) throw new Error('Paste the HTML export or add a screenshot first.');
  const html = round.pasted_html ? condenseHtml(round.pasted_html) : null;
  const image = round.screenshot_data ? dataUrlToImage(round.screenshot_data) : undefined;

  const system =
    'You are Nova, judging a Claude Design output for a real small-business website against the approved brief and ' +
    'functional spec. Be a consistent judge: same criteria, same 1-5 scale, every round — a score must be backed by one ' +
    'concrete observation from the output, never a vibe. 1 = fails, 3 = partly, 5 = fully. Never credit content that ' +
    'is not in the brief: invented testimonials, fake review counts, stock names, or lorem ipsum cap content_honesty ' +
    'at 2 and must be named in the note. Unauthorized functionality (a booking flow, login, cart, dashboard, or any ' +
    'interactive thing not in the spec) caps scope at 2 and must be named.\n\nCriteria, in order:\n' +
    ROUND_CRITERIA.map((c) => `- ${c.key} — ${c.label}: ${c.question}`).join('\n') +
    '\n\nRespond with ONLY a JSON object, no prose:\n' +
    '{"criteria":[{"key":"brief_match","score":1-5,"note":"one specific observation"}, … all 8 keys in the order above],' +
    '"matches":["what matches the spec — specific, by section name"],' +
    '"drifted":["what departs from the spec or brief, and how"],' +
    '"missing":["approved pages, sections, or functionality that are absent"],' +
    '"revision_prompt":"A complete, paste-ready prompt for the NEXT Claude Design round. Begin with the line ' +
    '\\"Revision — keep:\\" followed by exactly what to preserve, then \\"Fix:\\" as a numbered list. Each item concrete ' +
    'enough to act on without seeing this conversation; reference sections by the spec\'s names; restate the no-fake-' +
    'content rule in one line at the end."}';

  const prevText = previous?.score
    ? `PREVIOUS ROUND ${previous.round_number} — scored on the same scale; score this round relative to it so movement is real:\n` +
      previous.score.criteria.map((c) => `- ${c.key}: ${c.score}/5 — ${c.note}`).join('\n') +
      `\nRevision prompt that was given after it:\n${previous.score.revision_prompt}`
    : 'This is round 1 — nothing to compare against yet.';

  const content = [
    `ROUND ${round.round_number} of the design for ${brief.business || brief.direction}.`,
    '',
    '=== BRIEF ===',
    briefSummary(brief, niche),
    `Tone selected: ${brief.tone ?? 'Minimal & calm'}. Color direction: ${brief.color_pref || 'designer\'s judgment'}.`,
    '',
    '=== NICHE ===',
    nicheSummary(niche, brief.niche_custom),
    '',
    '=== APPROVED FUNCTIONAL SPEC (the contract) ===',
    specText(spec),
    '',
    `=== ${prevText.split('\n')[0]} ===`,
    ...prevText.split('\n').slice(1),
    '',
    round.notes ? `=== OPERATOR NOTES ON THIS ROUND ===\n${round.notes}\n` : '',
    image ? 'A screenshot of this round is attached — judge layout, hierarchy, and mobile fit from it.' : '',
    html
      ? `=== CLAUDE DESIGN OUTPUT (HTML export, scripts/SVG/base64 stripped${html.truncated ? ', truncated' : ''}) ===\n${html.text}`
      : '(No HTML was pasted — judge from the screenshot alone and say so where a criterion cannot be assessed from a single image; score those conservatively rather than guessing.)',
  ].filter((l) => l !== '').join('\n');

  const text = await askClaude({
    system,
    messages: [{ role: 'user', content }],
    image,
    maxTokens: 2600,
    effort: 'medium',
  });
  return normalize(extractJson<RawScore>(text));
}

/** Score movement helpers for the round-over-round grid. */
export function scoreDelta(current: RoundScore | null, previous: RoundScore | null, key: RoundCriterionKey): number | null {
  if (!current || !previous) return null;
  const a = current.criteria.find((c) => c.key === key)?.score;
  const b = previous.criteria.find((c) => c.key === key)?.score;
  if (a === undefined || b === undefined) return null;
  return a - b;
}
