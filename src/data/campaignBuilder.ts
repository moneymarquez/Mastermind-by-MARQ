/** The campaign builder's brain — pure, no React, no network.
 *
 *  Ten gated steps. Each step teaches (explain), shows one worked example,
 *  offers 3–4 choices with a "why this fits" that reads the campaign's
 *  own situation (internal vs. client, budget, objective, industry), and
 *  takes free text instead. Everything the UI shows and everything the
 *  cockpit derives (status, next action, plan document, asset checklist,
 *  schedule occurrences) comes from here, so it can be tested with plain
 *  node and the screens stay thin. */

export type StepId =
  | 'objective' | 'audience' | 'offer' | 'hook' | 'channels'
  | 'assets' | 'schedule' | 'budget' | 'measurement' | 'review';

export const STEP_ORDER: StepId[] = ['objective', 'audience', 'offer', 'hook', 'channels', 'assets', 'schedule', 'budget', 'measurement', 'review'];

export interface StepAnswer {
  choice?: string;
  choices?: string[];
  custom?: string;
  data?: Record<string, string | number | null>;
  /** What the AI understood from the free text — informational only. */
  ai_summary?: string;
  /** Filled from the CRM or a transcript; still needs the user to confirm. */
  prefilled?: boolean;
  done_at?: string;
}
export type Answers = Partial<Record<StepId, StepAnswer>>;

export interface CampaignContext {
  clientName: string;
  /** client_id null — the account's own business ("Made by MARQ"). */
  isInternal: boolean;
  industry?: string | null;
  businessModel?: string | null;
  budgetAmount?: number | null;
  budgetPeriod?: string | null;
  timeline?: string | null;
  audienceHint?: string | null;
  goal?: string | null;
  positioning?: string | null;
  /** Today's dial target (DIALS goal) — the internal cold-call default. */
  callGoal?: number;
  answers: Answers;
}

export interface StepOption { id: string; label: string; why: string; score?: number }
export interface FieldDef { key: string; label: string; type: 'date' | 'time' | 'number' | 'select'; options?: { value: string; label: string }[]; placeholder?: string; default?: (ctx: CampaignContext) => string | number }

export interface StepDef {
  id: StepId;
  n: number;
  title: string;
  /** One line for the cockpit's "Step 4 of 10 — Hook". */
  short: string;
  explain: string;
  example: (ctx: CampaignContext) => string;
  options: (ctx: CampaignContext) => StepOption[];
  /** Max selectable choices (channels take two). Absent = single. */
  multi?: number;
  customLabel: string;
  customPlaceholder: string;
  /** Text to seed the free-text box from the CRM / brief. */
  prefill?: (ctx: CampaignContext) => string | undefined;
  fields?: FieldDef[];
}

// ── Channels: the one step whose options are SCORED, not listed ────────
export interface ChannelDef { id: string; label: string; paid: boolean }
export const CHANNELS: ChannelDef[] = [
  { id: 'cold_calling', label: 'Cold calling', paid: false },
  { id: 'gbp', label: 'Google Business Profile + reviews', paid: false },
  { id: 'past_customers', label: 'Text / email to past customers', paid: false },
  { id: 'referral_partners', label: 'Referral partners (neighboring businesses)', paid: false },
  { id: 'meta_ads', label: 'Meta ads (Facebook / Instagram)', paid: true },
  { id: 'door_to_door', label: 'Walk-ins / door to door', paid: false },
  { id: 'social_organic', label: 'Organic social (3 posts a week)', paid: false },
];

function objectiveOf(ctx: CampaignContext): string { return ctx.answers.objective?.choice ?? ''; }
function budgetOf(ctx: CampaignContext): number {
  const fromStep = ctx.answers.budget?.data?.amount;
  if (typeof fromStep === 'number') return fromStep;
  if (typeof fromStep === 'string' && fromStep.trim()) return Number(fromStep) || 0;
  return ctx.budgetAmount ?? 0;
}
function channelsOf(ctx: CampaignContext): string[] { return ctx.answers.channels?.choices ?? (ctx.answers.channels?.choice ? [ctx.answers.channels.choice] : []); }
export function hasChannel(ctx: CampaignContext, id: string): boolean { return channelsOf(ctx).includes(id); }
function who(ctx: CampaignContext): string { return ctx.isInternal ? 'Made by MARQ' : ctx.clientName; }
function money(n: number): string { return `$${Math.round(n).toLocaleString()}`; }

/** Scores every channel 1–5 against THIS campaign. The why is the score's
 *  reasoning in one line, so the user sees the ranking's logic, not just
 *  the ranking. */
