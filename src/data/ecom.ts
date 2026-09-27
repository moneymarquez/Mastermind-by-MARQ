/** E-commerce module — types and the pure rules the screens read.
 *
 *  Phase 1 (spec v3 §12): brands, the 10-step stepper with manual fields,
 *  health, and the LeadFlow-standard presentation helpers (labelled
 *  numbers, confidence badges). No React, no network. */

export type Channel = 'tiktok' | 'amazon' | 'meta' | 'etsy' | 'walmart' | 'rising';
export type Confidence = 'hard' | 'estimate' | 'ai';
export type Health = 'building' | 'testing' | 'growing' | 'stalled' | 'killed';
export type StepStatus = 'todo' | 'in_progress' | 'waiting' | 'done';
export type Domain = 'ecom' | 'content' | 'marketing' | 'all';

export const CHANNELS: { id: Channel; label: string; short: string }[] = [
  { id: 'tiktok', label: 'TikTok Shop', short: 'TikTok' },
  { id: 'amazon', label: 'Amazon', short: 'Amazon' },
  { id: 'meta', label: 'Facebook / IG', short: 'FB/IG' },
  { id: 'etsy', label: 'Etsy', short: 'Etsy' },
  { id: 'walmart', label: 'Walmart', short: 'Walmart' },
  { id: 'rising', label: 'Rising everywhere', short: 'Rising' },
];

export const CONFIDENCE_LABEL: Record<Confidence, string> = { hard: 'Hard data', estimate: 'Estimate', ai: 'AI read' };
export const CONFIDENCE_COLOR: Record<Confidence, string> = { hard: 'var(--success)', estimate: 'var(--accent)', ai: 'var(--accent-strong)' };

export const HEALTH_LABEL: Record<Health, string> = { building: 'Building', testing: 'Testing', growing: 'Growing', stalled: 'Stalled', killed: 'Killed' };
export const HEALTH_COLOR: Record<Health, string> = { building: 'var(--accent)', testing: 'var(--warning)', growing: 'var(--success)', stalled: 'var(--warning)', killed: 'var(--text-tertiary)' };

// ── Brands ─────────────────────────────────────────────────────────────
export interface StepField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'url' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
  unit?: string;
  /** Shown under the field: what a good answer looks like. */
  hint?: string;
}

export interface StepDef {
  n: number;
  key: string;
  title: string;
  /** What workers will produce here once they exist (Phase 3+). */
  workers: string;
  /** What Marq does at this step. */
  you: string;
  /** Hard stop: money or a physical product. Never automated. */
  hardStop?: string;
  fields: StepField[];
}

/** The ten steps, with the manual fields Phase 1 lets you fill by hand.
 *  When workers arrive they populate the same fields; nothing moves. */
