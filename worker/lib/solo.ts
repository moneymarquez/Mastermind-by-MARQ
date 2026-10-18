// October build, Phase 4: the server side of solo Masterminds.
//
//   parseImport      block → validate; otherwise the parse model extracts the same schema
//   docxText         .docx → plain text (word/document.xml, no zip library)
//   runCheckin       Weekly Check-in: scorecard facts → shortfalls + 3 adjustments
//   checkinChat      push back on the check-in; it adjusts
//   runMoneyMove     one researched, local, doable money move a week
//   peptideSummary   summarize the user's own log (PEPTIDE_SYSTEM_PROMPT: no dosing, ever)
//   runSoloTick      5-minute cron: task-due, peptide, check-in, money-move and feed notices
import type { Sb } from './sb';
import { zonedNow, addDaysIso } from './sb';
import { ask } from './ai';
import { ROLE_MODEL } from './models';
import { extractJson } from './scout';
import { notifyStored } from './notify';
import { researchSearch } from './research';
import { IMPORT_TEMPLATE, parseImportText, validateImport } from '../../src/data/importFormat';
import type { ValidateResult } from '../../src/data/importFormat';
import { scorecard, cleanAdjustments } from '../../src/data/weeklyCheckin';
import type { WeekFacts, Adjustment, ScoreRow } from '../../src/data/weeklyCheckin';
import { MONEY_RULES, moneyMoveProblem } from '../../src/data/moneyMove';
import type { MoneyMove, MoneyInputs } from '../../src/data/moneyMove';
import { PEPTIDE_SYSTEM_PROMPT, PEPTIDE_FOOTER, dosesLeft, needsReorder } from '../../src/data/peptides';
import { reactionNotice } from '../../src/data/feed';
import { weekOf } from '../../src/data/tasks';

const TZ = 'America/Denver';
const DOMAIN = 'solo';
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };

// ── Brain Dump import ─────────────────────────────────────────────────
export const IMPORT_EXTRACT_SYSTEM = [
  'You turn a person\'s notes, chat transcript or document into a Masterminds import.',
  'Extract ONLY what the text actually says: goals with numbers and deadlines, tasks grouped by project, habits, macros, fitness, schedule, contacts and which lists they belong on, anything they track (peptides: record only what they wrote, never suggest amounts), money inputs (skills, free hours, budget, city, interests), reminders, and documents worth keeping whole.',
  'Never invent a number, a date or a person. Leave anything not stated out. Dates as YYYY-MM-DD, times as HH:MM 24h.',
  'Answer with ONLY the JSON object from this template (no markers, no prose):',
  IMPORT_TEMPLATE,
].join('\n');

export async function parseImport(apiKey: string | undefined, sb: Sb, u: string, text: string): Promise<ValidateResult & { method: 'block' | 'ai' }> {
  const block = parseImportText(text);
  if (block) return { ...block, method: 'block' };
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.parse, system: IMPORT_EXTRACT_SYSTEM, user: text.slice(0, 120000), maxTokens: 6000, domain: DOMAIN, userId: u, date: zonedNow(TZ).date, capUsd: 1 });
  let raw: unknown;
  try { raw = extractJson(res.text); } catch { return { ok: false, data: null, errors: ['Couldn\'t find anything to import in that text.'], unknownKeys: [], method: 'ai' }; }
  return { ...validateImport(raw), method: 'ai' };
}

/** Plain text from a .docx (a zip whose word/document.xml holds the text).
 *  Reads the central directory and inflates that one entry. */
export async function docxText(bytes: Uint8Array): Promise<string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a .docx (no zip directory).');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    if (name === 'word/document.xml') {
      const lnlen = dv.getUint16(local + 26, true), lelen = dv.getUint16(local + 28, true);
      const data = bytes.subarray(local + 30 + lnlen + lelen, local + 30 + lnlen + lelen + csize);
      let xml: string;
      if (method === 0) xml = new TextDecoder().decode(data);
      else if (method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const out = new Response(new Blob([data.slice()]).stream().pipeThrough(ds));
        xml = await out.text();
      } else throw new Error('Unsupported .docx compression.');
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/\n{3,}/g, '\n\n').trim();
    }
    p += 46 + nlen + elen + clen;
  }
  throw new Error('No document text found in that .docx.');
}

