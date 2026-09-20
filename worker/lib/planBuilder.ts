/** Deterministic daily-plan builder.
 *
 *  Pure — no fetch, no Date.now(), nothing from the Workers runtime — so it
 *  can be unit-tested with plain node and reused by both the overnight cron
 *  (daily-plan.ts) and the on-demand "build today's plan now" route. The
 *  cron may layer AI-suggested blocks on top; everything here is the floor
 *  that exists whether or not that call succeeds.
 *
 *  Why deterministic: the previous generator was 100% a Claude call. When
 *  it failed, or ran for nobody (its user list came from push subscriptions,
 *  of which there were zero), the plan was empty — and an empty plan means
 *  the 4pm calling hour, the one thing that produces money, wasn't on the
 *  page. The calling hour is now written by code, every day, no model in
 *  the loop.
 */

export interface PlanShift { start_time: string; end_time: string }
export interface PlanEvent { type: string; start_time: string; end_time: string; label: string }
export interface PlanStep {
  id: string;
  goal_id: string;
  goal_title: string;
  description: string;
  frequency: string | null;
  done: boolean;
  auto_tracked_source: string | null;
}
export interface PlanReminder { id: string; title: string; due_date: string }

export interface PlanBlock {
  time: string;
  duration: number;
  title: string;
  detail: string;
  type: 'fixed' | 'goal' | 'fitness' | 'macros' | 'dialing' | 'ai_suggested';
  module: 'dialing' | 'fitness' | 'work-shift' | 'client-work' | 'goal' | 'manual';
  /** Machine-readable origin. The notification pass keys off 'dials-leads'
   *  and 'dials-calls' to know when to fire, so those two are a contract. */
  source: string | null;
}

export interface PlanInput {
  /** YYYY-MM-DD, in the store's timezone. */
  date: string;
  shifts: PlanShift[];
  events: PlanEvent[];
  steps: PlanStep[];
  overdue: PlanReminder[];
}

export const CALL_HOUR_DEFAULT = 16 * 60;   // 4:00 PM
export const CALL_HOUR_LENGTH = 60;
export const REVIEW_TIME = 19 * 60;         // Sunday 7:00 PM
export const REVIEW_LENGTH = 15;
export const DAY_START = 6 * 60;
export const DAY_END = 21 * 60;

