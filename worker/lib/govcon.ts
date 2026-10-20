// GovCon: the daily contract briefing. Pure parts (the USAspending query,
// which contracts to pick, the prompt, parsing what comes back) live here so
// they can be tested; worker/handlers/govcon.ts does the fetching and saving.
//
// Source: USAspending.gov (free, no key). Contracts only (award types A–D),
// awarded in the last 30 days, biggest first.
import { extractJson } from './scout';

export const USASPENDING = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
export const AWARD_FIELDS = ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Agency', 'Awarding Sub Agency', 'Start Date', 'End Date', 'Place of Performance State Code', 'NAICS', 'generated_internal_id'];
/** If the API ever rejects a field name, ask again with only these. */
export const AWARD_FIELDS_MIN = ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Awarding Agency', 'Start Date', 'generated_internal_id'];

const day = (d: Date) => d.toISOString().slice(0, 10);

export function awardsQuery(opts: { now: Date; states?: string[]; keywords?: string[]; days?: number; limit?: number; fields?: string[] }): Record<string, unknown> {
  const start = new Date(opts.now.getTime() - (opts.days ?? 30) * 86400000);
  const filters: Record<string, unknown> = {
    time_period: [{ start_date: day(start), end_date: day(opts.now) }],
    award_type_codes: ['A', 'B', 'C', 'D'],
  };
  if (opts.states?.length) filters.place_of_performance_locations = opts.states.map((s) => ({ country: 'USA', state: s }));
  if (opts.keywords?.length) filters.keywords = opts.keywords;
  return { filters, fields: opts.fields ?? AWARD_FIELDS, sort: 'Award Amount', order: 'desc', limit: opts.limit ?? 40, page: 1 };
}

export interface Award {
  award_id: string; internal_id: string | null; recipient: string; amount: number; agency: string; sub_agency: string | null;
  description: string; state: string | null; naics: string | null; start_date: string | null; end_date: string | null; url: string | null;
}

/** One USAspending result row → our shape. Pure. */
export function toAward(r: Record<string, unknown>): Award | null {
  const id = String(r['Award ID'] ?? '').trim();
  const desc = String(r['Description'] ?? '').trim();
  if (!id || !desc) return null;
  const naics = r['NAICS'];
  const internal = (r['generated_internal_id'] as string | undefined) ?? null;
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  return {
    award_id: id, internal_id: internal, recipient: String(r['Recipient Name'] ?? 'Unknown').trim(), amount: Number(r['Award Amount']) || 0,
    agency: String(r['Awarding Agency'] ?? '').trim(), sub_agency: (r['Awarding Sub Agency'] as string | undefined) ?? null, description: desc,
    state: (r['Place of Performance State Code'] as string | undefined) ?? null,
    naics: naics && typeof naics === 'object' ? [(naics as { code?: string }).code, (naics as { description?: string }).description].filter(Boolean).join(' ') || null : (naics as string | null | undefined) ?? null,
    start_date: date(r['Start Date']), end_date: date(r['End Date']),
    url: internal ? `https://www.usaspending.gov/award/${encodeURIComponent(internal)}` : null,
  };
}

/** Today's picks: new to Marq, real money, at least one from his watch states,
 *  and different agencies so the three teach different things. Pure. */
export function pickAwards(local: Award[], national: Award[], seen: Set<string>, n = 3, minAmount = 250_000): Award[] {
  const ok = (a: Award) => !seen.has(a.award_id) && a.amount >= minAmount && a.description.length >= 12;
  const out: Award[] = [];
  const agencies = new Set<string>();
  const take = (list: Award[], max: number) => {
    for (const a of list) {
      if (out.length >= max) return;
      if (!ok(a) || out.some((o) => o.award_id === a.award_id) || agencies.has(a.agency)) continue;
      out.push(a); agencies.add(a.agency);
    }
  };
  take(local, Math.min(n, Math.max(1, Math.ceil(n / 2))));
  take(national, n);
  // Not enough distinct agencies: fill with anything new.
  for (const a of [...local, ...national]) { if (out.length >= n) break; if (ok(a) && !out.some((o) => o.award_id === a.award_id)) out.push(a); }
  return out.slice(0, n);
}