/** A PDF goes to the parse model as a document block. */
export async function pdfText(apiKey: string | undefined, sb: Sb, u: string, bytes: Uint8Array): Promise<string> {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set as a Worker secret.');
  if (bytes.length > 20 * 1024 * 1024) throw new Error('That PDF is over 20 MB.');
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({ model: ROLE_MODEL.parse, max_tokens: 8000, messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: btoa(bin) } }, { type: 'text', text: 'Transcribe this document\'s text faithfully as plain markdown. No commentary.' }] }] });
  const { costOf } = await import('./models');
  const { recordCost } = await import('./ai');
  await recordCost(sb, { user_id: u, date: zonedNow(TZ).date, domain: DOMAIN, worker_id: null, cost_usd: Number(costOf(ROLE_MODEL.parse, res.usage.input_tokens, res.usage.output_tokens).toFixed(5)) }, { model: ROLE_MODEL.parse, tokens_in: res.usage.input_tokens, tokens_out: res.usage.output_tokens }).catch(() => {});
  return res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');
}

// ── Weekly Check-in ───────────────────────────────────────────────────
/** The app's weeks start on Sunday (src/data/time.ts weekStartOf). The
 *  check-in reviews the last full week: the Sunday-start week that
 *  contains yesterday. Pure. */
export function checkinWeekStart(today: string): string {
  const y = addDaysIso(today, -1);
  const dow = new Date(`${y}T12:00:00Z`).getUTCDay();
  return addDaysIso(y, -dow);
}
export const CHECKIN_SYSTEM = [
  'You write a person\'s weekly check-in for their Masterminds app. Tone: honest, specific, no guilt-trip, no flattery. Short sentences.',
  'You get a scorecard (planned vs actual) and the raw week. Write: where they fell short and the LIKELY WHY from their own data (look for patterns: which days, which times, what else was on those days). Never guess beyond the data.',
  'Then exactly 3 concrete adjustments for next week. Each one can change their setup and must be one of these kinds:',
  '- macros: change = {"calories": n, "protein_g": n} (only when weight/macros data supports it)',
  '- task: change = {"title": "", "due": "YYYY-MM-DD", "priority": "high|med|low", "project": ""}',
  '- reminder: change = {"title": "", "due_date": "YYYY-MM-DD", "due_time": "HH:MM"}',
  '- schedule_note: change = {"note": ""} (e.g. move runs to evenings on early-shift days)',
  '- focus: change = {"line": ""}',
  'And one "focus for next week" line (under 12 words).',
  'Answer ONLY with JSON: {"shortfalls":[{"area":"","what":"","why":""}],"adjustments":[{"kind":"task","title":"","why":"","change":{}}],"focus":"","summary":""}',
].join('\n');