export const WEEKLY_REVIEW_QUESTIONS = [
  'How many calls did I actually make this week?',
  'What did people push back on most?',
  'What is the one thing I change next week?',
];

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function toTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function roundUp(mins: number, step: number): number {
  return Math.ceil(mins / step) * step;
}
export function dayOfWeek(date: string): number {
  // Constructed from parts so the result is the calendar weekday of that
  // date, not of that date shifted by the runtime's UTC offset.
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
export function isDaily(frequency: string | null): boolean {
  return /^\s*(daily|every ?day|each ?day)\b/i.test(frequency ?? '');
}
export function isWeekly(frequency: string | null): boolean {
  return /^\s*(weekly|every ?week|each ?week)\b/i.test(frequency ?? '');
}

/** When the calling hour starts.
 *
 *  4:00 by default. If a shift runs to 4:00 (or later), the block moves to
 *  half an hour after the shift ends rather than being dropped — the spec
 *  is explicit that a late shift shifts the hour, it never skips it. */
export function callStartFor(shifts: PlanShift[]): number {
  let latestEnd = -1;
  for (const s of shifts) latestEnd = Math.max(latestEnd, toMinutes(s.end_time));
  if (latestEnd < 0) return CALL_HOUR_DEFAULT;
  const earliest = roundUp(latestEnd + 30, 30);
  return Math.max(CALL_HOUR_DEFAULT, earliest);
}

/** Which of the DIALS daily steps a step is, by what it says. The seeded
 *  steps are matched on wording rather than on id so re-typing a step, or
 *  adding it by hand, still lands in the right slot. */
function dialsRole(step: PlanStep): 'leads' | 'calls' | 'log' | 'followup' | null {
  const d = step.description.toLowerCase();
  if (/dialing list|lead pool|move leads/.test(d)) return 'leads';
  if (/protected hour|4:00|call\b.*5:00|calling hour/.test(d)) return 'calls';
  if (step.auto_tracked_source === 'dialing_calls' || /log calls made/.test(d)) return 'log';
  if (/send me info|follow.?up/.test(d)) return 'followup';
  return null;
}

export function buildPlan(input: PlanInput): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  const taken = new Set<number>(); // hours claimed, so unplaced steps find free rows
  const claim = (mins: number) => taken.add(Math.floor(mins / 60));

  // ── Overdue reminders, at the top of the day ─────────────────────────
  // First row, so it's the first thing seen. A reminder that's past due
  // and silent is the failure mode this exists to prevent.
  if (input.overdue.length > 0) {
    const lines = input.overdue.map((r) => {
      const late = daysBetween(r.due_date, input.date);
      return `• ${r.title} — ${late} day${late === 1 ? '' : 's'} overdue`;
    });
    blocks.push({
      time: toTime(DAY_START), duration: 15,
      title: `Overdue: ${input.overdue.length} reminder${input.overdue.length === 1 ? '' : 's'}`,
      detail: lines.join('\n'),
      type: 'fixed', module: 'manual', source: 'overdue',
    });
    claim(DAY_START);
  }

  // ── Shifts: one block per hour, so every hour of a shift reads blocked ─
  for (const s of input.shifts) {
    const start = toMinutes(s.start_time);
    const end = toMinutes(s.end_time);
    if (end <= start) continue;
    for (let t = start; t < end; t = Math.floor(t / 60) * 60 + 60) {
      const hourEnd = Math.min(end, Math.floor(t / 60) * 60 + 60);
      blocks.push({
        time: toTime(t), duration: hourEnd - t,
        title: 'Work — unavailable',
        detail: `Shift ${fmt(start)}–${fmt(end)}.`,
        type: 'fixed', module: 'work-shift', source: 'shift',
      });
      claim(t);
    }
  }

  // ── Calendar events (non-shift) ──────────────────────────────────────
  for (const e of input.events) {
    const start = toMinutes(e.start_time);
    blocks.push({
      time: e.start_time.slice(0, 5), duration: Math.max(15, toMinutes(e.end_time) - start),
      title: e.label, detail: `${fmt(start)}–${fmt(toMinutes(e.end_time))}, from Schedule.`,
      type: 'fixed', module: e.type === 'dialing' ? 'dialing' : 'client-work', source: `event`,
    });
    claim(start);
  }

  // ── The DIALS floor: always, every day ───────────────────────────────
  const callStart = callStartFor(input.shifts);
  const leadsAt = callStart - 30;
  const setupAt = callStart - 15;
  const shifted = callStart !== CALL_HOUR_DEFAULT;

  const dials = input.steps.filter((s) => isDaily(s.frequency));
  const byRole = { leads: [] as PlanStep[], calls: [] as PlanStep[], log: [] as PlanStep[], followup: [] as PlanStep[] };
  const unplaced: PlanStep[] = [];
  for (const s of dials) {
    const role = dialsRole(s);
    if (role) byRole[role].push(s);
    else unplaced.push(s);
  }

  blocks.push({
    time: toTime(leadsAt), duration: 15,
    title: 'Move leads into the dialing list',
    detail: [
      'LeadFlow → Lead Pool → pick the city → Send 20.',
      shifted ? `Shift ran late today, so calls start ${fmt(callStart)} instead of 4:00.` : '',
      ...byRole.leads.map((s) => `Goal step: ${s.description}`),
    ].filter(Boolean).join('\n'),
    type: 'dialing', module: 'dialing', source: 'dials-leads',
  });
  claim(leadsAt);

  blocks.push({
    time: toTime(setupAt), duration: 15,
    title: 'Set up for calls',
    detail: 'Pitch open on Dialing, queue sorted, phone charged, water. Nothing else open.',
    type: 'dialing', module: 'dialing', source: 'dials-setup',
  });

  blocks.push({
    time: toTime(callStart), duration: CALL_HOUR_LENGTH,
    title: `Calling hour — protected (${fmt(callStart)}–${fmt(callStart + CALL_HOUR_LENGTH)})`,
    detail: [
      'Non-negotiable floor. This is the only activity that produces money; everything else is downstream.',
      ...byRole.calls.map((s) => `Goal step: ${s.description}`),
      ...byRole.log.map((s) => `Goal step: ${s.description}${s.auto_tracked_source ? ' (counted live from Dialing)' : ''}`),
    ].join('\n'),
    type: 'dialing', module: 'dialing', source: 'dials-calls',
  });
  claim(callStart);

  const followAt = callStart + CALL_HOUR_LENGTH;
  blocks.push({
    time: toTime(followAt), duration: 15,
    title: 'Follow-ups — every "send me info"',
    detail: [
      'Log each one on the lead. Anything from three days ago gets called back now.',
      ...byRole.followup.map((s) => `Goal step: ${s.description}`),
    ].join('\n'),
    type: 'dialing', module: 'dialing', source: 'dials-followups',
  });
  claim(followAt);

  // ── Every other daily step gets a slot, or it does not happen ────────
  // Evenings after follow-ups first, then mornings before the day starts
  // filling. Whole hours, because the plan view is one row per hour.
  const candidates: number[] = [];
  for (let t = roundUp(followAt + 15, 60); t < DAY_END; t += 60) candidates.push(t);
  for (let t = DAY_START; t < leadsAt; t += 60) candidates.push(t);
  for (const s of unplaced) {
    const slot = candidates.find((t) => !taken.has(Math.floor(t / 60)));
    if (slot == null) break; // out of hours — surfaced in the review block below rather than silently dropped
    blocks.push({
      time: toTime(slot), duration: 30,
      title: s.description,
      detail: `Daily step on ${s.goal_title}.`,
      type: 'goal', module: 'goal', source: `step:${s.id}`,
    });
    claim(slot);
  }

  // ── Sunday: the weekly review, 15 minutes, three questions ───────────
  if (dayOfWeek(input.date) === 0) {
    let at = REVIEW_TIME;
    while (taken.has(Math.floor(at / 60)) && at < DAY_END) at += 60;
    const weekly = input.steps.filter((s) => isWeekly(s.frequency) && !s.done);
    blocks.push({
      time: toTime(at), duration: REVIEW_LENGTH,
      title: 'Weekly review — 15 min',
      detail: [
        ...WEEKLY_REVIEW_QUESTIONS.map((q, i) => `${i + 1}. ${q}`),
        'Answer in a check-in on the DIALS goal. Short. Long reviews do not get done.',
        weekly.length ? '' : null,
        weekly.length ? 'This week\'s weekly steps:' : null,
        ...weekly.map((s) => `• ${s.description} (${s.goal_title})`),
      ].filter((l): l is string => l != null).join('\n'),
      type: 'goal', module: 'goal', source: 'weekly-review',
    });
    claim(at);
  }

  return blocks.sort((a, b) => a.time.localeCompare(b.time));
}

