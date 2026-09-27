// The Demo Mode script (13-demo-mode-spec §2) — copy is verbatim from the
// spec. Timings are Normal speed; the tour scales them by SPEED_FACTOR.
import type { Screen } from '../types';

export type SceneKey = 'intro' | 'phone' | 'clips' | 'grades' | 'reel' | 'end';

/** What a step can do before its card shows: navigate, click through the
 *  real UI, wait for an element. Provided by the tour engine. */
export interface StepHelpers {
  go(screen: Screen): Promise<void>;
  clickText(text: string | RegExp, within?: string): Promise<boolean>;
  click(selector: string): Promise<boolean>;
  waitFor(selector: string, ms?: number): Promise<Element | null>;
  sleep(ms: number): Promise<void>;
  scrollTo(selector: string): Promise<void>;
}

export interface DemoStep {
  id: string;
  headline: string;
  body: string;
  seconds: number;
  /** Where the app should be (navigated before `prepare`). */
  screen?: Screen;
  prepare?: (h: StepHelpers) => Promise<void>;
  /** CSS selector for the spotlight; omitted = the screen's content area. */
  target?: string;
  /** Full-screen or floating scene rendered over the app. */
  scene?: SceneKey;
  /** Montage: screens shown back to back inside one step. */
  montage?: Screen[];
  /** Stagger the target's children in (cards "fan out"). */
  stagger?: boolean;
}

const CONTENT = '[data-demo-content]';

export const DEMO_STEPS: DemoStep[] = [
  { id: 'intro', scene: 'intro', headline: 'Mastermind by MARQ', body: 'Every business you run. One brain. One text a morning.', seconds: 5 },
  { id: 'home', screen: 'home', target: CONTENT, stagger: true, headline: 'Your whole operation, one screen', body: 'Agency, store, side hustles, money, content — you see it all before you open anything else.', seconds: 6 },
  { id: 'digest', screen: 'morning-digest', scene: 'phone', headline: 'It texts you your day at 5:30am', body: 'Schedule, yesterday\'s numbers, the #1 thing to do, every business in six lines. Reply to log your dials.', seconds: 8 },
  { id: 'brain', screen: 'playbooks', target: CONTENT, stagger: true, headline: 'The Brain', body: 'Playbooks that hold everything the app knows. Every AI decision cites the principle it used.', seconds: 7 },
  { id: 'learns', screen: 'playbooks', headline: 'It learns from you', body: 'Correct a worker once and it\'s written into the playbook. It never makes that mistake again.', seconds: 6,
    prepare: async (h) => { await h.clickText(/Psychology/); await h.sleep(300); await h.scrollTo('[data-demo="playbook-history"]'); }, target: '[data-demo="playbook-history"]' },
  { id: 'office', screen: 'ecommerce', headline: 'Meet your workers', body: 'An orchestrator delegates. Scouts, analysts, builders, and writers do the work. You approve.', seconds: 9,
    prepare: async (h) => { await h.clickText(/View Office/); await h.waitFor('.of-room', 5000); await h.sleep(400); }, target: '[data-demo="office"]' },
  { id: 'manage', headline: 'Manage them like a team', body: 'Tap any worker. See what it did. Tell the boss when it\'s wrong.', seconds: 7,
    prepare: async (h) => {
      await h.clickText(/^Product Scout/, '.of-room'); await h.sleep(700);
      await h.click('[data-demo="run-row"]'); await h.sleep(600);
      await h.clickText(/^Raise with orchestrator$/); await h.sleep(500);
    }, target: '[data-demo="drawer"]' },
  { id: 'products', screen: 'ecommerce', headline: 'Products, scouted for you', body: 'Top products per channel, margins, who\'s buying and why, and three reasons it could fail.', seconds: 8,
    prepare: async (h) => { await h.clickText(/Product Sheets/); await h.sleep(600); await h.click('[data-demo="product-card"]'); await h.sleep(700); await h.scrollTo('[data-demo="money"]'); }, target: '[data-demo="drawer"]' },
  { id: 'brand', screen: 'ecommerce', headline: 'From product to live store', body: 'Pick it. Workers research, brand, build, and hand you a preview. You tap deploy.', seconds: 8,
    prepare: async (h) => { await h.clickText(/^🏷️\s*Brands$|^Brands$/); await h.sleep(500); await h.clickText(/Northline Goods/); await h.sleep(700); await h.scrollTo('[data-demo="brand-steps"]'); await h.sleep(400); }, target: '[data-demo="brand-steps"]' },
  { id: 'content', screen: 'content', scene: 'clips', headline: 'Content that gets graded', body: 'Workers script hooks, cut your clips, and grade every post out of 4 — with the reason.', seconds: 8,
    prepare: async (h) => { await h.clickText(/^📅\s*Plan$|^Plan$/); await h.sleep(500); }, target: CONTENT },
  { id: 'marketing', screen: 'marketing', scene: 'grades', headline: 'Marketing that keeps score', body: 'Scripts, call logs, inbound tracking, and a grade for every campaign. You always know what\'s working.', seconds: 7,
    prepare: async (h) => { await h.clickText(/^📞\s*Scripts$|^Scripts$/); await h.sleep(500); }, target: CONTENT },
  { id: 'leadflow', screen: 'leadflow', headline: 'Scale the agency', body: '58,000 leads enriched to the owner\'s phone. Pipeline, calls, and clients in one flow.', seconds: 6,
    prepare: async (h) => { await h.clickText(/Lead Pool/); await h.sleep(700); }, target: CONTENT },
  { id: 'money', screen: 'budgeting', target: CONTENT, stagger: true, headline: 'Money, by venture', body: 'Every dollar tagged to the business it came from. No spreadsheets.', seconds: 5 },
  { id: 'health', screen: 'macros', target: CONTENT, headline: 'You\'re a business too', body: 'Macros, workouts, sleep — because the operator is the first system to keep running.', seconds: 6 },
  { id: 'brandlab', screen: 'brand-lab', headline: 'Brand Lab', body: 'Names, palettes, and voice chosen for your buyer — with the psychology behind every pick.', seconds: 6,
    prepare: async (h) => { await h.clickText(/Northline Goods/); await h.sleep(700); await h.scrollTo('[data-demo="concepts"]'); }, target: '[data-demo="concepts"]', stagger: true },
  { id: 'rest', montage: ['invoicing', 'client-crm', 'setup', 'changelog', 'playbooks'], headline: 'And the rest', body: 'Invoices. Client portals. Connections. Changelog. It\'s all in here.', seconds: 6, target: CONTENT },
  { id: 'next', scene: 'reel', headline: 'What\'s next', body: 'Auto-posting. Stores that deploy themselves. Workers that order your samples. A trading desk. The app in your pocket.', seconds: 9 },
  { id: 'end', scene: 'end', headline: 'Built for people who run more than one thing', body: 'mastermindsbymarq.com', seconds: 6 },
];

export const REEL_CARDS: { icon: string; line: string }[] = [
  { icon: '📲', line: 'Auto-publish to TikTok and Instagram once a worker earns it' },
  { icon: '🚀', line: 'Store builds that go live from a preview with one tap' },
  { icon: '📦', line: 'Workers that queue sample orders — you just tap Buy' },
  { icon: '📱', line: 'Native iPhone app: push, Face ID, widgets' },
  { icon: '🤝', line: 'Client portals for Made by Marq customers' },
  { icon: '📈', line: 'Trading desk module (research)' },
  { icon: '👥', line: 'Multi-user teams' },
];

export const totalSeconds = DEMO_STEPS.reduce((s, x) => s + x.seconds, 0);