export interface CheckinRaw { facts: WeekFacts; detail: string[] }
/** Gather planned vs actual for the week that just ended. */
export async function gatherWeek(sb: Sb, u: string, weekStart: string): Promise<CheckinRaw> {
  const end = addDaysIso(weekStart, 6);
  const [tasks, goals, nut, meals, plans, dials, workouts] = await Promise.all([
    sb.get<{ title: string; due: string | null; done: boolean; done_at: string | null }>(`tasks?user_id=eq.${u}&due=gte.${weekStart}&due=lte.${end}&select=title,due,done,done_at`).catch(() => []),
    sb.get<{ title: string; progress_pct: number | null; deadline: string | null; created_at: string }>(`goals?user_id=eq.${u}&select=title,progress_pct,deadline,created_at&limit=10`).catch(() => []),
    sb.get<{ daily_calories: number; daily_protein_g: number }>(`nutrition_targets?user_id=eq.${u}&active=eq.true&select=daily_calories,daily_protein_g&limit=1`).catch(() => []),
    sb.get<{ meal_date: string; calories: number | null; protein_g: number | null }>(`meals?user_id=eq.${u}&meal_date=gte.${weekStart}&meal_date=lte.${end}&select=meal_date,calories,protein_g&limit=500`).catch(() => []),
    sb.get<{ plan_date: string; status: string; blocks: { done?: boolean }[] }>(`daily_plans?user_id=eq.${u}&plan_date=gte.${weekStart}&plan_date=lte.${end}&select=plan_date,status,blocks`).catch(() => []),
    sb.get<{ call_date: string }>(`call_outcomes?user_id=eq.${u}&call_date=gte.${weekStart}&call_date=lte.${end}&select=call_date&limit=2000`).catch(() => []),
    sb.get<{ workout_date: string; workout_type: string }>(`fitness_workouts?user_id=eq.${u}&workout_date=gte.${weekStart}&workout_date=lte.${end}&select=workout_date,workout_type`).catch(() => []),
  ]);
  // Meals → one total per day.
  const perDay = new Map<string, { calories: number; protein_g: number }>();
  for (const m of meals) { const d = perDay.get(m.meal_date) ?? { calories: 0, protein_g: 0 }; d.calories += Number(m.calories ?? 0); d.protein_g += Number(m.protein_g ?? 0); perDay.set(m.meal_date, d); }
  const logs = [...perDay].map(([log_date, v]) => ({ log_date, ...v }));
  const t = nut[0];
  const onTarget = t ? logs.filter((l) => l.calories != null && Math.abs(Number(l.calories) - t.daily_calories) <= t.daily_calories * 0.1 && Number(l.protein_g ?? 0) >= t.daily_protein_g * 0.9).length : 0;
  const now = Date.now();
  const goalRows = goals.filter((g) => g.deadline).map((g) => {
    const span = Date.parse(g.deadline!) - Date.parse(g.created_at);
    const expected = span > 0 ? Math.max(0, Math.min(100, Math.round(((now - Date.parse(g.created_at)) / span) * 100))) : 100;
    return { title: g.title, pct: Math.round(Number(g.progress_pct ?? 0)), expectedPct: expected };
  });
  const blocks = plans.flatMap((p) => (Array.isArray(p.blocks) ? p.blocks : []));
  // Planned workouts come from the import/fitness inputs; without a plan the
  // target is what they did, and missed days are the gaps on the plan days.
  const fitnessTarget = Math.max(workouts.length, 3);
  const doneDays = new Set(workouts.map((w) => w.workout_date));
  const missed = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)).filter((d) => !doneDays.has(d)).slice(0, Math.max(0, fitnessTarget - doneDays.size));
  const facts: WeekFacts = {
    tasks: { planned: tasks.length, done: tasks.filter((x) => x.done).length },
    goals: goalRows,
    macros: t ? { daysLogged: logs.length, daysOnTarget: onTarget } : null,
    fitness: workouts.length ? { planned: fitnessTarget, done: doneDays.size, missedDays: missed } : null,
    dialing: dials.length ? { target: 0, made: dials.length } : null,
    plan: plans.length ? { days: plans.length, confirmed: plans.filter((p) => p.status === 'confirmed').length, blocksDone: blocks.filter((b) => b.done).length, blocksTotal: blocks.length } : null,
  };
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const detail = [
    tasks.length ? `Tasks due this week: ${tasks.map((x) => `${x.title} (${x.due ? day(x.due) : ''}${x.done ? ', done' : ', open'})`).join('; ')}` : 'No tasks were due.',
    workouts.length ? `Workouts: ${workouts.map((w) => `${day(w.workout_date)} ${w.workout_type}`).join(', ')}` : 'No workouts logged.',
    t ? `Macro target ${t.daily_calories} kcal / ${t.daily_protein_g}g protein; logged ${logs.length} days: ${logs.map((l) => `${day(l.log_date)} ${l.calories ?? '?'} kcal ${l.protein_g ?? '?'}g`).join(', ')}` : '',
    plans.length ? `Daily plans: ${plans.map((p) => `${day(p.plan_date)} ${p.status}`).join(', ')}` : '',
  ].filter(Boolean);
  return { facts, detail };
}