export const STEPS: StepDef[] = [
  { n: 1, key: 'product', title: 'Pick product', workers: 'Rank the sheets and shortlist 3 with reasons.', you: 'Pick one.',
    fields: [
      { key: 'product_name', label: 'Product', type: 'text', placeholder: 'e.g. Posture corrector, magnetic' },
      { key: 'channel', label: 'Channel it\'s winning on', type: 'select', options: ['TikTok Shop', 'Amazon', 'Facebook / IG', 'Etsy', 'Walmart'] },
      { key: 'why', label: 'Why this one', type: 'textarea', placeholder: 'The problem it solves and the evidence it\'s selling', hint: 'Specific beats vague: "3 sellers over 10k units on TikTok Shop in 30 days" not "trending".' },
    ] },
  { n: 2, key: 'validate', title: 'Validate', workers: 'Margin math incl. shipping, returns and fees; trend timing; why it could fail.', you: 'Thumbs up or down.',
    fields: [
      { key: 'sell_price', label: 'Sell price', type: 'number', unit: '$' },
      { key: 'supplier_cost', label: 'Supplier cost', type: 'number', unit: '$' },
      { key: 'ship_cost', label: 'Shipping to customer', type: 'number', unit: '$' },
      { key: 'ship_days', label: 'Ship time', type: 'number', unit: 'days' },
      { key: 'trend', label: 'Trend timing', type: 'select', options: ['early', 'rising', 'peak', 'late', 'fading'] },
      { key: 'fail_risks', label: 'Why it could fail', type: 'textarea', placeholder: 'Returns risk, fragile, seasonal, trademark, restricted category' },
    ] },
  { n: 3, key: 'teardown', title: 'Teardown', workers: 'Competitor dossiers on the top 3–5 sellers, then 3 unclaimed angles.', you: 'Pick an angle.',
    fields: [
      { key: 'competitors', label: 'Top competitors', type: 'textarea', placeholder: 'One per line: store — link — their hero product — their angle' },
      { key: 'angle', label: 'The angle we\'re taking', type: 'textarea', placeholder: 'One line. Who it targets, the psychology principle, how you\'d film it on a phone.', hint: 'Cite the principle: "Anchoring — show $89 crossed out next to $39."' },
      { key: 'principle', label: 'Principle cited', type: 'text', placeholder: 'e.g. Social proof, Anchoring, Loss aversion' },
    ] },
  { n: 4, key: 'supplier', title: 'Supplier', workers: 'Find 3–5 suppliers, compare cost, ship time, rating, MOQ, branded packaging; draft the sample order and inspection checklist.', you: 'Approve the supplier, then click Buy on the sample yourself.', hardStop: 'Money and a physical product. The sample is queued, never bought for you.',
    fields: [
      { key: 'supplier_name', label: 'Supplier', type: 'text' },
      { key: 'supplier_url', label: 'Link', type: 'url' },
      { key: 'unit_cost', label: 'Unit cost', type: 'number', unit: '$' },
      { key: 'ship_days', label: 'Ship time to US', type: 'number', unit: 'days' },
      { key: 'sample_status', label: 'Sample', type: 'select', options: ['not ordered', 'ordered', 'shipped', 'received', 'passed', 'failed'] },
      { key: 'tracking', label: 'Tracking', type: 'text' },
      { key: 'inspection', label: 'Inspection notes', type: 'textarea', placeholder: 'Hard-no list: smell, flimsy hinge, colour off. What passed, what didn\'t.' },
    ] },
  { n: 5, key: 'brand', title: 'Brand Lab', workers: 'Three complete brand options reasoned from the buyer: name (domain + handles checked), positioning, voice, palette with a reason per colour, type, logo direction.', you: 'Pick one, then buy the domain yourself.', hardStop: 'Money: the domain purchase is yours.',
    fields: [
      { key: 'buyer', label: 'Who\'s buying', type: 'textarea', placeholder: 'Women 25–40, new homeowners, buying because the living room looks unfinished', hint: 'Age, gender skew, life situation, where they scroll, what they already own. Never "people who like home decor".' },
      { key: 'positioning', label: 'Positioning', type: 'textarea', placeholder: 'Who it\'s for and why they\'d pick you' },
      { key: 'voice', label: 'Voice (3 words)', type: 'text', placeholder: 'Calm, exact, warm' },
      { key: 'palette', label: 'Palette, with the reason for each colour', type: 'textarea', placeholder: 'Deep navy — trust + premium for 30+ homeowners. Warm sand — softens the navy so it doesn\'t read corporate.' },
      { key: 'domain', label: 'Domain', type: 'text', placeholder: 'brand.com' },
      { key: 'handles', label: 'Handles (IG / TikTok)', type: 'text', placeholder: '@brand / @brand' },
      { key: 'principles', label: 'Principles cited', type: 'text' },
    ] },
  { n: 6, key: 'store', title: 'Store build', workers: 'Build the site, commit to a branch, run the quality gate (mobile screenshots, Lighthouse ≥ 90, no broken links, no placeholder text, the doesn\'t-look-AI-made list).', you: 'Review the preview, then merge to deploy. Never straight to production.',
    fields: [
      { key: 'repo', label: 'Store repo', type: 'url', placeholder: 'github.com/…' },
      { key: 'preview_url', label: 'Preview URL', type: 'url' },
      { key: 'checkout', label: 'Checkout', type: 'select', options: ['undecided', 'Shopify backend + custom storefront', 'Stripe Checkout (manual fulfilment)'] },
      { key: 'review_notes', label: 'Review notes', type: 'textarea', placeholder: 'Every correction here gets written into the website design playbook.' },
    ] },
  { n: 7, key: 'content', title: 'Content', workers: 'Hooks, scripts, captions and Higgsfield visuals, in the brand\'s voice, ready to approve.', you: 'Approve drafts. Film the product shots from the Step 4 shot list.',
    fields: [
      { key: 'hooks', label: 'Hooks (one per line)', type: 'textarea' },
      { key: 'shots_done', label: 'Product shots filmed', type: 'select', options: ['no', 'partly', 'yes'] },
      { key: 'content_notes', label: 'Notes', type: 'textarea' },
    ] },
  { n: 8, key: 'post', title: 'Post', workers: 'Posting plan: 2 posts a day per product for 14 days on TikTok + Reels, hooks rotated across the 3 angles.', you: 'Post them (v1). Auto-posting comes after a worker earns it.',
    fields: [
      { key: 'start_date', label: 'Test start', type: 'date' },
      { key: 'posts_per_day', label: 'Posts per day', type: 'number', placeholder: '2' },
      { key: 'platforms', label: 'Platforms', type: 'text', placeholder: 'TikTok, IG Reels' },
      { key: 'post_log', label: 'Post log', type: 'textarea', placeholder: 'Date — hook — views (fill by hand until metrics connect)' },
    ] },
  { n: 9, key: 'read', title: 'Read', workers: 'Pull the numbers daily, diagnose where the funnel breaks, raise kill / double-down / fix flags.', you: 'Read the flags.',
    fields: [
      { key: 'views', label: 'Avg views per post', type: 'number' },
      { key: 'clicks', label: 'Clicks', type: 'number' },
      { key: 'add_to_carts', label: 'Add to carts', type: 'number' },
      { key: 'purchases', label: 'Purchases', type: 'number' },
      { key: 'diagnosis', label: 'Where it\'s breaking', type: 'select', options: ['not enough data', 'low views — hook', 'views, no clicks — not wanted', 'clicks, no cart — page', 'cart, no purchase — price/trust', 'sales, high refunds — product', 'working'] },
    ] },
  { n: 10, key: 'decide', title: 'Scale or kill', workers: 'A recommendation with the evidence behind it.', you: 'Decide.',
    fields: [
      { key: 'decision', label: 'Decision', type: 'select', options: ['undecided', 'scale', 'iterate', 'kill'] },
      { key: 'reason', label: 'Reason', type: 'textarea' },
    ] },
];

