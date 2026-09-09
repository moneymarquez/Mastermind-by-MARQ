import type { ContentGrowthPlan, GrowthPlatform } from './useContentGrowth';
import type { PrimaryGap } from '../lib/accountAuditAi';

const GAP_LABEL: Record<PrimaryGap, string> = {
  no_clear_viewer: 'no clear viewer',
  too_many_pillars: 'too many pillars',
  weak_hooks: 'weak hooks',
  inconsistent_posting: 'inconsistent posting',
};

export interface ContentIdeaDraft {
  title: string;
  pillar: string | null;
  format: string;
  hook_line: string;
  rationale: string;
}

// Deterministic and rule-based on purpose, same reasoning as Marketing's
// channel-slate engine: the purpose branch has a hard pass/fail
// validation bar ("if the taco truck slate suggests build-in-public
// content, the purpose branch is broken"), and this environment can't
// invoke the live model to verify actual AI output content. A real,
// varied hook line per idea is still produced — just via a template
// parameterized on this plan's own niche_viewer/pillars, not a live
// call. Full creative generation (script, shot list, the hook written
// three ways) is build-out's job (item 3), same split as Marketing's
// deterministic slate vs. AI-generated build-out.
const FORMAT_BY_PLATFORM: Record<GrowthPlatform, string> = {
  instagram: 'Reel',
  tiktok: 'TikTok',
  youtube_shorts: 'Short',
  youtube_long: 'Long-form video',
  linkedin: 'Text/carousel post',
  facebook: 'Short-form video',
  twitter: 'Thread',
};

function pillarFor(pillars: string[], index: number): string | null {
  if (pillars.length === 0) return null;
  return pillars[index % pillars.length];
}

function viewerOrFallback(niche: string | null): string {
  return niche && niche.trim() ? niche.trim() : 'the viewer this account is actually for';
}

type Template = (plan: ContentGrowthPlan, clientName: string, pillar: string | null, format: string) => ContentIdeaDraft;

// The operator's own page — broad entrepreneurial audience, eventual
// course/Masterminds buyers. Lifestyle and business-process content is
// on-strategy here specifically because the viewer is an aspiring
// founder, not a local customer.
const AUDIENCE_FOR_OFFER_TEMPLATES: Template[] = [
  (plan, _clientName, pillar, format) => ({
    title: 'Build in public: what actually happened this week',
    pillar,
    format,
    hook_line: `I just ${pillar ? `worked on ${pillar.toLowerCase()} for` : 'did something for'} a real client — here's exactly what happened.`,
    rationale: `${viewerOrFallback(plan.niche_viewer)} trusts a founder who shows the real, unpolished process more than one who only shows results — this is the "build in public" pillar doing its job.`,
  }),
  (plan, _clientName, pillar, format) => ({
    title: 'Receipts: a real client win',
    pillar,
    format,
    hook_line: `A client just got a result I didn't expect this fast — here's the exact thing that did it.`,
    rationale: `Aspiring founders buy proof, not promises — a specific, screenshotted win is the single most credible thing ${viewerOrFallback(plan.niche_viewer)} can see before ever considering a course or a Masterminds seat.`,
  }),
  (plan, clientName, pillar, format) => ({
    title: 'A day running this solo',
    pillar,
    format,
    hook_line: `What a real day running ${clientName || 'this business'} solo actually looks like — no assistant, no team.`,
    rationale: `Aspirational lifestyle content is on-strategy for this page specifically because ${viewerOrFallback(plan.niche_viewer)} is picturing themselves doing this — it's the "could I do this too" content that pulls a future buyer in.`,
  }),
  (plan, _clientName, pillar, format) => ({
    title: 'Contrarian take',
    pillar,
    format,
    hook_line: `Everyone tells new operators to do this first — here's why that's actually backwards.`,
    rationale: `A genuine contrarian take earns attention and trust from ${viewerOrFallback(plan.niche_viewer)} faster than agreeable advice — it signals real, hard-won experience instead of recycled tips.`,
  }),
];

