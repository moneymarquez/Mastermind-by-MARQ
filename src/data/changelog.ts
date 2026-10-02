// What's new, newest first. Each release adds one entry here (and the
// same lines become the App Store "What's New" text in Phase 6).
export interface Release { version: string; date: string; title: string; items: string[] }

export const APP_VERSION = '0.11.0';

export const CHANGELOG: Release[] = [
  { version: '0.11.0', date: '2026-10-01', title: 'Every worker is live', items: [
    'Studio: upload a raw clip from your phone; it\'s transcribed and the Clip Editor proposes the hook, cuts, captions, b-roll and Higgsfield prompts. Watch raw and edited side by side, then approve or send it back.',
    'Inspiration: the Trend Researcher finds what\'s working in your niches, with why it worked and "our version". One tap puts it on the Plan.',
    'Idea & Script writes next week\'s posts (3 hooks, script, shot list, CTA); Post Planner picks the time from your own numbers and writes the caption.',
    'Account Auditor: 3 things to repeat and 3 to stop, every Sunday. Analytics grades each post out of 4 and flags breakouts and flops.',
    'Marketing → Inbound: your website form posts straight in, with the source tagged and how long each lead waited. Anyone unanswered after an hour sends you an urgent alert.',
    'E-commerce: Supplier Finder, Brand Lab (real .com checks), Store Builder (a previewable landing page with a quality gate), Content Producer and Analytics now run from each brand step. The sample and the domain stay red cards you buy yourself.',
    'Marketing → Lists: saved slices of LeadFlow (city, category, size) with live counts — callable, chains, duplicates, already called.',
  ] },
  { version: '0.10.0', date: '2026-09-30', title: 'Dispatch', items: [
    'Dispatch: hold the mic, say who does what by when, review, send. It lands on their board and they get a text.',
    'A live board of who has what — overdue in red, done and "need help" show up the moment they happen.',
    'Invite your crew by link or text. They get a slim app with just their tasks — no subscription needed.',
    'The Dispatch widget on Overview (small, medium or large), and /dispatch?talk=1 opens straight into recording.',
  ] },
  { version: '0.9.0', date: '2026-09-27', title: 'Demo Mode, faster, safer', items: [
    'Demo Mode: a two-minute guided tour with demo data — Settings → Demo Mode.',
    'The app opens about 10× lighter: screens load as you open them.',
    'Export all your data, or delete your account, from Settings → Account.',
    'Download any invoice or document as a PDF.',
    'Links from notifications and texts open the right screen.',
    'If a screen hits an error, it tells you and the rest of the app keeps working.',
  ] },
  { version: '0.8.0', date: '2026-09-27', title: 'Workers that run overnight', items: [
    'Audience Analyst, Competitor Teardown, Lead Filter, Script & Copy, Campaign Planner and Campaign Scorer.',
    'The Orchestrator runs an overnight plan and writes a summary into your morning digest.',
  ] },
  { version: '0.7.0', date: '2026-09-26', title: 'The Office and the morning text', items: [
    'View Office: every worker in its own room, live.',
    'Morning Digest: your whole day in one text at 5:30am.',
    'Playbooks with version history — corrections stick.',
  ] },
];
