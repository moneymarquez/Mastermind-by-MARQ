import type { MarketingBrief } from './useMarketingBriefs';

/** How the play/channel slate branches — never off industry. The build
 *  prompt's own failure condition: "if the peptide test suggests a
 *  Google Business Profile, the business-model branch is broken." Kept
 *  here (not in useMarketingBriefs) because it's the slate engine's own
 *  vocabulary — the brief just stores whichever one the operator picked. */
export type BusinessModel = 'local_service' | 'local_retail' | 'ecommerce' | 'online_service' | 'wholesale';

export const BUSINESS_MODELS: { key: BusinessModel; label: string; hint: string }[] = [
  { key: 'local_retail', label: 'Local retail', hint: 'walk-in or drive-up — a taco truck, a salon, a shop' },
  { key: 'local_service', label: 'Local service', hint: 'goes to the customer or is booked by them — a plumber, a cleaner' },
  { key: 'online_service', label: 'Online service', hint: 'no storefront, sells expertise or a service remotely' },
  { key: 'ecommerce', label: 'Ecommerce', hint: 'sells physical or digital products online, no local presence' },
  { key: 'wholesale', label: 'Wholesale / B2B', hint: 'sells to other businesses, not consumers' },
];

export type PlayCategory = 'free' | 'paid' | 'offline';
export type EffortLevel = 'low' | 'medium' | 'high';

export interface PlayDraft {
  play_key: string;
  title: string;
  category: PlayCategory;
  rationale: string;
  cost_estimate: string;
  speed_to_signal: string;
  effort_level: EffortLevel;
  honest_risk: string;
}

function fact(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return `${label} is ${value}`;
}

/** Pulls whatever real numbers the brief actually has into one clause, so
 *  a play's rationale can point at them — "show the reasoning," rule 2.
 *  Never invents a number that isn't on the brief; says so plainly when
 *  there's nothing to point at yet. */
function briefFacts(brief: MarketingBrief, keys: (keyof MarketingBrief)[]): string {
  const parts: string[] = [];
  for (const k of keys) {
    if (k === 'avg_transaction_value' && brief.avg_transaction_value) parts.push(`average ticket is $${Number(brief.avg_transaction_value).toLocaleString()}`);
    else if (k === 'repeat_customer_pct' && brief.repeat_customer_pct !== null && brief.repeat_customer_pct !== undefined) parts.push(`${brief.repeat_customer_pct}% of revenue is repeat`);
    else if (k === 'revenue_sources') { const v = fact('current business', brief.revenue_sources); if (v) parts.push(v); }
    else if (k === 'competitor_diff') { const v = fact('the stated edge over competitors', brief.competitor_diff); if (v) parts.push(v); }
  }
  return parts.length > 0 ? parts.join('; ') + '.' : "no numbers on the brief yet to point at — worth filling in before spending anything.";
}

/** Re-ranks a generated list so whichever play a priority map names for
 *  the diagnosed leak lands first, without changing what's actually in
 *  the list — used by both the channel slate and the free-plays
 *  checklist so a retention leak, say, promotes the same kind of play
 *  (reactivation) wherever it appears. */
