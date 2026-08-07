// Opening/Closing checklist — store hours, task lists, and the pure
// scheduling math. Kept free of React/Supabase so it's easy to tweak the
// config below without touching any UI or persistence code.

export interface StoreHoursEntry {
  open: string; // "HH:MM", 24h
  close: string;
}

// Edit this to change store hours per weekday (0 = Sunday ... 6 = Saturday).
export const STORE_HOURS: Record<number, StoreHoursEntry> = {
  0: { open: '07:00', close: '21:00' },
  1: { open: '05:00', close: '22:00' },
  2: { open: '05:00', close: '22:00' },
  3: { open: '05:00', close: '22:00' },
  4: { open: '05:00', close: '22:00' },
  5: { open: '05:00', close: '23:00' },
  6: { open: '05:00', close: '23:00' },
};

export interface TaskDef {
  name: string;
  duration: number; // minutes
}

// Opening schedule starts 60 minutes before open and runs these
// sequentially from there (see buildSchedule) — edit freely.
export const OPENING_TASKS: TaskDef[] = [
  { name: 'Clock in', duration: 1 },
  { name: 'Check In', duration: 1 },
  { name: 'Enter gas prices — Holiday Oil Gas Price', duration: 5 },
  { name: 'Cash trays into registers, open both under your number', duration: 8 },
  { name: 'Start safe — 10 min unlock', duration: 10 },
  { name: 'Start roller grill, sandwiches, coffee, pull calzones, oven on', duration: 15 },
  { name: 'ATM amounts — log in, password 258789, settlement, day total, set cassette x2 (150), cancel x3', duration: 8 },
  { name: 'Bottom of ATM — passcode 239010#, check reject always', duration: 5 },
  { name: 'Safe — stick tubes, fill coin slots, count coin rolls, pull drop envelopes', duration: 12 },
  { name: 'Drop sheet + envelopes to office, opening worksheets, report shortcuts, print Store Close report pgs 1-4', duration: 15 },
];

// Closing schedule is backed off from close time by the sum of these
// durations, so the last task lands exactly at close — edit freely (the
// backward math re-sums automatically, no need to keep a running total).
export const CLOSING_TASKS: TaskDef[] = [
  { name: 'Lemons/limes full, stock cups/lids/straws', duration: 10 },
  { name: 'Sweep parking lot, check outside trash', duration: 15 },
  { name: 'Donuts to discount box, clean case, replace parchment', duration: 10 },
  { name: 'Check/stock bathrooms', duration: 10 },
  { name: 'Fill Frazil + Frappuccino machines', duration: 10 },
  { name: 'Write off food, clean roller grill, parchment on drip pans', duration: 15 },
  { name: 'Stock donuts if arrived', duration: 5 },
  { name: 'Clean & fill condiment bar, wipe w/ Protero', duration: 15 },
  { name: 'Dishes', duration: 15 },
  { name: 'Empty outside trash', duration: 10 },
  { name: 'Bag popcorn, clean machine', duration: 10 },
  { name: 'Clean Franke machine', duration: 10 },
  { name: 'Dump/clean drip trays', duration: 5 },
  { name: 'Empty & wash lemon/lime container', duration: 10 },
  { name: 'Clean bathrooms thoroughly', duration: 15 },
  { name: 'Fountain nozzles, inside trash', duration: 5 },
  { name: 'Face aisles, push cooler forward', duration: 5 },
  { name: 'Spot sweep floors', duration: 5 },
  { name: 'Vacuum carpets', duration: 10 },
  { name: 'Mop floors', duration: 10 },
  { name: 'Prep coffee packs/filters — 2 Hive, 1 each other flavor', duration: 5 },
];

export const NUDGE_POOL = ['Walk the floor', 'Front-face an aisle', 'Check the bathrooms', 'Wipe down the counter'];

export type TaskKind = 'opening' | 'closing' | 'till' | 'nudge';
export type TaskStatus = 'done' | 'current' | 'upcoming' | 'overdue';

export interface ScheduledTask {
  id: string;
  name: string;
  duration: number;
  at: Date;
  endAt: Date;
  kind: TaskKind;
}

export interface Milestone {
  id: string;
  at: Date;
  message: string;
}

export interface DaySchedule {
  weekday: number;
  openTime: Date;
  closeTime: Date;
  shiftMinutes: number;
  tasks: ScheduledTask[]; // opening + nudges + closing + till, chronological
  milestones: Milestone[];
}