export async function runCheckin(apiKey: string | undefined, sb: Sb, u: string, weekStart?: string): Promise<{ id: string; scorecard: ScoreRow[]; shortfalls: unknown[]; adjustments: Adjustment[]; focus: string; summary: string }> {
  const today = zonedNow(TZ).date;
  const ws = weekStart ?? checkinWeekStart(today);
  const raw = await gatherWeek(sb, u, ws);
  const card = scorecard(raw.facts);
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.writer, system: CHECKIN_SYSTEM, user: [`Week of ${ws}.`, `Scorecard:\n${card.map((r) => `- ${r.label}: ${r.actual} of ${r.planned} (${r.status})`).join('\n')}`, `The week:\n${raw.detail.join('\n')}`, `Next week starts ${addDaysIso(ws, 7)}; adjustments should use dates from then on.`].join('\n\n'), maxTokens: 2000, domain: DOMAIN, userId: u, date: today, capUsd: 1 });
  const o = extractJson(res.text) as Record<string, unknown>;
  const shortfalls = (Array.isArray(o.shortfalls) ? o.shortfalls : []).slice(0, 5);
  const adjustments = cleanAdjustments(o.adjustments);
  const focus = str(o.focus, 120), summary = str(o.summary, 1500) || 'Weekly check-in';
  const [row] = await sb.insert<{ id: string }>('weekly_reviews', { user_id: u, week_start: ws, summary, recommended_actions: adjustments.map((a) => a.title), scorecard: card, shortfalls, adjustments, focus, generated_at: new Date().toISOString() }, { upsert: 'user_id,week_start' });
  return { id: row?.id ?? '', scorecard: card, shortfalls, adjustments, focus, summary };
}

export async function checkinChat(apiKey: string | undefined, sb: Sb, u: string, id: string, message: string): Promise<{ reply: string; adjustments: Adjustment[] }> {
  const [r] = await sb.get<{ id: string; summary: string; scorecard: ScoreRow[]; adjustments: Adjustment[]; chat: { role: string; text: string }[] }>(`weekly_reviews?id=eq.${id}&user_id=eq.${u}&select=id,summary,scorecard,adjustments,chat`);
  if (!r) throw new Error('That check-in is gone.');
  const chat = [...(r.chat ?? []), { role: 'user', text: message.slice(0, 2000) }];
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.writer, system: `${CHECKIN_SYSTEM}\n\nNow the person is pushing back on this check-in. Take it seriously: if they say the week was an outlier or something was wrong, adjust. Answer ONLY with JSON: {"reply":"2-4 sentences","adjustments":[same shape, the full updated list of 3]}`, user: [`Check-in: ${r.summary}`, `Scorecard: ${JSON.stringify(r.scorecard)}`, `Current adjustments: ${JSON.stringify(r.adjustments)}`, `Conversation:\n${chat.map((c) => `${c.role}: ${c.text}`).join('\n')}`].join('\n\n'), maxTokens: 1500, domain: DOMAIN, userId: u, date: zonedNow(TZ).date, capUsd: 1 });
  const o = extractJson(res.text) as Record<string, unknown>;
  const reply = str(o.reply, 1200) || 'Got it.';
  const adj = cleanAdjustments(o.adjustments);
  const adjustments = adj.length ? adj : r.adjustments;
  await sb.patch('weekly_reviews', `id=eq.${id}&user_id=eq.${u}`, { chat: [...chat, { role: 'assistant', text: reply }], adjustments });
  return { reply, adjustments };
}