export function scoreChannels(ctx: CampaignContext): StepOption[] {
  const obj = objectiveOf(ctx);
  const budget = budgetOf(ctx);
  const local = ctx.isInternal || ctx.businessModel === 'local_service' || ctx.businessModel === 'local_retail' || !ctx.businessModel;
  const out: StepOption[] = [];
  for (const ch of CHANNELS) {
    let score = 3;
    let why = '';
    switch (ch.id) {
      case 'cold_calling':
        if (ctx.isInternal) { score = 5; why = `${money(0)} to run, ${ctx.callGoal ?? 35} dials a day is already the DIALS goal, and every close is a signed client — this is the campaign the whole app is built around.`; }
        else if (obj === 'leads' && ctx.businessModel !== 'ecommerce') { score = 4; why = `Leads with no ad budget means going to the phone; a local ${ctx.industry ?? 'service'} business can book from a list in a week.`; }
        else { score = 2; why = `Works for leads, weak for ${obj || 'this objective'}; ${who(ctx)} would be calling people who don't yet know them for something other than a sale.`; }
        break;
      case 'gbp':
        if (local && obj !== 'retention') { score = obj === 'awareness' || obj === 'leads' ? 5 : 4; why = `Free, permanent, and where a local ${ctx.industry ?? 'business'} is actually found — reviews compound; ads stop when the money stops.`; }
        else { score = 2; why = 'Google Business Profile only pays for a business people search locally; this one isn\'t primarily found that way.'; }
        break;
      case 'past_customers':
        if (obj === 'retention' || obj === 'rebooking') { score = 5; why = 'They already bought once — a text costs cents and converts 5–10× colder traffic. This IS the rebooking channel.'; }
        else if (ctx.isInternal) { score = 1; why = 'No past-customer list to text yet; nothing to send to.'; }
        else { score = 3; why = `Cheap and warm, but ${obj || 'this objective'} needs new people; use it as the second channel, not the first.`; }
        break;
      case 'referral_partners':
        if (local && (obj === 'leads' || obj === 'launch')) { score = 4; why = `A neighboring business handing over customers costs a conversation; for a ${ctx.industry ?? 'local'} business it's the cheapest warm lead there is.`; }
        else { score = 2; why = 'Slow to build and hard to attribute; better once the core channel is running.'; }
        break;
      case 'meta_ads':
        if (budget >= 500 && obj !== 'retention') { score = obj === 'launch' || obj === 'awareness' ? 5 : 4; why = `${money(budget)} clears the floor where Meta's targeting learns; for ${obj || 'this'} it buys reach nothing free can match this fast.`; }
        else if (budget > 0) { score = 2; why = `${money(budget)} is under the ~$500 where Meta ads reliably work — you'd pay for a lesson, not leads.`; }
        else { score = 1; why = 'Paid channel, $0 budget. Not this campaign.'; }
        break;
      case 'door_to_door':
        if (local && (obj === 'leads' || obj === 'launch') && !ctx.isInternal) { score = 3; why = 'Face to face converts, but it eats the owner\'s day; fine as a launch-week push, not a system.'; }
        else if (ctx.isInternal) { score = 3; why = 'Same list as the phone, higher close rate per conversation, ten times the hours. A Friday afternoon add-on to the calls.'; }
        else { score = 1; why = 'Too slow for this objective.'; }
        break;
      case 'social_organic':
        if (obj === 'awareness' || obj === 'launch') { score = 3; why = 'Free but slow — three posts a week builds proof for the other channels rather than producing leads by itself.'; }
        else { score = 2; why = `Posting doesn't produce ${obj || 'results'} on its own; keep it as supporting proof, not the plan.`; }
        break;
    }
    out.push({ id: ch.id, label: ch.label + (ch.paid ? ' · paid' : ' · free'), why, score });
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 4);
}