export function parseTimeOnDate(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Tiny deterministic PRNG seeded by a string, so nudge placement is stable
 *  across re-renders/reloads within the same day but varies day to day. */
function seededRandom(seedStr: string): () => number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h, 1103515245) + 12345) | 0;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function buildNudges(gapStart: Date, gapEnd: Date, rand: () => number): ScheduledTask[] {
  const totalMs = gapEnd.getTime() - gapStart.getTime();
  if (totalMs <= 0) return [];
  const count = 2 + Math.floor(rand() * 3); // 2-4
  const bucketMs = totalMs / count;
  const nudges: ScheduledTask[] = [];
  for (let i = 0; i < count; i++) {
    const bucketStart = gapStart.getTime() + i * bucketMs;
    const offset = bucketMs * (0.2 + rand() * 0.6); // avoid bucket edges, so nudges don't cluster
    const at = new Date(bucketStart + offset);
    const name = NUDGE_POOL[Math.floor(rand() * NUDGE_POOL.length)];
    nudges.push({ id: `nudge-${i}`, name, duration: 5, at, endAt: new Date(at.getTime() + 5 * 60000), kind: 'nudge' });
  }
  return nudges;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Builds the full day's schedule from `now` — today's weekday, store
 *  hours, opening/closing task timestamps, gap-filler nudges, the
 *  till-count/clock-out task, and long-shift milestones. Pure function of
 *  `now`; call it fresh on every tick rather than caching. */
export function buildSchedule(now: Date): DaySchedule {
  const weekday = now.getDay();
  const hours = STORE_HOURS[weekday];
  const openTime = parseTimeOnDate(now, hours.open);
  const closeTime = parseTimeOnDate(now, hours.close);

  let cursor = new Date(openTime.getTime() - 60 * 60000);
  const opening: ScheduledTask[] = OPENING_TASKS.map((t, i) => {
    const at = new Date(cursor);
    const endAt = new Date(cursor.getTime() + t.duration * 60000);
    cursor = endAt;
    return { id: `opening-${i}`, name: t.name, duration: t.duration, at, endAt, kind: 'opening' as const };
  });

  const totalClosingMinutes = CLOSING_TASKS.reduce((sum, t) => sum + t.duration, 0);
  let closingCursor = new Date(closeTime.getTime() - totalClosingMinutes * 60000);
  const closing: ScheduledTask[] = CLOSING_TASKS.map((t, i) => {
    const at = new Date(closingCursor);
    const endAt = new Date(closingCursor.getTime() + t.duration * 60000);
    closingCursor = endAt;
    return { id: `closing-${i}`, name: t.name, duration: t.duration, at, endAt, kind: 'closing' as const };
  });

  const tillTask: ScheduledTask = {
    id: 'till-count',
    name: 'Count tills, input numbers, clock out',
    duration: 10,
    at: closeTime,
    endAt: new Date(closeTime.getTime() + 10 * 60000),
    kind: 'till',
  };

  const gapStart = opening.length ? opening[opening.length - 1].endAt : openTime;
  const gapEnd = closing.length ? closing[0].at : closeTime;
  const rand = seededRandom(`${dateKey(now)}-${weekday}`);
  const nudges = buildNudges(gapStart, gapEnd, rand);

  const shiftMinutes = (closeTime.getTime() - openTime.getTime()) / 60000;
  const milestones: Milestone[] = [];
  if (shiftMinutes > 360) {
    const halfMinutes = Math.round(shiftMinutes / 2);
    milestones.push({
      id: 'milestone-half',
      at: new Date(openTime.getTime() + halfMinutes * 60000),
      message: `Halfway through the shift — ${formatDuration(halfMinutes)} down, ${formatDuration(halfMinutes)} to go.`,
    });
    milestones.push({
      id: 'milestone-2hr',
      at: new Date(closeTime.getTime() - 120 * 60000),
      message: "2 hours left — you've already knocked out the hard stuff.",
    });
    milestones.push({
      id: 'milestone-final',
      at: tillTask.at,
      message: 'Final task — count the tills and you\'re out.',
    });
  }

  const tasks = [...opening, ...nudges, ...closing, tillTask].sort((a, b) => a.at.getTime() - b.at.getTime());

  return { weekday, openTime, closeTime, shiftMinutes, tasks, milestones };
}

export function taskStatus(task: ScheduledTask, now: Date, done: boolean): TaskStatus {
  if (done) return 'done';
  if (now < task.at) return 'upcoming';
  if (now < task.endAt) return 'current';
  return 'overdue';
}