// ── Money Move ────────────────────────────────────────────────────────
export function moneySystem(): string {
  return [
    'You find ONE specific, doable money move for one person this week, from their own skills, free hours, budget, city and interests. Current and local, not generic.',
    ...MONEY_RULES.map((r) => `Rule: ${r}`),
    'If research sources are given, use them and cite them. Shape example: "Pressure-washing driveways in Sandy this weekend: $150 in gear rental, 3 houses × $120, the 5-step plan and the exact Facebook Marketplace post to write."',
    'Answer ONLY with JSON: {"title":"","why_you":"","startup_cost_usd":0,"time_needed":"","earnings_low_usd":0,"earnings_high_usd":0,"steps":[""],"script":"the exact post/message to send","sources":[{"title":"","url":""}]}',
  ].join('\n');
}
export function parseMoneyMove(text: string): MoneyMove {
  const o = extractJson(text) as Record<string, unknown>;
  return {
    title: str(o.title, 200), why_you: str(o.why_you, 600), startup_cost_usd: num(o.startup_cost_usd), time_needed: str(o.time_needed, 120),
    earnings_low_usd: num(o.earnings_low_usd), earnings_high_usd: num(o.earnings_high_usd), earnings_label: 'estimate',
    steps: (Array.isArray(o.steps) ? o.steps : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 8), script: str(o.script, 2000),
    sources: (Array.isArray(o.sources) ? o.sources : []).map((x) => ({ title: str((x as Record<string, unknown>).title, 160), url: str((x as Record<string, unknown>).url, 500) })).filter((x) => /^https?:\/\//.test(x.url)).slice(0, 6),
  };
}

export async function runMoneyMove(apiKey: string | undefined, sb: Sb, u: string): Promise<{ ok: boolean; move?: MoneyMove; id?: string; error?: string }> {
  const today = zonedNow(TZ).date;
  const ws = weekOf(today).start;
  const [setup] = await sb.get<{ money_skills: string[]; money_hours_per_week: number | null; money_budget_usd: number | null; money_city: string | null; money_interests: string[] }>(`user_setup?user_id=eq.${u}&select=money_skills,money_hours_per_week,money_budget_usd,money_city,money_interests`).catch(() => []);
  if (!setup || (!setup.money_skills?.length && !setup.money_city)) return { ok: false, error: 'Add your skills, free hours, budget and city first (Money Move → Your inputs).' };
  const declined = await sb.get<{ move: MoneyMove; reason: string | null }>(`money_moves?user_id=eq.${u}&status=eq.not_for_me&order=created_at.desc&limit=6&select=move,reason`).catch(() => []);
  const inputs: MoneyInputs = { skills: setup.money_skills ?? [], hours_per_week: setup.money_hours_per_week, budget_usd: setup.money_budget_usd, city: setup.money_city, interests: setup.money_interests ?? [], declined: declined.map((d) => `${d.move.title}${d.reason ? ` (${d.reason})` : ''}`) };
  const research = await researchSearch(sb, u, `Local, current ways to earn money this week in ${inputs.city ?? 'the US'} for someone with skills: ${inputs.skills.join(', ')}; ${inputs.hours_per_week ?? '?'} free hours; $${inputs.budget_usd ?? 0} budget.`, [`${inputs.skills[0] ?? 'side job'} ${inputs.city ?? ''} prices`, `${inputs.city ?? ''} weekend gig demand`]).catch(() => null);
  const user = [
    `Skills: ${inputs.skills.join(', ') || 'not given'}. Interests: ${inputs.interests.join(', ') || 'not given'}.`,
    `Free hours per week: ${inputs.hours_per_week ?? 'unknown'}. Startup budget: $${inputs.budget_usd ?? 0}. City: ${inputs.city ?? 'unknown'}.`,
    inputs.declined.length ? `Already said no to (don't repeat): ${inputs.declined.join('; ')}` : '',
    research ? `Research:\n${research.brief}` : 'No live research available — use web search if you have it, and only cite real URLs.',
  ].filter(Boolean).join('\n\n');
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.writer, system: moneySystem(), user, maxTokens: 2500, domain: DOMAIN, userId: u, date: today, capUsd: 1, ...(research ? {} : { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as never] }) });
  const move = parseMoneyMove(res.text);
  if (!move.sources.length && research) move.sources = research.sources.slice(0, 4);
  const problem = moneyMoveProblem(move, inputs, move.startup_cost_usd);
  if (problem || !move.title) return { ok: false, error: `This week's move was dropped: ${problem ?? 'empty answer'}. Try again.` };
  const [row] = await sb.insert<{ id: string }>('money_moves', { user_id: u, week_start: ws, move, status: 'new' }, { upsert: 'user_id,week_start' });
  return { ok: true, move, id: row?.id };
}