// ── The ten steps ──────────────────────────────────────────────────────
export const STEPS: StepDef[] = [
  {
    id: 'objective', n: 1, title: 'Direction', short: 'Objective',
    explain: 'A campaign does one job. Pick the job before anything else, because every later choice — who you talk to, what you offer, where it runs — is only right relative to this. "More business" is not an objective; it\'s a wish.',
    example: (ctx) => ctx.isInternal
      ? 'Made by MARQ: "Leads — book 4 discovery calls with local service businesses in the next two weeks."'
      : `${ctx.clientName}: "Rebooking — get 20 past customers to book again this month."`,
    options: (ctx) => [
      { id: 'leads', label: 'Leads — new people raising a hand', why: ctx.isInternal ? 'Made by MARQ needs paying clients, not followers. Leads is the only objective that ends in a signed invoice.' : `New ${ctx.industry ?? 'customers'} at the top of the funnel; right when the calendar has gaps and the past-customer list is thin.` },
      { id: 'rebooking', label: 'Rebooking — bring past customers back', why: ctx.isInternal ? 'You have no past-customer list yet; this one is for a business that does.' : 'Cheapest revenue there is: they already trust you. Pick this if the leak is people not coming back.' },
      { id: 'launch', label: 'Launch — something new goes live', why: 'A new service, location, or offer needs a burst, not a drip. Pick this only if there is a real date.' },
      { id: 'awareness', label: 'Awareness — be known before you\'re needed', why: ctx.isInternal ? 'Slow and unmeasurable for an agency of one. Sell first, be known later.' : 'The one clients ask for most and need least. Only right when the business is new to the area or the offer is misunderstood.' },
    ],
    customLabel: 'Or say it in your own words',
    customPlaceholder: 'What has to be true when this campaign is over?',
    prefill: (ctx) => ctx.goal ?? undefined,
  },
  {
    id: 'audience', n: 2, title: 'Audience', short: 'Audience',
    explain: 'Who, specifically. Not "small businesses" — a person you could point to in a room. The narrower this is, the cheaper every step after it becomes, because the message only has to land with one kind of person.',
    example: (ctx) => ctx.isInternal
      ? '"Owners of Denver-area service businesses open 3–15 years whose Google reviews stopped a year ago and whose site still says 2021."'
      : `"People within 10 miles of ${ctx.clientName} who searched for a ${ctx.industry ?? 'local business'} in the last 30 days."`,
    options: (ctx) => ctx.isInternal ? [
      { id: 'fizzling_local', label: 'Local service businesses with a fizzling online presence (the Lead Pool)', why: 'That is exactly what LeadFlow scores for — the list already exists, ranked, with owner names and direct numbers.' },
      { id: 'established_owners', label: 'Owner-operators 3–15 years in, in one city', why: 'Old enough to have money and a real problem, young enough not to have an agency already. One city keeps the pitch local.' },
      { id: 'food_hospitality', label: 'Restaurants, food trucks, and salons', why: 'High transaction volume, visible online presence, easy to prove a before/after. Fast to close, smaller tickets.' },
      { id: 'past_convos', label: 'Everyone you already talked to who said "not now"', why: 'Callbacks close at a multiple of cold. Smallest list, warmest.' },
    ] : [
      { id: 'past_customers', label: 'Past customers, last 12 months', why: 'Already know and trust ' + ctx.clientName + '; cheapest to reach and most likely to buy again.' },
      { id: 'local_searchers', label: `People nearby searching for a ${ctx.industry ?? 'business like this'}`, why: 'Intent is already there — they want it now, they just haven\'t picked who.' },
      { id: 'neighbors', label: 'Customers of neighboring businesses', why: 'Same street, same wallet. Reached through a partner, not an ad.' },
      { id: 'lookalikes', label: 'People who look like the best current customers', why: 'Needs ad spend and a list to model from; strong when both exist.' },
    ],
    customLabel: 'Or describe them',
    customPlaceholder: 'Describe one person who should see this campaign.',
    prefill: (ctx) => ctx.audienceHint ?? undefined,
  },
  {
    id: 'offer', n: 3, title: 'Offer', short: 'Offer',
    explain: 'What they get, and why anyone would stop for it. An offer is not "our services" — it\'s a specific thing with an edge: a first look for free, a price that ends Friday, a guarantee. The offer does the selling; the message only carries it.',
    example: (ctx) => ctx.isInternal
      ? '"A free 15-minute teardown of your online presence — I tell you the three things costing you customers, you keep the notes either way."'
      : `"${ctx.clientName}: first visit 20% off, this month only, book by text."`,
    options: (ctx) => [
      { id: 'free_look', label: 'A free first look (audit, consult, sample)', why: ctx.isInternal ? 'Zero risk for a stranger on the phone, and it walks straight into the audit the CRM already runs.' : 'Lowest barrier for someone who doesn\'t know the business yet; the sale happens after they\'ve seen the work.' },
      { id: 'intro_price', label: 'An intro price with a deadline', why: budgetOf(ctx) > 0 ? 'Pairs with paid reach — a deadline is what makes an ad convert instead of just being seen.' : 'Urgency without spend; works best for rebooking, where the discount only has to nudge.' },
      { id: 'bundle', label: 'A bundle — more for the same money', why: 'Raises the ticket instead of cutting it. Right when margin is thin and the audience already buys.' },
      { id: 'guarantee', label: 'The core service, guaranteed', why: ctx.isInternal ? '"If the audit finds nothing, you owe nothing." Removes the only objection a cold call really has.' : 'Confidence sells when trust is the gap — new area, new service, or a bad-review recovery.' },
    ],
    customLabel: 'Or write the offer',
    customPlaceholder: 'What they get, for what, by when.',
    prefill: (ctx) => ctx.positioning ?? undefined,
  },
  {
    id: 'hook', n: 4, title: 'Hook', short: 'Hook',
    explain: 'The angle — the first sentence that earns the second. Same offer, four ways in. Pick by what your audience already believes: name their pain, show a result, surprise them with a number, or be one of them.',
    example: (ctx) => ctx.isInternal
      ? 'Pain-first: "Your last Google review was 14 months ago. I looked. Want to know what that\'s costing you?"'
      : `Proof-first: "${ctx.clientName} just booked 31 people from one text. Here's the text."`,
    options: (ctx) => [
      { id: 'pain', label: 'Pain-first — name the leak', why: ctx.isInternal ? 'You already know their leak before you dial (fizzle score, days since last review). Saying it out loud in sentence one is the whole edge.' : 'Right when the audience feels the problem daily and just hasn\'t named it.' },
      { id: 'proof', label: 'Proof-first — show a result', why: ctx.isInternal ? 'Needs one real before/after. If you have it, lead with it; if not, use pain first and earn it.' : 'Strongest when there is a number or a photo to show; weakest when the business is new.' },
      { id: 'number', label: 'Curiosity — one specific number', why: 'A precise number ("31 bookings") is read; a claim ("more bookings") is skipped. Use with proof.' },
      { id: 'local', label: 'Local / identity — one of us', why: ctx.isInternal ? 'Denver to Denver works on the phone but doesn\'t carry a pitch alone; pair it with pain.' : 'Works for neighborhood businesses where being from here is the trust.' },
    ],
    customLabel: 'Or write the opening line',
    customPlaceholder: 'The first sentence, exactly as they\'d hear or read it.',
  },
  {
    id: 'channels', n: 5, title: 'Channels', short: 'Channels',
    explain: 'Where it runs. The options below are scored against this campaign — objective, budget, and what kind of business it is — not listed neutrally. Pick one primary channel and at most one supporting one; two is a campaign, five is noise.',
    example: (ctx) => ctx.isInternal
      ? 'Primary: cold calling, weekdays 4–5 PM from the Dialing queue. Supporting: Google Business Profile so the people you call can check you out.'
      : `Primary: text past customers. Supporting: ${ctx.clientName}'s Google profile, refreshed so the text has somewhere to land.`,
    options: scoreChannels,
    multi: 2,
    customLabel: 'Or name another channel',
    customPlaceholder: 'A channel not listed, and why it fits.',
  },
  {
    id: 'assets', n: 6, title: 'Assets', short: 'Assets',
    explain: 'Everything that has to exist before day one. This step writes the checklist for you from the channels and hook you chose; you pick how deep it goes. Each item becomes a real asset with a status, so "make the script" is a checkbox, not a memory.',
    example: (ctx) => ctx.isInternal
      ? 'Cold calling, lean: call script (pain-first), objection sheet, voicemail script, the lead list loaded into Dialing, one follow-up text.'
      : 'Text to past customers, standard: the text itself, a booking link, a Google profile refresh, one thank-you reply.',
    options: () => [
      { id: 'lean', label: 'Lean — just enough to start tomorrow', why: 'Fewest items. Right for a first campaign or a hard deadline: start, then add.' },
      { id: 'standard', label: 'Standard — start plus follow-ups', why: 'Adds the follow-up pieces that turn a maybe into a yes. Most campaigns.' },
      { id: 'full', label: 'Full — with tracking and proof capture', why: 'Adds the tracking sheet and proof collection so the next campaign starts with results in hand.' },
    ],
    customLabel: 'Anything else that must exist?',
    customPlaceholder: 'Extra assets, one per line.',
  },
  {
    id: 'schedule', n: 7, title: 'Schedule', short: 'Schedule',
    explain: 'When it actually goes out — dates on the calendar, not intentions. Completing this step writes the occurrences into your Schedule, so tomorrow\'s Daily Plan shows the campaign as a block, not a note.',
    example: (ctx) => ctx.isInternal
      ? 'Weekdays 4:00–5:00 PM, starting tomorrow, for two weeks. Ten calling sessions on the calendar.'
      : 'Launch day Tuesday 10:00 AM (the text goes out), follow-up Thursday, final reminder the next Tuesday.',
    options: (ctx) => [
      { id: 'daily_call_hour', label: 'Every weekday at the calling hour', why: hasChannel(ctx, 'cold_calling') ? 'Cold calling is a daily habit, not an event. Same hour, every weekday, matches the DIALS goal exactly.' : 'A daily slot suits a channel you work by hand; heavier than most one-shot channels need.' },
      { id: 'three_a_week', label: 'Three touches a week', why: 'Enough frequency to compound, light enough to keep up next to the day job.' },
      { id: 'launch_plus_two', label: 'One launch day + two follow-ups', why: hasChannel(ctx, 'past_customers') || hasChannel(ctx, 'meta_ads') ? 'A text or an ad is a moment: go out, remind, close. Three dates.' : 'Fits a message that goes out once; thin for a channel that needs daily work.' },
      { id: 'custom', label: 'Custom cadence', why: 'Set the dates yourself below.' },
    ],
    customLabel: 'Notes for the calendar entries',
    customPlaceholder: 'Anything the block should say (optional).',
    fields: [
      { key: 'start_date', label: 'Start date', type: 'date', default: () => tomorrow() },
      { key: 'start_time', label: 'Time', type: 'time', default: () => '16:00' },
      { key: 'duration_min', label: 'Minutes per session', type: 'number', default: () => 60 },
      { key: 'weeks', label: 'Weeks', type: 'number', default: () => 2 },
    ],
  },
  {
    id: 'budget', n: 8, title: 'Budget', short: 'Budget',
    explain: 'What this costs in money, if anything. Time is a cost too, but money is the one that decides which channels are even possible — and the one a client will ask about first.',
    example: (ctx) => ctx.isInternal ? '$0 — the lead list is already paid for; the cost is one hour a day.' : `${ctx.clientName}: $300 for the month — $250 in Meta ads, $50 for the booking tool.`,
    options: (ctx) => [
      { id: 'zero', label: '$0 — time only', why: hasChannel(ctx, 'meta_ads') ? 'You picked a paid channel in step 5; $0 means dropping it or going back.' : 'Every channel you chose is free. Spend nothing and measure.' },
      { id: 'under_250', label: 'Under $250', why: 'Covers tools and a boost, not a real ad campaign. Right for organic and outreach plans.' },
      { id: 'mid', label: '$250 – $1,000', why: 'Enough for a small Meta test or printed material for a launch; results are readable at this size.' },
      { id: 'custom', label: 'A specific amount', why: ctx.budgetAmount ? `The brief says ${money(ctx.budgetAmount)}${ctx.budgetPeriod ? ` / ${ctx.budgetPeriod}` : ''}; enter it below.` : 'Enter the number below.' },
    ],
    customLabel: 'Budget notes',
    customPlaceholder: 'Where the money goes.',
    fields: [
      { key: 'amount', label: 'Amount ($)', type: 'number', default: (ctx) => ctx.budgetAmount ?? 0 },
      { key: 'period', label: 'Period', type: 'select', options: [{ value: 'total', label: 'Total' }, { value: 'month', label: 'Per month' }, { value: 'week', label: 'Per week' }], default: (ctx) => ctx.budgetPeriod ?? 'total' },
    ],
  },
  {
    id: 'measurement', n: 9, title: 'Measurement', short: 'Target',
    explain: 'What counts as working, as one number with a deadline. Without it, the campaign can\'t be on track or off track — it just exists. The cockpit uses this number to decide whether to nag you.',
    example: (ctx) => ctx.isInternal ? '"2 closed clients in 14 days" — at 35 dials a day that\'s ~350 dials, ~35 conversations, ~6 discovery calls, 2 closes.' : `"${ctx.clientName}: 20 rebookings by the end of the month."`,
    options: (ctx) => {
      const obj = objectiveOf(ctx);
      const cold = hasChannel(ctx, 'cold_calling');
      const opts: StepOption[] = [];
      if (cold || obj === 'leads') opts.push({ id: 'closes', label: 'Closed clients / sales', why: 'The only number that pays. Slowest to move, so pair it with a leading indicator in your head.' });
      if (cold) opts.push({ id: 'appointments', label: 'Discovery calls booked', why: 'The leading indicator for closes — moves within days, and Dialing logs it automatically.' });
      if (cold) opts.push({ id: 'dials', label: 'Dials made (activity)', why: `Fully in your control. ${ctx.callGoal ?? 35} a day is the goal already; a campaign target should be outcomes, not just this.` });
      if (obj === 'rebooking' || obj === 'retention') opts.push({ id: 'bookings', label: 'Bookings from past customers', why: 'Direct measure of the objective; count them by the code or link in the text.' });
      if (obj === 'awareness' || obj === 'launch') opts.push({ id: 'reviews', label: 'New Google reviews', why: 'Awareness you can count. Reviews are public, dated, and compound.' });
      opts.push({ id: 'leads', label: 'Leads (calls, forms, DMs)', why: 'Broadest funnel number; fine when there are several channels feeding one inbox.' });
      opts.push({ id: 'revenue', label: 'Revenue', why: 'Right for a launch or a bundle where the ticket is the point.' });
      return opts.slice(0, 4);
    },
    customLabel: 'Or define success differently',
    customPlaceholder: 'What you will count, and how.',
    fields: [
      { key: 'target', label: 'Target number', type: 'number', default: (ctx) => (hasChannel(ctx, 'cold_calling') ? 2 : 10) },
      { key: 'by_date', label: 'By', type: 'date', default: (ctx) => addDays(String(ctx.answers.schedule?.data?.start_date ?? tomorrow()), 14) },
    ],
  },
  {
    id: 'review', n: 10, title: 'Review & launch', short: 'Launch',
    explain: 'Everything above, assembled into one plan you could hand to someone else and have them run. Read it once as if you were the client. If a line makes you wince, go back and fix the step — the plan is only the steps, restated.',
    example: () => 'A one-page plan: objective, audience, offer, hook, channels, asset checklist, schedule, budget, target. Then the Launch button.',
    options: () => [
      { id: 'launch', label: 'Launch — it starts on the first scheduled date', why: 'Status goes LIVE, the results panel opens, and the cockpit starts judging on track vs. behind.' },
      { id: 'hold', label: 'Save as a plan, launch later', why: 'The plan is done and exportable; nothing is live until you say so.' },
    ],
    customLabel: 'Launch notes',
    customPlaceholder: 'Anything to remember on day one.',
  },
];

