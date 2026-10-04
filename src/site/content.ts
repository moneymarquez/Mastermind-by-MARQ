// Every word and number on the home page, from Masterminds Home v3.
// Anything marked PLACEHOLDER in the copy is visibly labeled on the page
// and must be replaced with real data before it is treated as final.

export const HEADLINES = {
  a: "Everything you're juggling, finally in one place.",
  b: 'Your plans, goals and business, in one place.',
  c: "You're doing too much to do it in twelve apps.",
} as const;

export const SUBLINE = 'Plan your day, track your goals and run your business. And Nova, the chatbot: put in tasks, log your macros, or ask it anything.';

/** Logo row under the cover ("Brands we utilize"), as designed. */
export const UTILIZE_1 = ['Supabase', 'Stripe', 'Claude', 'Cloudflare', 'React', 'Shopify', 'Codex'];
export const UTILIZE_2 = ['GitHub', 'ChatGPT', 'Alpaca', 'TypeScript', 'Higgsfield', 'TradingView', 'Vite'];

/** "Brands we work with": numbered placeholder slots until permission is in. */
export const WORK_WITH_1 = ['01', '02', '03', '04', '05'];
export const WORK_WITH_2 = ['06', '07', '08', '09'];

/** The goal box's illustrative sample answer. */
export const SAMPLE_DO = 'Personal trainer. I coach clients in the evenings after my day job.';
export const SAMPLE_GOAL = 'Coach full-time with my own client list by next summer.';
export const FITS = [
  { name: 'Daily Plan', line: 'Builds each day around your job hours and your evening sessions.' },
  { name: 'Schedule', line: 'Keeps client sessions, your own training and the day job on one calendar.' },
  { name: 'Goals', line: 'Breaks “full-time by next summer” into checkpoints you can see.' },
  { name: 'Fitness', line: 'Logs your own workouts so they don’t get squeezed out.' },
  { name: 'Macros & Meals', line: 'Logs meals from a photo on days you eat between sessions.' },
];
export const FIRST_STEP = 'Put every client session and day-job shift into Schedule this week, so you can see your real free hours.';
export const PLAN = [
  { n: '01', text: 'Put job hours and client sessions into Schedule.' },
  { n: '02', text: 'Set the goal and a first checkpoint in Goals.' },
  { n: '03', text: 'Follow Daily Plan for one week and note what slipped.' },
  { n: '04', text: 'Look back in Weekly Review and adjust the next week.' },
];

// ── What it replaces ───────────────────────────────────────────────────
export type RepItem =
  | { kind: 'row'; fn: string; prod: string; price: string }
  | { kind: 'confirm'; fn: string; prod: string }
  | { kind: 'head'; text: string }
  | { kind: 'hire'; fn: string; price: string }
  | { kind: 'more'; note: string };

export interface RepPanel {
  key: 'Solo' | 'Pro' | 'Team' | 'E-commerce' | 'Content';
  eyebrow: string; price: string; cta: string; href?: string; live: boolean;
  items: RepItem[];
  sepLabel?: string; total?: string; note?: string;
  hasSeats?: boolean;
  line?: string; foot?: string;
  does?: { name: string; line: string }[]; closing?: string;
}

const row = (fn: string, prod: string, price: string): RepItem => ({ kind: 'row', fn, prod, price });
const conf = (fn: string, prod: string): RepItem => ({ kind: 'confirm', fn, prod });
const f2 = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v: number) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const REP_CHECKED = 'Published prices, USD, checked Oct 4, 2026. Ranges vary by provider. Not medical or financial advice.';