// ── Peptides ──────────────────────────────────────────────────────────
export async function peptideSummary(apiKey: string | undefined, sb: Sb, u: string, question?: string): Promise<string> {
  const [rows, logs] = await Promise.all([
    sb.get<{ id: string; name: string; amount: string | null; unit: string | null; days: string[]; times: string[]; vial_remaining: number | null; per_dose: number | null; reorder_at_doses: number | null; active: boolean; notes: string | null }>(`peptides?user_id=eq.${u}&select=id,name,amount,unit,days,times,vial_remaining,per_dose,reorder_at_doses,active,notes`),
    sb.get<{ peptide_id: string; taken_at: string; amount: string | null; site: string | null; effects: string | null }>(`peptide_logs?user_id=eq.${u}&order=taken_at.desc&limit=120&select=peptide_id,taken_at,amount,site,effects`),
  ]);
  if (!rows.length) return `Nothing logged yet. ${PEPTIDE_FOOTER}`;
  const user = [
    `What they track:\n${rows.map((r) => `- ${r.name}: logged amount ${r.amount ?? '?'} ${r.unit ?? ''}, schedule ${r.days.join(' ')} ${r.times.join(' ')}${dosesLeft(r) != null ? `, ${dosesLeft(r)} doses left${needsReorder(r) ? ' (reorder soon)' : ''}` : ''}${r.active ? '' : ' (paused)'}`).join('\n')}`,
    `Their log (newest first):\n${logs.map((l) => `- ${l.taken_at.slice(0, 16)} ${rows.find((r) => r.id === l.peptide_id)?.name ?? '?'} ${l.amount ?? ''}${l.site ? ` site ${l.site}` : ''}${l.effects ? ` — "${l.effects}"` : ''}`).join('\n') || '(no entries)'}`,
    question ? `Their question: ${question.slice(0, 500)}` : 'Summarize the last 30 days.',
  ].join('\n\n');
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.parse, system: PEPTIDE_SYSTEM_PROMPT, user, maxTokens: 900, domain: DOMAIN, userId: u, date: zonedNow(TZ).date, capUsd: 0.5 });
  return res.text.includes(PEPTIDE_FOOTER) ? res.text : `${res.text}\n\n${PEPTIDE_FOOTER}`;
}

// ── Cron (every 5 minutes) ────────────────────────────────────────────
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/** True once per 5-minute window that contains hh:mm. Pure. */
export function inWindow(minutes: number, hhmm: string): boolean {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (h || 0) * 60 + (m || 0);
  return minutes >= t && minutes < t + 5;
}

