// Product page copy: the solo Masterminds plan only (no Made by Marq,
// Scaling or E-commerce tools — those are Marq's own and aren't sold here).
// Screenshots are public/site/product/*.webp, captured from the app's demo
// mode on made-up sample data (see docs/PUBLIC-SITE.md → Product page).

import { MODULE_REGISTRY, SOLO_LINEUP } from '../modules.config';

export type Depth = 'deep' | 'standard' | 'light';
export interface ProductModule {
  key: string;
  name: string;
  group: 'Personal' | 'Cold Calling' | 'Side Hustles';
  depth: Depth;
  /** One line: what it is. */
  line: string;
  /** Deep and standard: how it works, step by step. */
  how?: string[];
  /** What it reads from and writes to elsewhere in the app. */
  links?: string[];
  img: string;
  alt: string;
}


/** Pixel height of each 1600-wide screenshot (trimmed to its content). */
export const SHOT_H: Record<string, number> = {'daily-plan':963, 'macros': 1178, 'goals': 1139, 'brain': 1247, 'schedule': 932, 'fitness': 814, 'opening-closing': 1247, 'dialing': 1247, 'stocks': 1247, 'streaming': 1247, 'sticky-spot': 901};

const DETAILED: ProductModule[] = [
  {
    key: 'goals', name: 'Goals', group: 'Personal', depth: 'deep',
    line: 'You set the finish line. It works backward to today.',
    how: [
      'Name the goal, the date and why it matters. A dollar amount, a daily rate (35 dials a day) or a count of things to finish.',
      'Masterminds works backward from the deadline and lays out two or three different paths to get there, each with the actions it takes and how often.',
      'You commit to one. Its actions become steps, and the steps land on your Daily Plan on the days they\'re due.',
      'Pace is measured against the date, not a checklist: on pace, ahead, or behind by how many days. Some steps count themselves — dials you make in Dialing tick the goal without you logging anything.',
      'Check-ins come on the rhythm you pick. If you slip, the goal says what it costs you ("skip one week and you\'re 4 days behind") and what fixes it.',
    ],
    links: ['Daily Plan', 'Dialing', 'Schedule'],
    img: 'goals', alt: 'Goals screen with three active goals, each showing its committed path, pace bar and next step',
  },
  {
    key: 'daily-plan', name: 'Daily Plan', group: 'Personal', depth: 'deep',
    line: 'Your day, built before you wake up.',
    how: [
      'Every morning it reads your calendar, today\'s work shift, your goals\' committed steps, overdue reminders, your workout plan and your nutrition targets.',
      'It builds one timeline around the fixed things: the shift stays where it is, the workout moves off shift hours, the calling hour sits in the hour you connect best.',
      'A push notification says it\'s ready. Confirm it, drag blocks, or press Replan when the day changes.',
      'As you finish blocks it tracks focus time and what\'s left, and anything you skip carries to tomorrow instead of disappearing.',
    ],
    links: ['Schedule', 'Goals', 'Fitness', 'Macros & Meals', 'Dialing'],
    img: 'daily-plan', alt: 'Daily Plan timeline: a morning run, deep work, a callback, a dial hour, meal prep and an evening work shift',
  },
  {
    key: 'schedule', name: 'Schedule', group: 'Personal', depth: 'deep',
    line: 'One calendar that knows about your job.',
    how: [
      'Month, day and shifts views of the same calendar. Drag across the day to block time.',
      'Add your work shifts by hand, or take a photo of the posted schedule and they\'re read in for you.',
      'Shifts aren\'t just entries: on shift days the Daily Plan builds around them, workouts move to the hours you\'re free, and Opening/Closing switches on its checklist.',
      'Callbacks you book in Dialing and streams you schedule land here on their own, so there\'s one place that shows the whole week — and how many free blocks are left in today.',
    ],
    links: ['Daily Plan', 'Fitness', 'Opening/Closing', 'Dialing', 'Streaming'],
    img: 'schedule', alt: 'Schedule month view with events today, shift hours this week, free blocks and a heat map of busy days',
  },
  {
    key: 'macros', name: 'Macros & Meals', group: 'Personal', depth: 'deep',
    line: 'Take a picture of the plate. That\'s the log.',
    how: [
      'Snap a photo of what you\'re eating — home cooking or a restaurant meal. Calories, protein, carbs and fat are estimated from the picture; fix any number before it saves.',
      'Packaged food scans by barcode instead.',
      'Daily targets for calories and each macro sit in rings that show what\'s left for the day, not just what you ate.',
      'Water and symptoms log in a tap, and the week view shows the days you hit protein and the days you didn\'t.',
    ],
    links: ['Daily Plan', 'Fitness'],
    img: 'macros', alt: 'Macros & Meals: calorie and macro rings, three meals logged from photos and a barcode, water glasses',
  },
  {
    key: 'brain', name: 'Brain', group: 'Personal', depth: 'deep',
    line: 'How you actually sell and follow through — measured, not guessed.',
    how: [
      'A four-minute assessment: 24 real situations ("a prospect goes quiet after a good call…") plus a few short statements. No right answers.',
      'You get a profile on six scales — drive, connection, steadiness, detail, follow-through and how you hold up under pressure — and what that means for how you work.',
      'A daily check-in takes seconds. Your call data does the rest: your best and worst calling hours, and how today compares to your two-week pattern.',
      'The map shows which habits are running hot and which are underused, and each week three short exercises are picked for the areas you use least.',
    ],
    links: ['Dialing', 'Daily Plan'],
    img: 'brain', alt: 'Brain screen: best and worst calling hour, a six-scale profile and a map of focus, habit, memory, drive and reaction',
  },
  {
    key: 'fitness', name: 'Fitness', group: 'Personal', depth: 'standard',
    line: 'A training plan that fits around your week.',
    how: [
      'Answer a few questions and choose between two plans built for your goal and schedule.',
      'Every workout is in the library, and live workout mode walks you through sets and rest.',
      'Workouts go on your Daily Plan on free hours, and the week view shows days trained and minutes logged.',
    ],
    links: ['Daily Plan', 'Schedule'],
    img: 'fitness', alt: 'Fitness: workouts this month, days trained this week, today\'s logged session and workouts per week',
  },
  {
    key: 'opening-closing', name: 'Opening/Closing', group: 'Personal', depth: 'standard',
    line: 'The shift checklist that runs itself.',
    how: [
      'On days you have a shift, the opening or closing checklist shows up with a time on every step.',
      'Real push notifications tell you when a step is due, so nothing depends on remembering.',
      'Tick steps off as you go; it shows whether you\'re on time for the close and keeps the history of your last seven.',
    ],
    links: ['Schedule'],
    img: 'opening-closing', alt: 'Closing checklist with timed steps, due-by time and progress ring',
  },
  {
    key: 'dialing', name: 'Dialing/Contacts', group: 'Cold Calling', depth: 'deep',
    line: 'A calling queue that\'s wired into the rest of your day.',
    how: [
      'Your contacts become a queue. Press Start dialing, call, and log the outcome in one tap: no answer, voicemail, conversation, booked.',
      'Booked calls and callbacks go straight onto your Schedule at the time you set, and show up on that day\'s plan.',
      'Every dial counts toward your goal automatically — "35 a day" ticks itself.',
      'Connect rate by hour feeds Brain, which is how the Daily Plan knows to put your calling hour where you actually get people on the phone.',
    ],
    links: ['Schedule', 'Goals', 'Brain', 'Daily Plan'],
    img: 'dialing', alt: 'Dialing: calls today against the goal, calls per hour, connect rate, the up-next queue and outcome breakdown',
  },
  {
    key: 'stocks', name: 'Stocks', group: 'Side Hustles', depth: 'light',
    line: 'A paper-trading bot with a plain-English daily note. Practice money only.',
    img: 'stocks', alt: 'Stocks: paper portfolio value and chart, daily commentary and positions',
  },
  {
    key: 'streaming', name: 'Streaming', group: 'Side Hustles', depth: 'light',
    line: 'An idea bank and a stream calendar that shares your Schedule.',
    img: 'streaming', alt: 'Streaming: streams this week, next stream, idea bank and the stream calendar',
  },
  {
    key: 'sticky-spot', name: 'Sticky Spot', group: 'Side Hustles', depth: 'light',
    line: 'Quick-cash ideas, tracked from idea to paid.',
    img: 'sticky-spot', alt: 'Sticky Spot: fast-cash list with status and amount, money made this month',
  },
];

const GROUP: Record<string, ProductModule['group']> = { Personal: 'Personal', 'Cold Calling': 'Cold Calling', 'Side Hustles': 'Side Hustles' };
/** The page's module list IS the app's solo lineup (modules.config.ts →
 *  SOLO_LINEUP), so the site can never drift from the app again. Modules
 *  with written copy above use it; the rest use the registry's own line
 *  until they get a screenshot and a write-up. */
export const PRODUCT_MODULES: ProductModule[] = SOLO_LINEUP.map((key) => {
  const d = DETAILED.find((x) => x.key === key);
  if (d) return d;
  const m = MODULE_REGISTRY.find((x) => x.key === key)!;
  return { key, name: m.label, group: GROUP[m.category ?? ''] ?? 'Personal', depth: 'light' as const, line: m.description, img: '', alt: '' };
}).filter((m) => !!m);
export const MODULE_COUNT = PRODUCT_MODULES.length;
/** Every solo module is listed now; no placeholder rows. */
export const PERSONAL_TBD = 0;