export function repPanels(seats: 10 | 25 | 50, more: boolean, links: { signup: string; team: string; apply: string }): RepPanel[] {
  const solo = [row('Daily planning', 'Sunsama', '$25/mo'), row('Macros & meals', 'MyFitnessPal Premium', '$24.99/mo'), row('Budgeting', 'YNAB', '$14.99/mo'), row('Voice capture', 'Otter Pro', '$16.99/mo'), row('Task handoff', 'ClickUp Business', '$19/user/mo'), row('Notes & weekly review', 'Notion Plus', '$10/user/mo')];
  const soloC = [conf('Mental health', 'Headspace'), conf('Sobriety', 'I Am Sober Plus'), conf('Goals', 'Fabulous Premium'), conf('Decision log', 'Decision Journal Premium')];
  const biz = [row('Client CRM', 'HubSpot Sales Hub Starter', '$20/seat/mo'), row('Invoicing', 'QuickBooks Online Simple Start', '$38/mo'), row('Phone', 'Quo Starter', '$19/user/mo'), row('Call recording', 'Fireflies Pro', '$18/seat/mo'), row('Design', 'Canva Pro', '$12/mo, billed yearly')];
  const soloT = 25 + 24.99 + 14.99 + 16.99 + 19 + 10, proT = soloT + 20 + 38 + 19 + 18 + 12;
  const seatP = { 10: 99, 25: 199, 50: 349 }[seats], perSeat = 20 + 19 + 18;
  const moreRow = (n: number): RepItem => ({ kind: 'more', note: `${n} rows, price to confirm` });
  return [
    { key: 'Solo', eyebrow: 'MASTERMINDS SOLO', price: '$19.99/mo', sepLabel: "What you'd pay separately", total: f2(soloT) + '/mo', note: 'Monthly billing prices. Rows marked "Price to confirm" are not in the total.', cta: 'Start 7-day free trial', href: '#start', live: true, items: [...solo, moreRow(4), ...(more ? soloC : [])] },
    { key: 'Pro', eyebrow: 'MASTERMINDS PRO · COMING SOON', price: '$49.99/mo', sepLabel: "What you'd pay separately", total: f2(proT) + '/mo', note: 'Solo plus business tools. Monthly billing prices; Canva Pro is billed yearly.', cta: 'Coming soon', live: false, items: [...solo, ...biz, { kind: 'row', fn: 'Business tools subtotal', prod: '', price: '$107/mo' }, moreRow(5), ...(more ? [...soloC, conf('Lead generation', 'Apollo Professional')] : [])] },
    { key: 'Team', eyebrow: `MASTERMINDS TEAM · ${seats} SEATS`, price: f0(seatP) + '/mo', sepLabel: "What you'd pay separately", total: f0(perSeat * seats) + '/mo', note: `$${perSeat} per seat × ${seats} seats. Monthly billing prices.`, cta: 'Request access', href: links.team, live: true, hasSeats: true, items: [row('Client CRM', 'HubSpot Sales Hub Starter', '$20/seat/mo'), row('Phone', 'Quo Starter', '$19/seat/mo'), row('Call recording', 'Fireflies Pro', '$18/seat/mo'), { kind: 'row', fn: 'Per seat', prod: 'Total', price: `$${perSeat}/seat/mo` }] },
    { key: 'E-commerce', eyebrow: 'RUN BY MARQ · E-COMMERCE', price: '$1,500/mo', cta: 'Apply', href: links.apply, live: true, line: 'Your store, run for you.', foot: 'Store tools billed separately, about $74/mo.',
      items: [{ kind: 'head', text: "What you'd pay without it" }, { kind: 'head', text: 'Every month' }, { kind: 'hire', fn: 'Store platform & apps (Shopify, DSers, Judge.me)', price: '$74/mo' }, { kind: 'hire', fn: 'Social media manager, freelance', price: '$500–$7,000/mo' }, { kind: 'hire', fn: 'Shopify freelancer for store management', price: '$20–$95/hr' }, { kind: 'head', text: 'To get started' }, { kind: 'hire', fn: 'Store build', price: '$500–$10,000' }, { kind: 'hire', fn: 'Product photos', price: '$25–$350 per image' }, { kind: 'hire', fn: 'Product descriptions', price: '$25–$250 each' }],
      does: [{ name: 'Finds the products', line: 'Sources winning products and suppliers that fit the brand.' }, { name: 'Builds the store', line: 'Theme, pages, payments and shipping, set up and live.' }, { name: 'Creates every product page', line: 'Photos, copy and pricing, done for each product.' }, { name: 'Posts and promotes', line: 'Products pushed to social on a steady schedule.' }, { name: 'Watches what sells', line: "Tracks every product's performance." }, { name: 'Doubles down automatically', line: 'Winners get pushed harder, dead products get cut.' }],
      closing: 'You own the store. Masterminds runs it.' },
    { key: 'Content', eyebrow: 'RUN BY MARQ · CONTENT', price: '$749/mo', cta: 'Apply', href: links.apply, live: true, line: 'One team instead of hiring it out.',
      items: [{ kind: 'head', text: "What you'd hire instead" }, { kind: 'hire', fn: 'Social media manager, freelance', price: '$500–$7,000/mo' }, { kind: 'hire', fn: 'Video editing retainer (8–12 videos/mo)', price: '$2,000–$5,000/mo' }, { kind: 'hire', fn: 'Scheduling tool', price: '$99/mo' }],
      does: [{ name: 'Makes the content', line: 'Short-form video, graphics and captions, on brand, every week.' }, { name: 'Posts it for you', line: 'Scheduled across every platform, hands off.' }, { name: 'Reads every number', line: 'Views, saves, shares, follows, tracked post by post.' }, { name: 'Doubles down automatically', line: 'What performs sets the direction, what flops gets cut.' }, { name: 'Runs on a loop', line: 'The more it learns, the harder it works.' }],
      closing: 'A full content team on autopilot — it posts, watches the analytics, and adjusts itself.' },
  ];
}

// ── Chapters ───────────────────────────────────────────────────────────
/** Drop real clips here (mp4/webm + poster) and they replace the exhibit. */
export const CLIPS: Record<'commerce' | 'everyday' | 'content', { mp4: string; webm: string; poster: string }> = {
  commerce: { mp4: '', webm: '', poster: '' },
  everyday: { mp4: '', webm: '', poster: '' },
  content: { mp4: '', webm: '', poster: '' },
};