export async function runSoloTick(env: { ANTHROPIC_API_KEY?: string }, sb: Sb): Promise<void> {
  const z = zonedNow(TZ);
  const dayKey = DAY_KEYS[z.dow];
  // Tasks due today: one push at 8:00.
  if (inWindow(z.minutes, '08:00')) {
    const due = await sb.get<{ id: string; user_id: string; title: string }>(`tasks?done=eq.false&due=eq.${z.date}&reminded_at=is.null&select=id,user_id,title&limit=500`).catch(() => []);
    const byUser = new Map<string, typeof due>();
    for (const t of due) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);
    for (const [u, ts] of byUser) {
      await notifyStored(sb, u, 'task_due', { title: ts.length === 1 ? `Due today: ${ts[0].title}` : `${ts.length} tasks due today`, body: ts.slice(0, 5).map((t) => `• ${t.title}`).join('\n'), deepLink: 'tasks' });
      await sb.patch('tasks', `id=in.(${ts.map((t) => t.id).join(',')})`, { reminded_at: new Date().toISOString() }).catch(() => {});
    }
  }
  // Peptide reminders at their logged times (tracking only).
  const peps = await sb.get<{ id: string; user_id: string; name: string; days: string[]; times: string[] }>(`peptides?active=eq.true&days=cs.{${dayKey}}&select=id,user_id,name,days,times&limit=1000`).catch(() => []);
  for (const p of peps) if (p.times.some((t) => inWindow(z.minutes, t))) await notifyStored(sb, p.user_id, 'peptide_reminder', { title: `${p.name}: logged for now`, body: 'Tap to log it. Tracking only, not medical advice.', deepLink: 'peptides' });
  // Weekly check-in: build it at each user's day/hour, then tell them.
  if (z.minutes % 60 < 5) {
    const due = await sb.get<{ user_id: string }>(`user_setup?checkin_dow=eq.${z.dow}&checkin_hour=eq.${Math.floor(z.minutes / 60)}&select=user_id&limit=200`).catch(() => []);
    for (const s of due) {
      const ws = checkinWeekStart(z.date);
      const have = await sb.get<{ id: string }>(`weekly_reviews?user_id=eq.${s.user_id}&week_start=eq.${ws}&notified_at=not.is.null&select=id`).catch(() => []);
      if (have.length) continue;
      try {
        const r = await runCheckin(env.ANTHROPIC_API_KEY, sb, s.user_id, ws);
        await sb.patch('weekly_reviews', `id=eq.${r.id}`, { notified_at: new Date().toISOString() });
        await notifyStored(sb, s.user_id, 'weekly_checkin', { title: 'Your weekly check-in is ready', body: r.focus ? `Focus for next week: ${r.focus}` : r.summary.slice(0, 140), deepLink: 'weekly-review' });
      } catch (e) { console.error('checkin', e); }
    }
  }
  // Money Move: Monday 08:00 for everyone with inputs who doesn't have one yet.
  if (z.dow === 1 && inWindow(z.minutes, '08:00')) {
    const ws = weekOf(z.date).start;
    const people = await sb.get<{ user_id: string }>('user_setup?money_city=not.is.null&select=user_id&limit=200').catch(() => []);
    for (const p of people) {
      const have = await sb.get<{ id: string }>(`money_moves?user_id=eq.${p.user_id}&week_start=eq.${ws}&select=id`).catch(() => []);
      if (have.length) continue;
      const r = await runMoneyMove(env.ANTHROPIC_API_KEY, sb, p.user_id).catch((e) => ({ ok: false, error: String(e) }));
      if (r.ok && 'move' in r && r.move) await notifyStored(sb, p.user_id, 'money_move', { title: `This week's Money Move: ${r.move.title}`.slice(0, 120), body: r.move.why_you.slice(0, 160), deepLink: 'money-move' });
    }
  }
  // Feed reactions: batched, at most once an hour per person.
  if (z.minutes % 15 < 5) {
    const since = new Date(Date.now() - 2 * 3600000).toISOString();
    const rx = await sb.get<{ post_id: string; user_id: string; emoji: string; created_at: string; feed_posts: { user_id: string } | null }>(`feed_reactions?created_at=gte.${since}&select=post_id,user_id,emoji,created_at,feed_posts(user_id)&limit=2000`).catch(() => []);
    const byOwner = new Map<string, typeof rx>();
    for (const r of rx) { const o = r.feed_posts?.user_id; if (o && o !== r.user_id) byOwner.set(o, [...(byOwner.get(o) ?? []), r]); }
    for (const [owner, list] of byOwner) {
      const [s] = await sb.get<{ feed_notice_at: string | null }>(`user_setup?user_id=eq.${owner}&select=feed_notice_at`).catch(() => []);
      const n = reactionNotice(list, s?.feed_notice_at ?? null, new Date());
      if (!n.send) continue;
      await notifyStored(sb, owner, 'feed_reactions', { title: n.text, deepLink: 'feed' });
      await sb.insert('user_setup', { user_id: owner, feed_notice_at: new Date().toISOString() }, { upsert: 'user_id' }).catch(() => {});
    }
  }
}