/** The two pushes the plan fires, at the plan's own times — so a shifted
 *  calling hour shifts its notification with it. */
export function planNotifications(blocks: PlanBlock[]): { source: string; time: string; title: string; body: string }[] {
  const out: { source: string; time: string; title: string; body: string }[] = [];
  const leads = blocks.find((b) => b.source === 'dials-leads');
  const calls = blocks.find((b) => b.source === 'dials-calls');
  if (leads) out.push({ source: 'dials-leads', time: leads.time, title: 'Move your leads', body: 'Lead Pool → pick the city → Send 20 to Dialing.' });
  if (calls) out.push({ source: 'dials-calls', time: calls.time, title: 'Start dialing', body: `Protected hour, ${fmt(toMinutes(calls.time))}–${fmt(toMinutes(calls.time) + CALL_HOUR_LENGTH)}. Phone up.` });
  return out;
}

function fmt(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** Blocks the builder owns. Everything else in a plan — a block you added
 *  by hand, a Nova suggestion — is yours, and a resync must leave it alone. */
export function isFloorSource(source: string | null): boolean {
  if (!source) return false;
  return source === 'overdue' || source === 'shift' || source === 'event' || source === 'weekly-review'
    || source.startsWith('dials-') || source.startsWith('step:');
}

/** Replace the floor of an existing plan with a freshly built one.
 *
 *  A plan is a snapshot: built at 2am, or on first open. A shift entered
 *  after that — this morning, for today — was invisible to it, and the
 *  calling hour stayed at 4:00 even when the shift ran to 4:00. This is
 *  what the on-open route calls so the plan tracks the schedule instead of
 *  the moment it was generated.
 *
 *  Kept: every non-floor block, unless it now sits inside a shift hour
 *  (you can't do it while at work, and leaving it there would read as a
 *  plan). Replaced: every floor block. Returns null when nothing changed,
 *  so the caller can skip the write. */
export function mergePlan(existing: PlanBlock[], fresh: PlanBlock[]): PlanBlock[] | null {
  const shiftHours = new Set(fresh.filter((b) => b.source === 'shift').map((b) => Math.floor(toMinutes(b.time) / 60)));
  const kept = existing.filter((b) => !isFloorSource(b.source) && !shiftHours.has(Math.floor(toMinutes(b.time) / 60)));
  const next = [...fresh, ...kept].sort((a, b) => a.time.localeCompare(b.time) || (isFloorSource(a.source) ? -1 : 1));
  // Order-insensitive: a plan stored in a different block order is the same
  // plan, and treating it as changed would rewrite the row on every open.
  const key = (bs: PlanBlock[]) => JSON.stringify(bs.map((b) => JSON.stringify([b.time, b.duration, b.title, b.detail, b.type, b.module, b.source])).sort());
  return key(next) === key(existing) ? null : next;
}
