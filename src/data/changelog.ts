// What's new, newest first. Each release adds one entry here (and the
// same lines become the App Store "What's New" text in Phase 6).
export interface Release { version: string; date: string; title: string; items: string[] }

export const APP_VERSION = '0.9.0';

export const CHANGELOG: Release[] = [
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