export function stepById(id: StepId): StepDef { return STEPS.find((s) => s.id === id)!; }
export function stepByN(n: number): StepDef { return STEPS[Math.max(1, Math.min(STEPS.length, n)) - 1]; }

// ── Completion + gating ────────────────────────────────────────────────
export function isStepComplete(id: StepId, answers: Answers): boolean {
  const a = answers[id];
  if (!a) return false;
  const chosen = !!a.choice || (a.choices?.length ?? 0) > 0 || !!a.custom?.trim();
  if (!chosen) return false;
  const def = stepById(id);
  if (def.fields) {
    for (const f of def.fields) {
      const v = a.data?.[f.key];
      if (f.type === 'number') { if (v === undefined || v === null || v === '' || Number.isNaN(Number(v))) return false; }
      else if (v === undefined || v === null || v === '') return false;
    }
  }
  return !!a.done_at;
}

/** 1-based index of the first step that isn't done; STEPS.length + 1 when all are. */
export function firstIncompleteStep(answers: Answers): number {
  for (const s of STEPS) if (!isStepComplete(s.id, answers)) return s.n;
  return STEPS.length + 1;
}
export function completedCount(answers: Answers): number { return STEPS.filter((s) => isStepComplete(s.id, answers)).length; }

/** Gating: a step opens only when everything before it is done — unless
 *  the campaign has skip_gating on. Finished steps always reopen. */
