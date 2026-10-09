// Made by Marq, October build (brief Phase 5): the pure parts — delivery
// phases, the bottleneck, ledger math, contract templates, comms
// rendering, the marketing funnel and the idea bank. Tested in
// tests/madeby-october.test.ts; the screens and the Worker both use these.

// ── 5.2 Delivery phases ───────────────────────────────────────────────
export type Owner = 'marq' | 'client' | 'bot';
export interface Phase { n: 1 | 2 | 3 | 4 | 5; key: string; label: string; short: string; checklist: { title: string; owner: Owner; days: number }[] }
export const DELIVERY_PHASES: Phase[] = [
  { n: 1, key: 'onboard', label: 'Onboard & Audit', short: 'Onboard', checklist: [
    { title: 'Kickoff call held and transcript saved', owner: 'marq', days: 2 },
    { title: 'Client sends logins (site, Google, socials)', owner: 'client', days: 5 },
    { title: 'Business audit filled in', owner: 'marq', days: 5 },
    { title: 'Baseline numbers captured (followers, reviews, traffic, leads)', owner: 'marq', days: 5 },
    { title: 'Audit summary sent to client', owner: 'bot', days: 7 },
  ] },
  { n: 2, key: 'strategy', label: 'Strategy & Setup', short: 'Strategy', checklist: [
    { title: 'Strategy doc approved by client', owner: 'client', days: 7 },
    { title: 'Brand kit (logo, palette, voice) finished', owner: 'marq', days: 10 },
    { title: 'Accounts and tools set up', owner: 'marq', days: 10 },
    { title: 'Content plan for the first month', owner: 'bot', days: 12 },
  ] },
  { n: 3, key: 'launch', label: 'Launch', short: 'Launch', checklist: [
    { title: 'Site / app live on the client domain', owner: 'marq', days: 7 },
    { title: 'Client signs off on launch', owner: 'client', days: 9 },
    { title: 'Walkthrough video recorded and sent', owner: 'marq', days: 10 },
    { title: 'First campaign or posts live', owner: 'bot', days: 10 },
  ] },
  { n: 4, key: 'growth', label: 'Active Growth', short: 'Growth', checklist: [
    { title: 'Weekly posts going out', owner: 'bot', days: 7 },
    { title: 'Monthly growth call', owner: 'marq', days: 30 },
    { title: 'Client approves next month\'s plan', owner: 'client', days: 30 },
    { title: 'Numbers snapshot captured', owner: 'marq', days: 30 },
  ] },
  { n: 5, key: 'maintain', label: 'Maintain & Report', short: 'Maintain', checklist: [
    { title: 'Monthly report sent', owner: 'bot', days: 30 },
    { title: 'Site and tools checked and updated', owner: 'marq', days: 30 },
    { title: 'Case study drafted (before → after)', owner: 'marq', days: 45 },
    { title: 'Testimonial or review requested', owner: 'client', days: 45 },
  ] },
];
export const phaseOf = (n: number | null | undefined) => DELIVERY_PHASES.find((p) => p.n === n) ?? null;
export interface CheckItem { id: string; client_id: string; phase: number; title: string; owner: Owner; due: string | null; done: boolean; done_at?: string | null; created_at: string }
/** % through a client's current phase. */
export function phaseProgress(items: Pick<CheckItem, 'phase' | 'done'>[], phase: number): { done: number; total: number; pct: number } {
  const mine = items.filter((i) => i.phase === phase);
  const done = mine.filter((i) => i.done).length;
  return { done, total: mine.length, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
}
/** The next open item in the phase: earliest due, then oldest. */
export function nextStep<T extends Pick<CheckItem, 'phase' | 'done' | 'due' | 'created_at'>>(items: T[], phase: number): T | null {
  return items.filter((i) => i.phase === phase && !i.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.created_at.localeCompare(b.created_at))[0] ?? null;
}
/** Checklist rows to create when a client enters a phase. Pure. */
export function checklistFor(phase: number, start: string, plays: { phase: number | null; steps: { title: string; owner?: Owner; days?: number }[] }[] = []): { phase: number; title: string; owner: Owner; due: string; sort: number }[] {
  const p = phaseOf(phase);
  if (!p) return [];
  const extra = plays.filter((x) => x.phase === phase).flatMap((x) => x.steps.map((s) => ({ title: s.title, owner: s.owner ?? 'marq', days: s.days ?? 7 })));
  const seen = new Set<string>();
  return [...p.checklist, ...extra].filter((c) => { const k = c.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((c, i) => ({ phase, title: c.title, owner: c.owner, due: addDays(start, c.days), sort: i }));
}

// ── 5.3 Bottleneck: waiting on Marq ───────────────────────────────────
export const daysSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86400000));
export interface Waiting<T> { item: T; days: number }
/** Open items owned by Marq, longest-waiting first. Waiting starts at the
 *  later of creation and (when it's in the past) the due date. Pure. */
export function waitingOnMarq<T extends Pick<CheckItem, 'owner' | 'done' | 'created_at' | 'due'>>(items: T[], now: Date): Waiting<T>[] {
  return items.filter((i) => i.owner === 'marq' && !i.done).map((item) => ({ item, days: daysSince(item.created_at, now) })).sort((a, b) => b.days - a.days);
}
/** Clients where every open item is Marq's: he's the single point of failure. */
export function singlePoint(items: Pick<CheckItem, 'client_id' | 'owner' | 'done'>[]): string[] {
  const by = new Map<string, Owner[]>();
  for (const i of items) if (!i.done) by.set(i.client_id, [...(by.get(i.client_id) ?? []), i.owner]);
  return [...by].filter(([, os]) => os.length > 0 && os.every((o) => o === 'marq')).map(([id]) => id);
}
/** Amber ring when waiting on Marq, red after 3 days. */
export const ringFor = (days: number | null): 'none' | 'amber' | 'red' => (days == null ? 'none' : days > 3 ? 'red' : 'amber');

// ── 5.3 Classroom rooms ───────────────────────────────────────────────
export interface Room { key: string; label: string; phase: number | null }
export const ROOMS: Room[] = [
  ...DELIVERY_PHASES.map((p) => ({ key: `phase-${p.n}`, label: `Phase ${p.n} · ${p.label}`, phase: p.n as number | null })),
  { key: 'aphs', label: 'APHS · James & Mikhail', phase: null },
  { key: 'own', label: 'Masterminds · own brands', phase: null },
];
/** Which room a client stands in. Pure. */
export function roomOf(c: { delivery_phase: number | null; room?: string | null; client_type?: string | null }): string | null {
  if (c.room === 'aphs' || c.room === 'own') return c.room;
  return c.delivery_phase ? `phase-${c.delivery_phase}` : null;
}
/** What a drop on a room writes: the same phase field the CRM uses. */
export function dropPatch(roomKey: string): { delivery_phase?: number; room: string | null } {
  const m = roomKey.match(/^phase-(\d)$/);
  return m ? { delivery_phase: Number(m[1]), room: null } : { room: roomKey };
}

// ── 5.4 Ledger ────────────────────────────────────────────────────────
export interface LedgerRow { kind: 'income' | 'expense'; amount_usd: number; date: string; category: string; party?: string | null; note?: string | null; confirmed?: boolean }
export const EXPENSE_CATEGORIES = ['marketing', 'software/tools', 'ai usage', 'contractors', 'equipment', 'other'];
export const INCOME_SOURCES = ['APHS / James', 'Client', 'Masterminds subscriptions', 'Other'];
export function monthlyPnl(rows: LedgerRow[]): { month: string; income: number; expense: number; profit: number }[] {
  const m = new Map<string, { income: number; expense: number }>();
  for (const r of rows) { if (r.confirmed === false) continue; const k = r.date.slice(0, 7); const v = m.get(k) ?? { income: 0, expense: 0 }; v[r.kind] += Number(r.amount_usd); m.set(k, v); }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, income: round(v.income), expense: round(v.expense), profit: round(v.income - v.expense) }));
}
export function ytd(rows: LedgerRow[], year: number): { income: number; expense: number; profit: number } {
  const y = monthlyPnl(rows.filter((r) => r.date.startsWith(String(year))));
  const income = y.reduce((s, x) => s + x.income, 0), expense = y.reduce((s, x) => s + x.expense, 0);
  return { income: round(income), expense: round(expense), profit: round(income - expense) };
}
/** "Set aside for taxes": a rough share of positive profit. Not tax advice. */
export const taxSetAside = (profit: number, pct = 25) => round(Math.max(0, profit) * (pct / 100));
export const TAX_LABEL = 'Rough estimate, not tax advice.';
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function ledgerCsv(rows: LedgerRow[]): string {
  return ['date,kind,category,party,amount_usd,note', ...[...rows].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.date, r.kind, r.category, r.party ?? '', Number(r.amount_usd).toFixed(2), r.note ?? ''].map(csvCell).join(','))].join('\n');
}
/** Recurring rows due this month that haven't been added yet. Pure. */
export function dueRecurring<T extends { active: boolean; day_of_month: number; last_month: string | null }>(rec: T[], today: string): T[] {
  const month = today.slice(0, 7), day = Number(today.slice(8, 10));
  return rec.filter((r) => r.active && r.last_month !== month && day >= r.day_of_month);
}
export function nextInvoiceNumber(existing: string[], prefix = 'MBM'): string {
  const n = existing.map((x) => Number((x.match(/(\d+)$/) ?? [])[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(n + 1).padStart(4, '0')}`;
}
export const invoiceTotal = (items: { qty: number; rate: number }[]) => round(items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.rate || 0), 0));

// ── 5.5 Contracts ─────────────────────────────────────────────────────
export const DEFAULT_SENDER = 'Made by Marq (Cristopher Marquez)';
export const CONTRACTS_FOOTER = 'Templates are starting points, not legal advice. Have a lawyer review them once.';
export const templateVars = (body: string) => [...new Set([...body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]))];
/** Fill {{vars}}; unknown ones stay visible as [var] so nothing silently blanks. */
export function fillTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => { const v = vars[k]; return v == null || v === '' ? `[${k}]` : String(v); });
}
export const missingVars = (body: string, vars: Record<string, unknown>) => templateVars(body).filter((k) => vars[k] == null || vars[k] === '');
const T = (key: string, name: string, kind: string, body: string) => ({ key, name, kind, body: body.trim() });
export const CONTRACT_TEMPLATES = [
  T('services', 'Services & payment agreement', 'client', `
# Services Agreement

This agreement is between **{{sender_entity}}** ("Provider") and **{{client_name}}** ("Client"), starting {{start_date}}.

## 1. Services
Provider will deliver: {{scope}}.

## 2. Fees and payment
Client will pay {{fee}} ({{payment_schedule}}). Invoices are due within {{payment_terms}} days. Late invoices may pause work.

## 3. Client responsibilities
Client provides timely access, content and approvals. Delays on Client's side move delivery dates by the same amount.

## 4. Ownership
On full payment, Client owns the final deliverables. Provider keeps its tools, templates and know-how, and may show the work in its portfolio unless Client opts out in writing.

## 5. Term and ending
Either party may end this agreement with {{notice_days}} days' written notice. Work done up to that point is paid for.

## 6. Limitation of liability
Provider's total liability is limited to the fees paid in the 3 months before a claim.
`),
  T('waiver', 'Limitation of liability / waiver', 'client', `
# Limitation of Liability and Waiver

**{{client_name}}** acknowledges that results from marketing, websites and advertising depend on many factors outside **{{sender_entity}}**'s control, and that no specific result (sales, rankings, followers or revenue) is guaranteed.

To the fullest extent allowed by law, {{sender_entity}}'s total liability for any claim related to its services is limited to {{liability_cap}}. Neither party is liable for indirect or consequential damages.

Effective {{start_date}}.
`),
  T('contractor_aphs', 'Independent contractor agreement (APHS dev work)', 'contractor', `
# Independent Contractor Agreement

Between **{{client_name}}** ("Company") and **{{sender_entity}}** ("Contractor"), effective {{start_date}}.

## 1. Scope
Contractor will provide software development: {{scope}}.

## 2. Rate and payment
Company pays Contractor {{rate}} per month, invoiced on the {{invoice_day}} and due within {{payment_terms}} days.

## 3. Independent contractor
Contractor sets their own hours and methods, provides their own equipment, and is responsible for their own taxes. Nothing here creates employment.

## 4. Intellectual property
On payment, work product built specifically for Company under this agreement belongs to Company. Contractor keeps pre-existing tools, libraries and general know-how, and grants Company a license to use any of them included in the work.

## 5. Confidentiality
Each party keeps the other's non-public information confidential during and after this agreement.

## 6. Termination
Either party may end this agreement with {{notice_days}} days' written notice. Company pays for work done through the end date.
`),
  T('commission', 'Commission / override agreement', 'commission', `
# Commission and Override Agreement

Between **{{sender_entity}}** and **{{client_name}}** ("Representative"), effective {{start_date}}.

Representative earns {{override_rate}} on {{override_basis}} for accounts they bring in, paid {{payment_schedule}} after the payment is received.

Overrides continue while the account stays active and Representative is in good standing. Either party may end this agreement with {{notice_days}} days' written notice; earned overrides through the end date are paid.
`),
  T('nda', 'Mutual NDA', 'nda', `
# Mutual Non-Disclosure Agreement

**{{sender_entity}}** and **{{client_name}}** may share confidential information about {{purpose}}. Each will use the other's information only for that purpose, protect it with reasonable care, and not share it without written consent. This does not cover information that is public, already known, or independently developed.

These obligations last {{term_years}} years from {{start_date}}.
`),
  T('hire', 'Made by Marq contractor / hire agreement', 'hire', `
# Contractor Agreement — Made by Marq

**{{sender_entity}}** engages **{{client_name}}** as an independent contractor for: {{scope}}, starting {{start_date}}.

Pay: {{rate}} ({{payment_schedule}}). Contractor supplies their own tools and handles their own taxes.

Work made for Made by Marq clients under this agreement belongs to Made by Marq once paid. Contractor won't solicit Made by Marq's clients for {{non_solicit_months}} months after this ends. Either party may end this with {{notice_days}} days' notice.
`),
];

// ── 5.6 Comms ─────────────────────────────────────────────────────────
export const renderMessage = (tpl: string, vars: Record<string, string | null | undefined>) => tpl.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? '');
export interface SeqStep { delay_days: number; channel: 'email' | 'sms'; subject?: string; body: string }
/** When the next step of a sequence is due, or null when it's finished. Pure. */
export function nextSequenceAt(steps: SeqStep[], stepIndex: number, from: Date): Date | null {
  const s = steps[stepIndex];
  return s ? new Date(from.getTime() + s.delay_days * 86400000) : null;
}
export const DEFAULT_SEQUENCES: { name: string; list_name: string; steps: SeqStep[] }[] = [
  { name: 'Masterminds lead', list_name: 'Masterminds lead', steps: [
    { delay_days: 0, channel: 'email', subject: 'Your Masterminds trial, {{first_name}}', body: 'Hey {{first_name}},\n\nMarq here. Masterminds runs your day, your goals and your side money in one place. Set it up by talking: copy the prompt on the first screen into ChatGPT or Claude and just answer.\n\nStart here: {{link}}\n\n— Marq' },
    { delay_days: 3, channel: 'email', subject: 'The Money Move it found me', body: 'Every Monday Masterminds finds one specific way to make money that week from your skills and city. Here is what mine looked like: {{link}}\n\n— Marq' },
    { delay_days: 7, channel: 'email', subject: 'Still thinking about it?', body: '{{first_name}}, the founding price is still open. Reply with any question and I answer personally.\n\n— Marq' },
  ] },
  { name: 'Recruit / hire packet', list_name: 'Recruiting', steps: [
    { delay_days: 0, channel: 'email', subject: 'Next step: the research packet', body: 'Hi {{first_name}},\n\nThanks for your interest. Here is the research packet: {{packet_link}}\n\nWhen you have read it, record a short Loom answering the three questions at the end: {{loom_link}}\n\n— Marq' },
    { delay_days: 4, channel: 'sms', body: 'Hi {{first_name}}, Marq here. Did the packet come through? Loom link: {{loom_link}}' },
  ] },
];
/** A contact's full history as printable HTML (the user prints to PDF). */
export function historyHtml(contact: { name: string; email?: string | null; phone?: string | null }, entries: { at: string; kind: string; title: string; body: string }[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>History — ${esc(contact.name)}</title><style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:760px;margin:40px auto;padding:0 20px}h1{font-size:22px}.e{border-top:1px solid #ddd;padding:12px 0}.m{color:#666;font-size:12px}pre{white-space:pre-wrap;font:inherit;margin:6px 0 0}</style></head><body><h1>${esc(contact.name)}</h1><div class="m">${esc([contact.email, contact.phone].filter(Boolean).join(' · '))} · exported ${new Date().toISOString()}</div>${[...entries].sort((a, b) => a.at.localeCompare(b.at)).map((e) => `<div class="e"><div class="m">${esc(e.at)} · ${esc(e.kind)}</div><strong>${esc(e.title)}</strong><pre>${esc(e.body)}</pre></div>`).join('')}</body></html>`;
}

// ── 5.7 Case studies ──────────────────────────────────────────────────
export interface Metrics { followers?: number | null; monthly_revenue?: number | null; google_reviews?: number | null; google_rating?: number | null; site_traffic?: number | null; leads_month?: number | null }
const METRIC_LABEL: Record<keyof Metrics, string> = { followers: 'Followers', monthly_revenue: 'Monthly revenue', google_reviews: 'Google reviews', google_rating: 'Google rating', site_traffic: 'Site visits / month', leads_month: 'Leads / month' };
/** Before → after per metric that has both numbers. Pure. */
export function caseDeltas(before: Metrics, after: Metrics): { key: keyof Metrics; label: string; before: number; after: number; change: string }[] {
  return (Object.keys(METRIC_LABEL) as (keyof Metrics)[]).filter((k) => before[k] != null && after[k] != null).map((k) => {
    const b = Number(before[k]), a = Number(after[k]);
    const change = k === 'google_rating' ? `${a - b >= 0 ? '+' : ''}${(a - b).toFixed(1)}` : b > 0 ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : `+${a}`;
    return { key: k, label: METRIC_LABEL[k], before: b, after: a, change };
  });
}

// ── 5.9 Marketing ─────────────────────────────────────────────────────
export interface FunnelStep { key: string; label: string; count: number }
/** Conversion at each step and the biggest drop. Pure. */
export function funnel(steps: FunnelStep[]): { steps: (FunnelStep & { conv: number | null })[]; biggestDrop: string | null } {
  const out = steps.map((s, i) => ({ ...s, conv: i === 0 ? null : steps[i - 1].count > 0 ? Math.round((s.count / steps[i - 1].count) * 1000) / 10 : null }));
  const drops = out.slice(1).filter((s) => s.conv != null && s.key !== 'churned');
  const worst = drops.sort((a, b) => (a.conv ?? 100) - (b.conv ?? 100))[0];
  return { steps: out, biggestDrop: worst ? `${steps[steps.findIndex((s) => s.key === worst.key) - 1].label} → ${worst.label} (${worst.conv}%)` : null };
}
export interface ChannelSpend { channel: string; spend: number; trials: number; paid: number }
export function channelCosts(rows: ChannelSpend[]): (ChannelSpend & { perTrial: number | null; perPaid: number | null })[] {
  return rows.map((r) => ({ ...r, perTrial: r.trials ? round(r.spend / r.trials) : null, perPaid: r.paid ? round(r.spend / r.paid) : null }));
}
/** Where the next $20 should go: the channel with the cheapest paid user, else cheapest trial. */
export function nextTwenty(rows: ChannelSpend[]): string {
  const c = channelCosts(rows);
  const byPaid = c.filter((x) => x.perPaid != null).sort((a, b) => a.perPaid! - b.perPaid!)[0];
  if (byPaid) return `Put the next $20 into ${byPaid.channel}: $${byPaid.perPaid} per paid user so far.`;
  const byTrial = c.filter((x) => x.perTrial != null).sort((a, b) => a.perTrial! - b.perTrial!)[0];
  if (byTrial) return `Put the next $20 into ${byTrial.channel}: $${byTrial.perTrial} per trial so far (no paid users yet to compare).`;
  return 'No paid tests yet. Spend the first $20 on one boosted post from your best organic winner.';
}
export const OFFER_DEFAULTS = {
  founding: { limit: 100, price_usd: 19.99, headline: 'Founding Member', blurb: 'The first {{limit}} members lock {{price}}/mo for life, get first access, and their first month free.' },
  annual: { price_usd: 179, headline: 'Pay yearly', blurb: 'A year up front for {{price}}: two and a half months free.' },
  guarantee: { days: 30, headline: '30-day guarantee', blurb: 'Use it daily for 30 days. If it hasn\'t changed how you run your day, full refund.' },
};
export const spotsLeft = (limit: number, claimed: number) => Math.max(0, limit - claimed);
export const IDEA_BANK: string[] = [
  'I let an app reverse-engineer my goals for 30 days',
  'The weekly Money Move it gave me (and what I made)',
  'What my AI weekly check-in said about my week',
  'Building my business while working a day job',
  'My whole morning, planned before I wake up',
  'I talked to ChatGPT for 10 minutes and it set up my entire life app',
  'The one number I check every Sunday',
  'Why I stopped using 6 apps and use one',
  'How I track macros without hating it',
  'What happens when your to-do list writes itself',
  'Day 1 vs day 30 of using Masterminds',
  'My calling hour: why it\'s non-negotiable',
  'The $20 side hustle it found in my city',
  'I gave an AI my bank of excuses — here\'s what it said',
  'How a solo founder runs three businesses from one screen',
  'Screen tour: my Home at 6am',
  'The weekly check-in that told me to eat 200 fewer calories',
  'Brain dump → organized week in 60 seconds',
  'What I learned building this app at night',
  'Stop planning your day. Let it plan you.',
  'My goals, broken into tasks I actually did',
  'Founding member price: why I\'m locking it at $19.99 forever',
  'The streak that changed my mornings',
  'A real client result from Made by Marq, before → after',
  'Ask me anything about running your life like a business',
];
const round = (n: number) => Math.round(n * 100) / 100;
function addDays(d: string, n: number) { return new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10); }