export interface StepState {
  status?: StepStatus;
  fields?: Record<string, string>;
  note?: string;
  done_at?: string;
}
export type BrandSteps = Record<string, StepState>;

export interface Brand {
  id: string;
  name: string;
  owner_type: 'mine' | 'client';
  client_id: string | null;
  current_step: number;
  health: Health;
  positioning: string | null;
  logo_url: string | null;
  identity: Record<string, unknown>;
  steps: BrandSteps;
  domain: string | null;
  repo: string | null;
  pages_project: string | null;
  shopify_store: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export function stepState(b: Pick<Brand, 'steps'>, n: number): StepState { return b.steps?.[String(n)] ?? {}; }
export function stepStatus(b: Pick<Brand, 'steps'>, n: number): StepStatus { return stepState(b, n).status ?? 'todo'; }
export function doneSteps(b: Pick<Brand, 'steps'>): number { return STEPS.filter((s) => stepStatus(b, s.n) === 'done').length; }
/** First step not done — where the stepper opens. */
export function nextStep(b: Pick<Brand, 'steps'>): number { return STEPS.find((s) => stepStatus(b, s.n) !== 'done')?.n ?? 10; }

/** Health is derived, never typed: a brand can't be "growing" with no
 *  orders. Killed is the one explicit state (step 10 decision). */
export function deriveHealth(b: Pick<Brand, 'steps' | 'last_activity_at'>, orders30d: number, now: Date): Health {
  if (stepState(b, 10).fields?.decision === 'kill') return 'killed';
  const idleDays = (now.getTime() - new Date(b.last_activity_at).getTime()) / 86400000;
  const step = nextStep(b);
  if (orders30d >= 10) return 'growing';
  if (step >= 8 && stepStatus(b, 8) !== 'todo') return idleDays > 7 ? 'stalled' : 'testing';
  return idleDays > 7 ? 'stalled' : 'building';
}

/** The one line on the card that tells you what to do next. */
export function nextAction(b: Pick<Brand, 'steps'>): string {
  const n = nextStep(b);
  const s = STEPS[n - 1];
  const st = stepStatus(b, n);
  if (st === 'waiting') return `Waiting on you: ${s.title}`;
  if (n === 10 && st === 'done') return 'Decided';
  return `Step ${n} · ${s.you.replace(/\.$/, '')}`;
}

// ── Validate rules (§6 step 2) ─────────────────────────────────────────
export interface ValidateInput { sellPrice: number; supplierCost: number; shipCost: number; shipDays: number; trend: string }
export interface ValidateResult { landed: number; multiple: number; rules: { name: string; pass: boolean; detail: string }[]; pass: boolean }

export function validate(i: ValidateInput): ValidateResult {
  const fees = i.sellPrice * 0.03;
  const returns = i.sellPrice * 0.075; // 5–10%, midpoint
  const landed = i.supplierCost + i.shipCost + fees + returns;
  const multiple = landed > 0 ? i.sellPrice / landed : 0;
  const rules = [
    { name: 'Price ≥ 3× landed', pass: multiple >= 3, detail: `$${i.sellPrice.toFixed(2)} vs $${landed.toFixed(2)} landed = ${multiple.toFixed(1)}×` },
    { name: 'Ships in ≤ 12 days', pass: i.shipDays > 0 && i.shipDays <= 12, detail: `${i.shipDays || '?'} days` },
    { name: 'Trend early or rising', pass: i.trend === 'early' || i.trend === 'rising', detail: i.trend || 'not set' },
  ];
  return { landed, multiple, rules, pass: rules.every((r) => r.pass) };
}

// ── Presentation helpers (LeadFlow standard §2) ────────────────────────
export function money(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const ms = now.getTime() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? '1d ago' : `${d}d ago`;
}
export function trendArrow(current: number | null | undefined, previous: number | null | undefined): '↑' | '↓' | '→' | '' {
  if (current == null || previous == null) return '';
  if (current > previous) return '↑';
  if (current < previous) return '↓';
  return '→';
}

// ── Workers config (§9) — the one place model choices live ─────────────
export interface WorkerDef { key: string; name: string; role: string; model: string; domain: Domain; tools: string[]; phase: number }
export const WORKERS: WorkerDef[] = [
  { key: 'scout', name: 'Product Scout', role: 'Fill Product Sheets per channel; take snapshots.', model: 'claude-haiku-4-5', domain: 'ecom', tools: ['web search'], phase: 3 },
  { key: 'analyst', name: 'Audience Analyst', role: 'Who buys, why, the angle, the margin math.', model: 'claude-sonnet-5', domain: 'ecom', tools: [], phase: 3 },
  { key: 'teardown', name: 'Competitor Teardown', role: 'Dossiers on the top sellers; 3 unclaimed angles.', model: 'claude-sonnet-5', domain: 'ecom', tools: ['web search'], phase: 4 },
  { key: 'supplier', name: 'Supplier Finder', role: 'Suppliers, sample order draft, inspection sheet.', model: 'claude-haiku-4-5', domain: 'ecom', tools: ['web search', 'CJ Dropshipping API'], phase: 5 },
  { key: 'brandlab', name: 'Brand Lab', role: 'Three brand options from the buyer profile.', model: 'claude-sonnet-5', domain: 'ecom', tools: ['Higgsfield'], phase: 5 },
  { key: 'builder', name: 'Store Builder', role: 'Site code to a GitHub branch; quality gate.', model: 'claude-sonnet-5', domain: 'ecom', tools: ['GitHub', 'Cloudflare Pages', 'Playwright'], phase: 6 },
  { key: 'content', name: 'Content Producer', role: 'Hooks, scripts, captions, visuals. Shared with the Content Engine.', model: 'claude-sonnet-5', domain: 'content', tools: ['Higgsfield'], phase: 7 },
  { key: 'analytics', name: 'Analytics', role: 'Pull metrics, compute the funnel, raise flags.', model: 'claude-haiku-4-5', domain: 'ecom', tools: ['Shopify', 'TikTok', 'Instagram'], phase: 7 },
  { key: 'orchestrator', name: 'Orchestrator', role: 'Assign work, read outputs, score, route your notes, write the daily summary.', model: 'claude-fable-5-1', domain: 'all', tools: ['playbooks'], phase: 4 },
  // Marketing Engine (spec 08 §3). Phases are M-phases.
  { key: 'lead_filter', name: 'Lead Filter', role: 'Flag and remove chains/franchises, tag single vs. multi-location, dedupe the 58k list.', model: 'claude-haiku-4-5', domain: 'marketing', tools: ['LeadFlow'], phase: 2 },
  { key: 'campaign_planner', name: 'Campaign Planner', role: 'Weekly plan: which list, which script, which channel, target numbers.', model: 'claude-sonnet-5', domain: 'marketing', tools: ['playbooks'], phase: 4 },
  { key: 'script_copy', name: 'Script & Copy', role: 'Openers, voicemails, emails, DMs, landing copy — 3 tones × 2 audiences; cites the principle.', model: 'claude-sonnet-5', domain: 'marketing', tools: ['playbooks'], phase: 4 },
  { key: 'inbound_tracker', name: 'Inbound Tracker', role: "Tags each inbound lead's source; alerts you if one waits over an hour.", model: 'claude-haiku-4-5', domain: 'marketing', tools: ['website form'], phase: 3 },
  { key: 'campaign_scorer', name: 'Campaign Scorer', role: 'Grades each campaign out of 4, names the weak funnel stage, writes the fix.', model: 'claude-sonnet-5', domain: 'marketing', tools: [], phase: 4 },
  // Content Engine (spec 07 §4). Phases are C-phases.
  { key: 'account_auditor', name: 'Account Auditor', role: 'Weekly: your posts vs. results. 3 things to repeat, 3 to stop.', model: 'claude-sonnet-5', domain: 'content', tools: ['Instagram', 'TikTok'], phase: 3 },
  { key: 'trend_researcher', name: 'Trend Researcher', role: 'Trends, formats, audio and example posts in your niches. Fills Inspiration.', model: 'claude-haiku-4-5', domain: 'content', tools: ['web search', 'TikTok Creative Center'], phase: 3 },
  { key: 'idea_script', name: 'Idea & Script', role: 'Weekly plan: 3 hooks per post, script, shot list, on-screen text, CTA.', model: 'claude-sonnet-5', domain: 'content', tools: ['playbooks'], phase: 3 },
  { key: 'clip_editor', name: 'Clip Editor', role: 'Best moments from raw clips, cuts, 9:16, captions, enhancements.', model: 'claude-sonnet-5', domain: 'content', tools: ['Higgsfield'], phase: 4 },
  { key: 'post_planner', name: 'Post Planner', role: 'Best time per account from your data, caption, hashtags, cross-post plan.', model: 'claude-haiku-4-5', domain: 'content', tools: [], phase: 5 },
  { key: 'content_analytics', name: 'Analytics', role: 'Daily metric pull, grades out of 4, flags breakouts and flops.', model: 'claude-haiku-4-5', domain: 'content', tools: ['Instagram', 'TikTok'], phase: 5 },
];
/** Workers a screen shows: its own domain plus the shared orchestrator. */
export function workersFor(domain: Domain): WorkerDef[] {
  return WORKERS.filter((w) => w.domain === domain || w.domain === 'all');
}

/** Workers whose runtime exists in this build. Everyone else shows the
 *  phase they arrive in (and a lights-off room in View Office). */
export const LIVE_WORKERS = ['scout'];

/** Longest a single playbook may be. Enforced in the editor, on save, and
 *  when the orchestrator applies an edit. */
export const PLAYBOOK_MAX_CHARS = 25000;
/** Total playbook text one run loads (worker's own + its module's + the
 *  cross-module ones). Room for three full playbooks. */
export const PLAYBOOK_LOAD_BUDGET = 75000;

export const AUTONOMY_LABEL: Record<number, string> = { 0: 'L0 · Draft', 1: 'L1 · Queue', 2: 'L2 · Act + notify' };

// ── Connections (§11) ──────────────────────────────────────────────────
export interface ConnectionDef { provider: string; name: string; needed: string; phase: number }
export const CONNECTIONS: ConnectionDef[] = [
  { provider: 'anthropic', name: 'Anthropic API key', needed: 'All workers', phase: 3 },
  { provider: 'etsy', name: 'Etsy Open API key', needed: 'Etsy sheet', phase: 3 },
  { provider: 'cj', name: 'CJ Dropshipping API', needed: 'Supplier step', phase: 5 },
  { provider: 'higgsfield', name: 'Higgsfield API', needed: 'Brand Lab mockups, content visuals', phase: 5 },
  { provider: 'github', name: 'GitHub fine-grained token', needed: 'Store build (store repos only)', phase: 6 },
  { provider: 'cloudflare', name: 'Cloudflare Pages', needed: 'Previews and deploy', phase: 6 },
  { provider: 'shopify', name: 'Shopify custom app token', needed: 'Orders, revenue, checkout', phase: 7 },
  { provider: 'social', name: 'Instagram / TikTok', needed: 'Post metrics', phase: 7 },
];