export interface Chapter {
  k: 'commerce' | 'everyday' | 'content';
  label: string; title: string; body: string; steps: string[]; cta: boolean; cap: string; grad: string;
}
export const CHAPTERS: Chapter[] = [
  { k: 'commerce', label: 'E-COMMERCE · RUN BY MARQ', title: 'A store, without building it yourself.', body: 'Products sourced, a store built, product pages written, each step approved by you. Includes everything in Content.', steps: ['Idea picked', 'Ten steps fill in', 'An order comes in'], cta: true, cap: 'E-COMMERCE · Example data', grad: 'linear-gradient(165deg,#43392f 0%,#221e1b 100%)' },
  { k: 'everyday', label: 'REGULAR USE', title: 'One ordinary day, handled.', body: 'Your day planned from your schedule and goals. Lunch logged from a photo. A task handed off by voice before you leave the house.', steps: ['Day planned', 'Meal logged', 'Task sent'], cta: false, cap: 'REGULAR USE · Example data', grad: 'linear-gradient(165deg,#2f3a48 0%,#1b2028 100%)' },
  { k: 'content', label: 'CONTENT CREATION · RUN BY MARQ', title: 'Too busy to post. Your page keeps showing up.', body: "Marq's team plans your launch kit, drafts the posts and puts them out on schedule, while you keep running the business.", steps: ['Kit planned', 'Posts drafted', 'Posts go out'], cta: true, cap: 'CONTENT CREATION · Example data', grad: 'linear-gradient(165deg,#3a3a4c 0%,#20202b 100%)' },
];

export const PIPE = ['Idea', 'Research', 'Name', 'Brand kit', 'Supplier', 'Samples', 'Product sheets', 'Store', 'Launch', 'Scale'];
export const TASKS: [string, boolean][] = [['Review the day plan', true], ['Client session, 6 PM', true], ['Log lunch', false], ['Weekly review', false]];
export const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => ({
  d, h1: [18, 12, 22, 0, 16, 10, 0][i], c1: ['#22D3FF', '#FFB020', '#22D3FF', 'transparent', '#2BFF88', '#22D3FF', 'transparent'][i],
  h2: [0, 14, 10, 18, 0, 0, 8][i], c2: ['transparent', '#2BFF88', '#FFB020', '#22D3FF', 'transparent', 'transparent', '#FFB020'][i],
}));
export const K_STATS: [string, string][] = [['3', 'Launch kits'], ['8 of 24', 'Pieces done'], ['5', 'Due this week'], ['12', 'Posted this month']];
export const K_PIECES: [string, string, string][] = [['Launch post', 'Posted', '#2BFF88'], ['Caption set', 'Ready', '#22D3FF'], ['Week 2 post', 'Drafting', '#FFB020'], ['Story set', 'Drafting', '#FFB020']];
export const OUTPUTS = [{ name: 'Posts', line: 'Planned, drafted and ready for your sign-off.' }, { name: 'Captions', line: 'Written to match each post.' }, { name: 'Weekly schedule', line: 'What goes out, and when.' }];
export const SHOPS = ['Shop A', 'Shop B', 'Shop C'];

// ── Your day, one login ────────────────────────────────────────────────
export const DAY: [string, string, string, string, string][] = [
  ['6:30 AM', 'Daily Plan', "Set today's three things before you're out of bed.", '#eef2f8', '#d3dceb'],
  ['7:15 AM', 'Macros & Meals', "Log breakfast and see what's left for the day.", '#f5f0e8', '#e3d8c6'],
  ['8:00 AM', 'Schedule', 'Your calendar and your day, in one view.', '#ebf0f6', '#cdd9e8'],
  ['12:30 PM', 'Budgeting', "Check what's left before you spend.", '#eff1ec', '#d8ddd0'],
  ['5:30 PM', 'Fitness', "Today's workout, logged in a minute.", '#efedf5', '#d8d3e7'],
  ['7:00 PM', 'Voice Capture', "Say it once and it's saved.", '#ebf1f2', '#cfdfe2'],
  ['9:30 PM', 'Goals and Weekly Review', "See how the week went against what you're aiming for.", '#f3eeea', '#ded3cb'],
];

export const FAQS: [string, string][] = [
  ['How much does Masterminds cost?', '$19.99 a month. Start with a 7-day free trial. Trial terms are PLACEHOLDER until the real terms are written.'],
  ['Is Pro available?', 'Not yet. Masterminds Pro is $49.99 a month and is coming soon.'],
  ['How do teams join?', 'Team plans are by request: 10 seats $99, 25 seats $199, 50 seats $349 a month.'],
  ['What is Run by Marq?', "A done-with-you service from Marq's team. Content is $749 a month and E-commerce is $1,500 a month. Apply to get started."],
  ['Is this medical or financial advice?', 'No. Masterminds is not medical or financial advice.'],
];