export const BRIEF_SYSTEM = `You teach a 22-year-old founder in Utah to read U.S. government contracts and spot who wins and loses before others notice. He runs a local marketing/web agency and wants to learn to position himself to profit, legally, from public information only.
For each contract you get, write in plain words a smart 15-year-old would follow (short sentences, no jargon unless you explain it):
- what: what the government is buying and from whom, in 1-2 sentences.
- who: who this affects (the winner, its suppliers and subcontractors, local businesses where the work happens, competitors who lost, workers, end users).
- how: how each of them is affected and when (money flowing in, hiring, price changes, demand shifts).
- play: 2-3 concrete, legal ways someone could position for it (sell to the winner or its new hires, serve the area where work happens, supply what the contract will need, watch for follow-on contracts). Include one a small local agency could do this month.
- why_it_matters: one sentence on the bigger pattern this teaches.
- terms: 3-6 government-contract words that appear or matter here, each with a plain meaning.
- quiz: exactly 3 multiple-choice questions, in this order: (1) who is most affected, (2) how they are affected, (3) the best play. Each has 4 options, "answer" is the index 0-3 of the right one, and "why" explains it in one sentence. Make wrong options believable.
Never invent facts not in the contract; if something is unclear, say what to look up. Never suggest using non-public information.
Reply with JSON only: {"contracts":[{"award_id":"...","what":"...","who":"...","how":"...","play":"...","why_it_matters":"...","terms":[{"term":"...","meaning":"..."}],"quiz":[{"q":"...","options":["...","...","...","..."],"answer":0,"why":"..."}]}]}`;

export function briefUser(awards: Award[]): string {
  return awards.map((a, i) => [
    `#${i + 1} award_id: ${a.award_id}`, `Recipient (winner): ${a.recipient}`, `Amount: $${Math.round(a.amount).toLocaleString('en-US')}`,
    `Agency: ${a.agency}${a.sub_agency ? ` / ${a.sub_agency}` : ''}`, `Work happens in: ${a.state ?? 'unknown'}`, a.naics ? `Industry code (NAICS): ${a.naics}` : '',
    `Dates: ${a.start_date ?? '?'} to ${a.end_date ?? '?'}`, `Description: ${a.description.slice(0, 1200)}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}

export interface QuizQ { q: string; options: string[]; answer: number; why: string }
export interface Brief { what: string; who: string; how: string; play: string; why_it_matters: string; terms: { term: string; meaning: string }[] }

/** The model's JSON → one brief + quiz per award we asked about; anything malformed is dropped. Pure. */
export function parseBriefs(text: string, awardIds: string[]): Map<string, { brief: Brief; quiz: QuizQ[] }> {
  const out = new Map<string, { brief: Brief; quiz: QuizQ[] }>();
  let o: { contracts?: unknown[] };
  try { o = extractJson(text) as { contracts?: unknown[] }; } catch { return out; }
  const s = (v: unknown, max = 1200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  for (const raw of Array.isArray(o?.contracts) ? o.contracts : []) {
    const r = raw as Record<string, unknown>;
    const id = s(r.award_id, 120);
    if (!awardIds.includes(id) || out.has(id)) continue;
    const quiz = (Array.isArray(r.quiz) ? r.quiz : []).map((q) => q as Record<string, unknown>)
      .map((q) => ({ q: s(q.q, 400), options: (Array.isArray(q.options) ? q.options : []).map((x) => s(x, 300)).filter(Boolean).slice(0, 4), answer: Number(q.answer), why: s(q.why, 400) }))
      .filter((q) => q.q && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4).slice(0, 3);
    const brief: Brief = {
      what: s(r.what), who: s(r.who), how: s(r.how), play: s(r.play, 1800), why_it_matters: s(r.why_it_matters, 400),
      terms: (Array.isArray(r.terms) ? r.terms : []).map((t) => t as Record<string, unknown>).map((t) => ({ term: s(t.term, 80), meaning: s(t.meaning, 400) })).filter((t) => t.term && t.meaning).slice(0, 8),
    };
    if (!brief.what || !brief.who) continue;
    out.set(id, { brief, quiz });
  }
  return out;
}

export const WORDS_SYSTEM = `Explain government-contract words in plain English for a beginner. One or two short sentences each, with a tiny example when it helps. Reply with JSON only: {"words":[{"word":"...","meaning":"..."}]}`;

/** Score a finished quiz. Pure. */
export function scoreQuiz(quiz: QuizQ[], answers: Record<string, number>): { right: number; total: number } {
  return { right: quiz.filter((q, i) => answers[String(i)] === q.answer).length, total: quiz.length };
}

/** "2026-11-18" for a prediction made today, checked after N days. Pure. */
export const checkDate = (from: Date, days: number) => day(new Date(from.getTime() + days * 86400000));