export function canOpenStep(n: number, answers: Answers, skipGating: boolean): boolean {
  if (skipGating) return true;
  return n <= firstIncompleteStep(answers);
}

// ── Answer → readable text (plan document, cockpit summaries) ──────────
export function answerText(id: StepId, ctx: CampaignContext): string {
  const a = ctx.answers[id];
  if (!a) return '';
  const def = stepById(id);
  const opts = def.options(ctx);
  const labels = (a.choices ?? (a.choice ? [a.choice] : [])).map((c) => opts.find((o) => o.id === c)?.label.replace(/ · (paid|free)$/, '') ?? c);
  const parts = [...labels];
  if (a.custom?.trim()) parts.push(a.custom.trim());
  return parts.join(' — ');
}

export function channelLabels(ctx: CampaignContext): string[] {
  return channelsOf(ctx).map((c) => CHANNELS.find((ch) => ch.id === c)?.label ?? c);
}

// ── Assets: generated from channels + hook + scope ─────────────────────
export interface AssetDraft { name: string; asset_type: 'copy' | 'creative' | 'brand' | 'reference'; tags: string[]; content: string | null }

export function generateAssetChecklist(ctx: CampaignContext): AssetDraft[] {
  const scope = ctx.answers.assets?.choice ?? 'lean';
  const depth = scope === 'full' ? 3 : scope === 'standard' ? 2 : 1;
  const hook = ctx.answers.hook?.choice ?? 'pain';
  const offer = answerText('offer', ctx) || 'the offer';
  const out: AssetDraft[] = [];
  const add = (level: number, d: AssetDraft) => { if (level <= depth) out.push({ ...d, tags: ['campaign', ...d.tags] }); };
  const chans = channelsOf(ctx);
  if (chans.length === 0) chans.push('cold_calling');

  for (const ch of chans) {
    switch (ch) {
      case 'cold_calling':
        add(1, { name: `Call script (${hook}-first)`, asset_type: 'copy', tags: ['script'], content: `Opening line from step 4, then the offer: ${offer}. Under 30 seconds to the ask.` });
        add(1, { name: 'Objection sheet', asset_type: 'copy', tags: ['script'], content: 'The five objections you hear most, one sentence each. "Not now", "we have a guy", "how much", "send me an email", "not interested".' });
        add(1, { name: 'Voicemail script', asset_type: 'copy', tags: ['script'], content: 'Twelve seconds. Name, one specific thing you noticed, your number twice.' });
        add(1, { name: 'Lead list loaded into Dialing', asset_type: 'reference', tags: ['list'], content: 'LeadFlow → Lead Pool → pick the city → Send 20. Done when the queue on the Dialing screen is full for day one.' });
        add(2, { name: 'Follow-up text (after a conversation)', asset_type: 'copy', tags: ['follow-up'], content: 'Sent within an hour of any real conversation. Restates the offer, one link, no pressure.' });
        add(2, { name: 'Follow-up email (after a booked call)', asset_type: 'copy', tags: ['follow-up'], content: 'Confirms the time, says what will happen on the call, one question to answer beforehand.' });
        add(3, { name: 'Call tracking — outcomes by day', asset_type: 'reference', tags: ['tracking'], content: 'Dialing logs outcomes automatically; this is the weekly read: dials → conversations → calls booked → closes.' });
        break;
      case 'gbp':
        add(1, { name: 'Google Business Profile refresh', asset_type: 'brand', tags: ['gbp'], content: 'Hours, phone, categories, 10 recent photos, description with the offer in the first line.' });
        add(2, { name: 'Review request text', asset_type: 'copy', tags: ['gbp', 'reviews'], content: 'Sent at the moment of satisfaction. One tap link. Two sentences.' });
        add(3, { name: 'Review reply templates', asset_type: 'copy', tags: ['gbp'], content: 'Three replies: five stars, four stars, anything lower. Named, specific, short.' });
        break;
      case 'past_customers':
        add(1, { name: 'The text to past customers', asset_type: 'copy', tags: ['sms'], content: `Under 160 characters. Name, ${offer}, one link, a deadline.` });
        add(1, { name: 'Past-customer list (phone + first name)', asset_type: 'reference', tags: ['list'], content: 'Exported from wherever bookings live. Last 12 months, deduplicated.' });
        add(2, { name: 'Reminder text (day 5)', asset_type: 'copy', tags: ['sms', 'follow-up'], content: 'Shorter than the first. "Ends Friday" energy.' });
        add(3, { name: 'Booking link / code', asset_type: 'reference', tags: ['tracking'], content: 'A link or code only this campaign uses, so bookings can be counted.' });
        break;
      case 'referral_partners':
        add(1, { name: 'Partner one-pager', asset_type: 'creative', tags: ['partners'], content: 'What the partner\'s customer gets, what the partner gets, how to hand it over.' });
        add(1, { name: 'Partner list (5 neighboring businesses)', asset_type: 'reference', tags: ['list'], content: 'Same customer, different service, within walking distance.' });
        add(2, { name: 'Partner follow-up message', asset_type: 'copy', tags: ['follow-up'], content: 'Two weeks in: how many came over, and a thank-you.' });
        break;
      case 'meta_ads':
        add(1, { name: 'Ad creative — 3 variants', asset_type: 'creative', tags: ['ads'], content: `Three images or one 15-second video, ${hook}-first headline, ${offer}.` });
        add(1, { name: 'Ad copy — primary text + headline', asset_type: 'copy', tags: ['ads'], content: 'Primary text under 125 characters. Headline is the offer.' });
        add(1, { name: 'Landing destination', asset_type: 'reference', tags: ['ads'], content: 'Where the click lands: booking page, phone number, or message flow. Test it on a phone.' });
        add(2, { name: 'Audience definition', asset_type: 'reference', tags: ['ads'], content: 'Radius, age band, interests — written down so the next campaign can reuse or change it.' });
        add(3, { name: 'Results sheet — spend, clicks, leads, cost per lead', asset_type: 'reference', tags: ['tracking'], content: 'Filled weekly from Ads Manager until a connector does it.' });
        break;
      case 'door_to_door':
        add(1, { name: 'Leave-behind card', asset_type: 'creative', tags: ['print'], content: `Business card sized. ${offer}. One way to reach you.` });
        add(1, { name: 'Walk-in script (20 seconds)', asset_type: 'copy', tags: ['script'], content: 'Who you are, one thing you noticed, the offer, the ask.' });
        add(2, { name: 'Route list', asset_type: 'reference', tags: ['list'], content: 'Blocks to walk, in order, with who\'s there.' });
        break;
      case 'social_organic':
        add(1, { name: 'Post batch — first 6 posts', asset_type: 'creative', tags: ['social'], content: 'Three proof posts, two offer posts, one behind-the-scenes. Shot in one session.' });
        add(2, { name: 'Caption templates', asset_type: 'copy', tags: ['social'], content: 'Hook line, one detail, the offer, where to go.' });
        add(3, { name: 'Posting calendar', asset_type: 'reference', tags: ['social', 'tracking'], content: 'Which post, which day, for the first two weeks.' });
        break;
    }
  }
  if (hook === 'proof' || depth >= 3) add(1, { name: 'Proof — one before/after or testimonial', asset_type: 'creative', tags: ['proof'], content: 'A real result with a name on it. Without this, proof-first is a claim.' });
  const extra = (ctx.answers.assets?.custom ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  for (const e of extra) out.push({ name: e, asset_type: 'reference', tags: ['campaign', 'custom'], content: null });
  // De-duplicate by name (two channels can ask for the same list).
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.name) ? false : (seen.add(a.name), true)));
}