function applyLeakPriority<T extends { play_key: string }>(list: T[], leak: MarketingBrief['primary_leak'], priorityMap: Record<NonNullable<MarketingBrief['primary_leak']>, string[]>): T[] {
  const priority = leak ? priorityMap[leak] : [];
  if (!priority || priority.length === 0) return list;
  return [...list].sort((a, b) => {
    const ai = priority.indexOf(a.play_key);
    const bi = priority.indexOf(b.play_key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Paid + offline channel catalogs, one per business model — Screen 3's
// "channel slate." Free plays live entirely in FREE_PLAYS_CATALOG below
// now (build order item 3): a business model's free tactics and its paid
// channels are ranked and gated completely differently, so keeping them
// in one undifferentiated list was the wrong shape once the checklist's
// gate needed to know exactly which rows were "free" in the checklist
// sense. No catalog below ever contains a Google Business Profile play —
// GBP only ever appears in the checklist, and only for business models
// with a real local/service-area presence.
const CATALOGS: Record<BusinessModel, (brief: MarketingBrief, clientName: string) => PlayDraft[]> = {
  local_retail: () => [
    {
      play_key: 'local_search_ads',
      title: 'Local Search ads (Google)',
      category: 'paid',
      rationale: 'Once the free profile and reviews are in place, paid local search ads amplify the same "near me" intent that\'s already converting for free.',
      cost_estimate: '$15-25/day to reach a readable signal',
      speed_to_signal: 'Clicks same-day; a real read in 1-2 weeks',
      effort_level: 'medium',
      honest_risk: 'Wasted spend if the free plays checklist isn\'t resolved first — the ad sends people to a thin profile.',
    },
  ],

  local_service: () => [
    {
      play_key: 'google_search_ads',
      title: 'Google Search ads — intent-only',
      category: 'paid',
      rationale: 'A person searching "emergency [service] near me" is already trying to buy — this is the one channel that matches that intent directly. Awareness/discovery platforms (TikTok, Instagram) reach people who aren\'t looking and would waste budget on a business people only think about the moment something breaks.',
      cost_estimate: '$20-40/day to reach a readable signal',
      speed_to_signal: 'Clicks same-day; a real read in about a week',
      effort_level: 'medium',
      honest_risk: 'Search ads only work once the destination (site or booking flow) actually converts — confirm that first.',
    },
  ],

  ecommerce: (brief, name) => [
    {
      play_key: 'meta_prospecting',
      title: 'Meta prospecting ads',
      category: 'paid',
      rationale: `${name} has no local storefront — Meta's targeting and catalog ads are built for exactly this shape of business: product-led, national/online audience.`,
      cost_estimate: '$300-500 total to reach the ~50 conversions Meta needs to optimize',
      speed_to_signal: '1-2 weeks once spend starts',
      effort_level: 'medium',
      honest_risk: 'Needs a converting product/landing page and real creative — an ad pointed at a weak page burns the budget finding that out.',
    },
    {
      play_key: 'google_shopping_search',
      title: 'Google Shopping / Search',
      category: 'paid',
      rationale: `Captures people already searching for the product by name or category — high-intent traffic a purely local channel can't reach. ${briefFacts(brief, ['revenue_sources'])}`,
      cost_estimate: '$15-30/day to start',
      speed_to_signal: '1-2 weeks',
      effort_level: 'medium',
      honest_risk: 'Competitive on price-comparison terms; margin needs to support the click cost.',
    },
  ],

  online_service: () => [
    {
      play_key: 'search_ads_intent',
      title: 'Search ads — high-intent terms only',
      category: 'paid',
      rationale: 'Search captures people already looking for this kind of help; broad social awareness spend is a poor fit for a considered, expertise-based purchase.',
      cost_estimate: '$20-40/day to start',
      speed_to_signal: '1-2 weeks',
      effort_level: 'medium',
      honest_risk: 'Cost-per-click on expertise terms can be high — watch payback against the deal size.',
    },
  ],

  wholesale: () => [
    {
      play_key: 'trade_shows_chamber',
      title: 'Trade shows & chamber membership',
      category: 'offline',
      rationale: 'Wholesale relationships are still mostly built face-to-face — a trade show or chamber puts the business in front of buyers who are already sourcing.',
      cost_estimate: 'Booth/membership fee — varies widely',
      speed_to_signal: 'Weeks to months — B2B sales cycles are long',
      effort_level: 'high',
      honest_risk: 'Longest cycle of any play in this catalog — plan the checkpoint accordingly, not on a consumer-play timeline.',
    },
    {
      play_key: 'linkedin_search_ads',
      title: 'LinkedIn + Search ads to named buyer titles',
      category: 'paid',
      rationale: 'Reaches the specific buyer titles who make purchasing decisions — a consumer platform like Meta or TikTok has no comparable B2B targeting.',
      cost_estimate: '$300-600 to reach a readable signal (LinkedIn CPCs run high)',
      speed_to_signal: '2-4 weeks',
      effort_level: 'medium',
      honest_risk: 'Most expensive click of any catalog here — only justified by a high deal size.',
    },
  ],
};

const SLATE_LEAK_PRIORITY: Record<NonNullable<MarketingBrief['primary_leak']>, string[]> = {
  awareness: ['local_search_ads', 'google_search_ads', 'meta_prospecting', 'google_shopping_search', 'search_ads_intent'],
  retention: [],
  conversion: [],
  positioning: [],
  pricing: [],
};

/** Generates the paid/offline channel slate for a client's brief.
 *  Deterministic and rule-based on purpose — the four validation cases
 *  in the build prompt (taco truck, small-town newspaper, emergency
 *  plumber, peptide ecommerce) are pass/fail requirements, not something
 *  an LLM call should be trusted to get right run to run. */
export function generateSlate(brief: MarketingBrief, businessModel: BusinessModel, clientName: string): PlayDraft[] {
  const catalog = CATALOGS[businessModel](brief, clientName || 'this business');
  return applyLeakPriority(catalog, brief.primary_leak, SLATE_LEAK_PRIORITY);
}

// The fixed, universal 11 free plays (Screen 4). "Fixed" means the
// catalog itself never changes; which ones actually apply to a given
// client is filtered by business model below — a peptide ecommerce
// company still never sees a Google Business Profile item, same
// failure condition as the paid slate, just enforced here instead.
interface FreePlayDef {
  key: string;
  title: string;
  rationale: string;
  cost_estimate: string;
  speed_to_signal: string;
  effort_level: EffortLevel;
  honest_risk: string;
  appliesTo: BusinessModel[];
}

const LOCAL = ['local_retail', 'local_service'] as BusinessModel[];
const ALL: BusinessModel[] = ['local_retail', 'local_service', 'ecommerce', 'online_service', 'wholesale'];

const FREE_PLAYS_CATALOG: FreePlayDef[] = [
  {
    key: 'gbp_build_out',
    title: 'Google Business Profile — full build-out',
    rationale: 'A physical or service-area business is searched for by name and by "near me" — an incomplete or unclaimed profile is the single most common free leak.',
    cost_estimate: '$0',
    speed_to_signal: 'Calls/direction requests move within 1-2 weeks of a complete profile',
    effort_level: 'low',
    honest_risk: 'No signal at all for a business with no local or service-area presence — irrelevant there, not just low-priority.',
    appliesTo: LOCAL,
  },
  {
    key: 'missed_call_audit',
    title: 'Missed-call audit',
    rationale: 'A phone-booked business loses booked revenue to every unanswered call — often the single highest-leverage free fix available.',
    cost_estimate: '$0',
    speed_to_signal: 'Immediate once a text-back or call-routing fix is in place',
    effort_level: 'low',
    honest_risk: 'Only matters if real call volume already exists — check the numbers first.',
    appliesTo: LOCAL,
  },
  {
    key: 'past_customer_reactivation',
    title: 'Past-customer reactivation',
    rationale: 'Cheapest revenue available is a past customer with a real, recurring need — no acquisition cost, just an outreach.',
    cost_estimate: '$0',
    speed_to_signal: '1-2 weeks after the first outreach batch',
    effort_level: 'medium',
    honest_risk: 'Drops entirely if there\'s no real past-customer list to work from — verify one exists before ranking this high.',
    appliesTo: ALL,
  },
  {
    key: 'review_engine',
    title: 'Review engine — ask every satisfied customer',
    rationale: 'Review count and recency are both a ranking factor and a trust signal, whether the business is found on a map or a product page.',
    cost_estimate: '$0',
    speed_to_signal: '2-4 weeks to see volume move',
    effort_level: 'low',
    honest_risk: "Won't move revenue alone — it compounds with other plays, not instead of them.",
    appliesTo: ALL,
  },
  {
    key: 'directory_consistency',
    title: 'Directory & local search consistency (NAP)',
    rationale: 'Mismatched name/address/phone across Yelp, Apple Maps, and directories actively hurts local search ranking — a five-minute fix per listing.',
    cost_estimate: '$0',
    speed_to_signal: '2-6 weeks (search-index dependent)',
    effort_level: 'low',
    honest_risk: 'Slow to show up in ranking; not a launch-week win. Irrelevant with no local listings to clean up.',
    appliesTo: LOCAL,
  },
  {
    key: 'referral_ask',
    title: 'Structured referral ask',
    rationale: 'A direct, specific ask converts far better than a passive "let us know if you know anyone" — works for any business with customers who trust it.',
    cost_estimate: '$0',
    speed_to_signal: '1-3 weeks after the first ask',
    effort_level: 'low',
    honest_risk: 'Needs a genuinely happy customer base to work from.',
    appliesTo: ALL,
  },
  {
    key: 'employer_org_partnerships',
    title: 'Employer & organization partnerships',
    rationale: 'A direct relationship with a nearby employer, org, or buyer group bypasses the awareness funnel entirely — one relationship can be worth dozens of individual acquisitions.',
    cost_estimate: 'Time only — a call sheet and a sample/pitch',
    speed_to_signal: 'First booking often within days of the first pitch',
    effort_level: 'medium',
    honest_risk: 'Depends entirely on doing the outreach — it does not run itself.',
    appliesTo: ['local_retail', 'local_service', 'wholesale'],
  },
  {
    key: 'cross_promotion',
    title: 'Cross-promotion with an adjacent business',
    rationale: 'Sharing an audience with a complementary (non-competing) business is free reach to people already close to the target customer.',
    cost_estimate: '$0',
    speed_to_signal: '1-3 weeks',
    effort_level: 'medium',
    honest_risk: 'Only as good as the partner\'s actual audience overlap — a mismatched partner wastes the effort.',
    appliesTo: ['local_retail', 'local_service', 'ecommerce', 'online_service'],
  },
  {
    key: 'organic_posting',
    title: 'Organic social posting',
    rationale: 'Consistent, unpaid posting keeps the business visible between purchases and gives paid plays real creative to test later.',
    cost_estimate: '$0 (time)',
    speed_to_signal: '4-8 weeks — organic reach is slow and inconsistent',
    effort_level: 'medium',
    honest_risk: 'Slowest, least reliable signal in this catalog — don\'t use it as the only test of anything.',
    appliesTo: ['local_retail', 'local_service', 'ecommerce', 'online_service'],
  },
  {
    key: 'local_press',
    title: 'Local press outreach',
    rationale: 'A genuine local angle (new opening, milestone, community tie-in) is real, free reach a local outlet is often looking to fill space with.',
    cost_estimate: '$0 (time)',
    speed_to_signal: '2-6 weeks — press has its own schedule',
    effort_level: 'medium',
    honest_risk: 'No guarantee of pickup; needs a genuinely newsworthy angle, not just "we exist."',
    appliesTo: LOCAL,
  },
  {
    key: 'community_boards',
    title: 'Community boards & local groups',
    rationale: 'Physical and online community bulletin boards reach a hyper-local audience already primed to support local business.',
    cost_estimate: '$0',
    speed_to_signal: '1-2 weeks',
    effort_level: 'low',
    honest_risk: 'Low reach per post — needs to be one part of the checklist, not the whole plan.',
    appliesTo: LOCAL,
  },
];

const CHECKLIST_LEAK_PRIORITY: Record<NonNullable<MarketingBrief['primary_leak']>, string[]> = {
  retention: ['past_customer_reactivation', 'referral_ask'],
  awareness: ['gbp_build_out', 'organic_posting', 'local_press', 'community_boards'],
  conversion: ['missed_call_audit', 'review_engine'],
  positioning: [],
  pricing: [],
};

/** Generates the free-plays checklist for a client's brief — the
 *  universal 11-item catalog above, filtered to whichever items actually
 *  apply to this business model (an ecommerce brand never gets GBP,
 *  local press, or community boards; a plumber never gets cross-
 *  promotion or organic posting ranked as free-play priorities the same
 *  way a retail storefront would). A real signal that repeat customers
 *  exist — the brief actually has a repeat_customer_pct — always
 *  promotes reactivation to the top, mirroring the build prompt's own
 *  example ("reactivation jumps to #1 for a client with 500 past
 *  customers"). */
export function generateFreePlaysChecklist(brief: MarketingBrief, businessModel: BusinessModel, clientName: string): PlayDraft[] {
  const applicable = FREE_PLAYS_CATALOG.filter((p) => p.appliesTo.includes(businessModel));
  const drafts: PlayDraft[] = applicable.map((p) => ({
    play_key: p.key,
    title: p.title,
    category: 'free',
    rationale: `${p.rationale} ${clientName ? `Applies to ${clientName} as a ${BUSINESS_MODELS.find((b) => b.key === businessModel)?.label.toLowerCase()} business.` : ''}`.trim(),
    cost_estimate: p.cost_estimate,
    speed_to_signal: p.speed_to_signal,
    effort_level: p.effort_level,
    honest_risk: p.honest_risk,
  }));
  const ranked = applyLeakPriority(drafts, brief.primary_leak, CHECKLIST_LEAK_PRIORITY);
  if (brief.repeat_customer_pct === null || brief.repeat_customer_pct === undefined) return ranked;
  const idx = ranked.findIndex((p) => p.play_key === 'past_customer_reactivation');
  if (idx <= 0) return ranked;
  const copy = [...ranked];
  const [reactivation] = copy.splice(idx, 1);
  copy.unshift(reactivation);
  return copy;
}