// A client's page — narrow, local, conversion-focused. Never build-in-
// public/course/personal-brand framing; every idea has to make sense to
// a real potential customer of THIS business, whatever it is.
const LEADS_FOR_BUSINESS_TEMPLATES: Template[] = [
  (plan, clientName, pillar, format) => ({
    title: `Behind the ${pillar ? pillar.toLowerCase() : 'process'}`,
    pillar,
    format,
    hook_line: `Here's what actually happens before ${clientName || 'we'} ${pillar ? `handle${pillar.toLowerCase().endsWith('s') ? '' : 's'} ${pillar.toLowerCase()}` : 'get to you'}.`,
    rationale: `${viewerOrFallback(plan.niche_viewer)} trusts what they can see happen — the real process, shown plainly, does more to convert than any claim about quality.`,
  }),
  (plan, clientName, pillar, format) => ({
    title: 'A real customer moment',
    pillar,
    format,
    hook_line: `Watch what happened when someone just like you showed up today.`,
    rationale: `Social proof from an actual customer moment is the fastest way for ${viewerOrFallback(plan.niche_viewer)} to see themselves as the next one — far more convincing than ${clientName || 'the business'} talking about itself.`,
  }),
  (plan, clientName, pillar, format) => ({
    title: 'Right here, right now',
    pillar,
    format,
    hook_line: `If you're ${viewerOrFallback(plan.niche_viewer)}, this is exactly for you.`,
    rationale: `Local, conversion-focused content has to name the viewer directly — ${clientName || 'this business'} only needs people close enough to actually become customers, not broad reach.`,
  }),
  (plan, clientName, pillar, format) => ({
    title: 'Before and after',
    pillar,
    format,
    hook_line: `This is what it looked like before ${clientName || 'we'} ${pillar ? `fixed the ${pillar.toLowerCase()}` : 'stepped in'} — and after.`,
    rationale: `A concrete before/after is proof ${viewerOrFallback(plan.niche_viewer)} can evaluate themselves in seconds — the format that does the most work for a considered purchase.`,
  }),
  (plan, clientName, pillar, format) => ({
    title: 'The question everyone asks',
    pillar,
    format,
    hook_line: `The #1 thing people ask before working with ${clientName || 'us'} — answered honestly.`,
    rationale: `Answering the real objection publicly removes it before ${viewerOrFallback(plan.niche_viewer)} ever has to ask — a direct assist for the actual buying decision.`,
  }),
];

export interface LastCheckinSignal {
  what_worked: string | null;
  what_to_change: string | null;
}

function boostPillar(drafts: ContentIdeaDraft[], pillar: string): ContentIdeaDraft[] {
  const norm = pillar.toLowerCase();
  const matches = (d: ContentIdeaDraft) => !!d.pillar && d.pillar.toLowerCase() === norm;
  const boosted = drafts.filter(matches);
  if (boosted.length === 0) return drafts;
  const rest = drafts.filter((d) => !matches(d));
  return [...boosted, ...rest];
}

/** "The answers reshape next week's slate" (build order item 6) — a
 *  pillar the operator flagged as working last week gets bumped to the
 *  front of the next slate; nothing here invents a reason, it just
 *  reorders toward the pillar the operator already said was landing.
 *  Deliberately a reorder, not a rewrite: the underlying idea templates
 *  stay the same, honest ones — only which one leads changes. */
function reorderByLastCheckin(drafts: ContentIdeaDraft[], lastCheckin: LastCheckinSignal | undefined): ContentIdeaDraft[] {
  const worked = lastCheckin?.what_worked?.toLowerCase().trim();
  if (!worked) return drafts;
  const matches = (d: ContentIdeaDraft) => !!d.pillar && worked.includes(d.pillar.toLowerCase());
  const boosted = drafts.filter(matches);
  if (boosted.length === 0) return drafts;
  const rest = drafts.filter((d) => !matches(d));
  return [...boosted, ...rest];
}

/** Generates the content slate for a growth plan. Requires page_purpose
 *  to be set — same hard gate as Marketing's business_model — since
 *  "do not generate one slate for both" is the build prompt's own
 *  non-negotiable framing, not a soft preference. lastCheckin is
 *  optional: the very first slate for a plan has no check-in history
 *  yet to reshape anything from. hookLogBestPillar (build order item 7)
 *  is a harder signal than the self-reported checkin text — logged,
 *  verdict-backed outcomes, gated behind a 30-post floor — so it wins
 *  when both are present; the checkin text is the fallback while that
 *  floor hasn't been reached yet. */
export function generateContentSlate(plan: ContentGrowthPlan, clientName: string, lastCheckin?: LastCheckinSignal, hookLogBestPillar?: string | null): ContentIdeaDraft[] {
  if (!plan.page_purpose) return [];
  const templates = plan.page_purpose === 'audience_for_offer' ? AUDIENCE_FOR_OFFER_TEMPLATES : LEADS_FOR_BUSINESS_TEMPLATES;
  const format = FORMAT_BY_PLATFORM[plan.platform];
  const drafts = templates.map((t, i) => t(plan, clientName || 'this business', pillarFor(plan.pillars, i), format));
  if (hookLogBestPillar) return boostPillar(drafts, hookLogBestPillar);
  return reorderByLastCheckin(drafts, lastCheckin);
}

/** "The diagnosis then seeds the growth plan — the test list becomes
 *  the first slate" (addendum, Screen 0). A direct, deterministic
 *  mapping — each test-list line becomes the idea's own hook line
 *  rather than being run through the template catalog again, since the
 *  audit already did the actual thinking; templating it a second time
 *  would just paraphrase the audit's own output. Pillar is left null —
 *  when the diagnosed gap is itself "too many pillars," forcing a test
 *  idea into one of the existing (suspect) pillars would undercut the
 *  fix. Never used when the test list is empty — an audit with no test
 *  items has nothing real to seed. */
export function seedSlateFromAudit(testList: string[], primaryGap: PrimaryGap, plan: ContentGrowthPlan): ContentIdeaDraft[] {
  const format = FORMAT_BY_PLATFORM[plan.platform];
  return testList.map((line, i) => ({
    title: `Test ${i + 1}: from the account audit`,
    pillar: null,
    format,
    hook_line: line,
    rationale: `Directly addresses this account's diagnosed gap — ${GAP_LABEL[primaryGap]} — from the account audit, not a generic template.`,
  }));
}