// ── Schedule: occurrences the calendar gets ────────────────────────────
export interface Occurrence { date: string; start_time: string; end_time: string }

export function tomorrow(from: Date = new Date()): string { return addDays(dateOnly(from), 1); }
export function dateOnly(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return dateOnly(new Date(y, m - 1, d + n));
}
function weekday(date: string): number { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function addMinutes(time: string, n: number): string {
  const [h, m] = time.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + n);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function scheduleOccurrences(answer: StepAnswer | undefined, cap = 30): Occurrence[] {
  if (!answer?.data) return [];
  const start = String(answer.data.start_date ?? tomorrow());
  const time = String(answer.data.start_time ?? '16:00').slice(0, 5);
  const dur = Math.max(15, Number(answer.data.duration_min ?? 60) || 60);
  const weeks = Math.max(1, Math.min(8, Number(answer.data.weeks ?? 2) || 2));
  const mode = answer.choice ?? 'daily_call_hour';
  const out: Occurrence[] = [];
  const push = (date: string) => { if (out.length < cap) out.push({ date, start_time: time, end_time: addMinutes(time, dur) }); };
  if (mode === 'launch_plus_two') {
    push(start); push(addDays(start, 2)); push(addDays(start, 7));
    return out;
  }
  const days = weeks * 7;
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const wd = weekday(d);
    if (wd === 0 || wd === 6) continue;
    if (mode === 'three_a_week' && ![1, 3, 5].includes(wd)) continue;
    push(d);
  }
  return out;
}

// ── Plan document ──────────────────────────────────────────────────────
export interface PlanCampaign {
  name: string;
  status: 'planned' | 'running' | 'done';
  answers: Answers;
  target_metric: string | null;
  target_value: number | null;
  budget_amount: number | null;
  budget_period: string | null;
  start_date: string | null;
  end_date: string | null;
}
export interface PlanAsset { name: string; status: 'needed' | 'in_progress' | 'done' }

export const METRIC_LABEL: Record<string, string> = {
  closes: 'closed clients', appointments: 'discovery calls booked', dials: 'dials', bookings: 'bookings',
  reviews: 'new Google reviews', leads: 'leads', revenue: 'revenue ($)',
};

export function buildPlanMarkdown(c: PlanCampaign, ctx: CampaignContext, assets: PlanAsset[]): string {
  const occ = scheduleOccurrences(c.answers.schedule);
  const lines: string[] = [];
  lines.push(`# ${c.name}`);
  lines.push(`**For:** ${ctx.isInternal ? 'Made by MARQ (internal)' : ctx.clientName}${c.status === 'running' ? '  ·  **LIVE**' : ''}`);
  lines.push('');
  const section = (title: string, body: string) => { if (body) { lines.push(`## ${title}`); lines.push(body); lines.push(''); } };
  section('Objective', answerText('objective', ctx));
  section('Audience', answerText('audience', ctx));
  section('Offer', answerText('offer', ctx));
  section('Hook', answerText('hook', ctx));
  const chans = channelLabels(ctx);
  section('Channels', chans.length ? chans.map((l, i) => `${i === 0 ? 'Primary' : 'Supporting'}: ${l}`).join('\n') + (c.answers.channels?.custom ? `\n${c.answers.channels.custom}` : '') : '');
  section('Asset checklist', assets.length ? assets.map((a) => `- [${a.status === 'done' ? 'x' : ' '}] ${a.name}${a.status === 'in_progress' ? ' (in progress)' : ''}`).join('\n') : '');
  if (occ.length) {
    const first = occ[0]; const last = occ[occ.length - 1];
    section('Schedule', `${occ.length} session${occ.length === 1 ? '' : 's'}, ${first.date} → ${last.date}, ${first.start_time}–${first.end_time}.${c.answers.schedule?.custom ? `\n${c.answers.schedule.custom}` : ''}`);
  }
  const amt = c.budget_amount ?? Number(c.answers.budget?.data?.amount ?? 0);
  section('Budget', `${money(amt)}${c.budget_period && c.budget_period !== 'total' ? ` / ${c.budget_period}` : ''}${c.answers.budget?.custom ? ` — ${c.answers.budget.custom}` : ''}`);
  const metric = c.target_metric ?? c.answers.measurement?.choice ?? '';
  const target = c.target_value ?? Number(c.answers.measurement?.data?.target ?? 0);
  const by = c.answers.measurement?.data?.by_date;
  section('Success', metric || c.answers.measurement?.custom ? `${target ? `${target} ` : ''}${METRIC_LABEL[metric] ?? metric}${by ? ` by ${by}` : ''}${c.answers.measurement?.custom ? ` — ${c.answers.measurement.custom}` : ''}` : '');
  if (c.answers.review?.custom) section('Launch notes', c.answers.review.custom);
  return lines.join('\n').trim();
}

// ── Derived status + next action (the cockpit's honesty rule) ──────────
export type StatusLevel = 'on_track' | 'needs_attention' | 'stalled';
export interface NextAction { label: string; kind: 'step' | 'assets' | 'dialing' | 'results' | 'plan' | 'launch'; step?: number }
export interface DerivedStatus { level: StatusLevel; reason: string; next: NextAction; progress: string }

export interface StatusInput {
  status: 'planned' | 'running' | 'done';
  answers: Answers;
  last_activity_at: string;
  launched_at: string | null;
  start_date: string | null;
  target_metric: string | null;
  target_value: number | null;
  isInternal: boolean;
  assets: PlanAsset[];
  /** Current value of the target metric, from manual or automatic results. */
  actual: number | null;
  now: Date;
}

const DAY = 86400000;

export function deriveStatus(i: StatusInput): DerivedStatus {
  const daysSince = (iso: string | null) => (iso ? (i.now.getTime() - new Date(iso).getTime()) / DAY : 0);
  const idle = daysSince(i.last_activity_at);
  const step = firstIncompleteStep(i.answers);
  const needed = i.assets.filter((a) => a.status !== 'done').length;
  const cold = (i.answers.channels?.choices ?? []).includes('cold_calling') || i.answers.channels?.choice === 'cold_calling';

  if (i.status === 'done') {
    return { level: 'on_track', reason: 'Finished.', next: { label: 'View plan', kind: 'plan' }, progress: 'Done' };
  }
  if (i.status === 'planned') {
    const progress = step > STEPS.length ? 'Plan ready' : `Step ${step} of ${STEPS.length}`;
    if (step > STEPS.length) {
      return { level: idle > 3 ? 'stalled' : 'needs_attention', reason: idle > 3 ? `Plan ready, untouched for ${Math.floor(idle)} days.` : 'Plan ready, not launched.', next: { label: 'Launch', kind: 'launch', step: STEPS.length }, progress };
    }
    const def = stepByN(step);
    if (idle > 3) return { level: 'stalled', reason: `No progress for ${Math.floor(idle)} days.`, next: { label: `Continue: ${def.title}`, kind: 'step', step }, progress };
    return { level: 'on_track', reason: 'Building.', next: { label: `Continue: ${def.title}`, kind: 'step', step }, progress };
  }

  // LIVE
  const progress = 'LIVE';
  if (needed > 0) {
    return { level: 'needs_attention', reason: `${needed} asset${needed === 1 ? '' : 's'} still needed.`, next: { label: `Make assets (${needed} left)`, kind: 'assets' }, progress };
  }
  const started = i.start_date ? daysSince(`${i.start_date}T00:00:00`) : daysSince(i.launched_at);
  const by = i.answers.measurement?.data?.by_date ? String(i.answers.measurement.data.by_date) : null;
  const total = by && i.start_date ? Math.max(1, (new Date(`${by}T00:00:00`).getTime() - new Date(`${i.start_date}T00:00:00`).getTime()) / DAY) : 14;
  const hasResults = i.actual !== null;
  if (idle > 7) return { level: 'stalled', reason: `Nothing logged for ${Math.floor(idle)} days.`, next: cold && i.isInternal ? { label: 'Open Dialing', kind: 'dialing' } : { label: 'Log results', kind: 'results' }, progress };
  if (started >= 1 && !hasResults) {
    return { level: 'needs_attention', reason: 'Live with no results logged yet.', next: cold && i.isInternal ? { label: 'Open Dialing', kind: 'dialing' } : { label: 'Log results', kind: 'results' }, progress };
  }
  if (hasResults && i.target_value && i.target_value > 0) {
    const expected = i.target_value * Math.min(1, Math.max(0, started) / total);
    const actual = i.actual ?? 0;
    if (started >= 2 && actual < expected * 0.6) {
      return { level: 'needs_attention', reason: `${actual} of ${i.target_value} ${METRIC_LABEL[i.target_metric ?? ''] ?? ''}; pace says ${Math.round(expected)} by now.`, next: cold && i.isInternal ? { label: 'Open Dialing', kind: 'dialing' } : { label: 'Log results', kind: 'results' }, progress };
    }
    if (actual >= i.target_value) return { level: 'on_track', reason: `Target hit: ${actual} of ${i.target_value}.`, next: { label: 'Mark done', kind: 'results' }, progress };
    return { level: 'on_track', reason: `${actual} of ${i.target_value} ${METRIC_LABEL[i.target_metric ?? ''] ?? ''}, on pace.`, next: cold && i.isInternal ? { label: 'Open Dialing', kind: 'dialing' } : { label: 'Log results', kind: 'results' }, progress };
  }
  return { level: 'on_track', reason: started < 1 ? 'Starts on schedule.' : 'Running.', next: cold && i.isInternal ? { label: 'Open Dialing', kind: 'dialing' } : { label: 'Log results', kind: 'results' }, progress };
}

// ── Results ────────────────────────────────────────────────────────────
export interface ManualResults { what_ran?: string; spend?: number; leads?: number; calls?: number; appointments?: number; closes?: number; revenue?: number }
export interface DialingResults { dials: number; conversations: number; appointments: number; closes: number; days: number }

/** The number the target is judged against, from whichever results exist. */
export function actualForMetric(metric: string | null, manual: ManualResults, auto: DialingResults | null): number | null {
  if (!metric) return null;
  if (auto) {
    if (metric === 'dials') return auto.dials;
    if (metric === 'appointments') return auto.appointments + (manual.appointments ?? 0);
    if (metric === 'closes') return auto.closes + (manual.closes ?? 0);
  }
  const m = manual as Record<string, number | string | undefined>;
  const direct = m[metric];
  if (typeof direct === 'number') return direct;
  if (metric === 'bookings' || metric === 'reviews') return typeof m.leads === 'number' ? m.leads : null;
  return null;
}
