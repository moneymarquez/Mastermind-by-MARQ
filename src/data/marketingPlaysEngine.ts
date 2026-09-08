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

// Play catalogs, one per business model. Order here is the default rank
// — a plumber's paid slate is Google Search only (the honest_risk on the
// missing channels explains why they're absent rather than silently
// leaving them out), and no catalog below ever contains a Google
// Business Profile play unless the business has a real local/service-
// area presence — local_retail and local_service only. Ecommerce,
// online_service, and wholesale never get one, by construction.
const CATALOGS: Record<BusinessModel, (brief: MarketingBrief, clientName: string) => PlayDraft[]> = {
  local_retail: (brief, name) => [
    {
      play_key: 'gbp_build_out',
      title: 'Google Business Profile — full build-out',
      category: 'free',
      rationale: `${name} has a physical location people search for by name and by "near me" — an incomplete or unclaimed profile is the single most common free leak for a retail storefront. ${briefFacts(brief, ['revenue_sources'])}`,
      cost_estimate: '$0',
      speed_to_signal: 'Calls/direction requests move within 1-2 weeks of a complete profile',
      effort_level: 'low',
      honest_risk: 'Free plays are gated ahead of this one, per the build order — do those first.',
    },
    {
      play_key: 'review_engine',
      title: 'Review engine — ask every satisfied customer',
      category: 'free',
      rationale: `Review count and recency are a ranking factor and a trust signal for a walk-up business. ${briefFacts(brief, ['repeat_customer_pct'])}`,
      cost_estimate: '$0',
      speed_to_signal: '2-4 weeks to see volume move',
      effort_level: 'low',
      honest_risk: "Won't move revenue alone — it compounds with the profile and local search plays, not instead of them.",
    },
    {
      play_key: 'directory_consistency',
      title: 'Directory & local search consistency (NAP)',
      category: 'free',
      rationale: 'Mismatched name/address/phone across Yelp, Apple Maps, and directories actively hurts local search ranking — a five-minute fix per listing.',
      cost_estimate: '$0',
      speed_to_signal: '2-6 weeks (search-index dependent)',
      effort_level: 'low',
      honest_risk: 'Slow to show up in ranking; not a launch-week win.',
    },
    {
      play_key: 'employer_catering_partnerships',
      title: 'Employer & organization catering partnerships',
      category: 'offline',
      rationale: `A direct, high-ticket relationship with nearby employers/orgs bypasses the awareness funnel entirely. ${briefFacts(brief, ['avg_transaction_value'])}`,
      cost_estimate: 'Time only — a call sheet and a sample',
      speed_to_signal: 'First booking often within days of the first pitch',
      effort_level: 'medium',
      honest_risk: 'Depends entirely on doing the outreach — it does not run itself.',
    },
    {
      play_key: 'local_search_ads',
      title: 'Local Search ads (Google)',
      category: 'paid',
      rationale: 'Once the free profile and reviews are in place, paid local search ads amplify the same "near me" intent that\'s already converting for free.',
      cost_estimate: '$15-25/day to reach a readable signal',
      speed_to_signal: 'Clicks same-day; a real read in 1-2 weeks',
      effort_level: 'medium',
      honest_risk: 'Wasted spend if the free plays above aren\'t done first — the ad sends people to a thin profile.',
    },
  ],

  local_service: (brief, name) => [
    {
      play_key: 'gbp_build_out',
      title: 'Google Business Profile — full build-out',
      category: 'free',
      rationale: `${name} is found at the moment of need — a complete service-area profile is what shows up for that search.`,
      cost_estimate: '$0',
      speed_to_signal: '1-2 weeks',
      effort_level: 'low',
      honest_risk: 'Gated ahead of paid spend, per the build order.',
    },
    {
      play_key: 'missed_call_audit',
      title: 'Missed-call audit',
      category: 'free',
      rationale: `An emergency/urgent-need service loses booked revenue to every unanswered call. ${briefFacts(brief, ['avg_transaction_value'])}`,
      cost_estimate: '$0',
      speed_to_signal: 'Immediate once a text-back or call-routing fix is in place',
      effort_level: 'low',
      honest_risk: 'Only matters if call volume already exists — check the numbers first.',
    },
    {
      play_key: 'past_customer_reactivation',
      title: 'Past-customer reactivation',
      category: 'free',
      rationale: `Cheapest revenue is a past customer with a real, recurring need. ${briefFacts(brief, ['repeat_customer_pct'])}`,
      cost_estimate: '$0',
      speed_to_signal: '1-2 weeks after the first outreach batch',
      effort_level: 'medium',
      honest_risk: 'Drops entirely if there\'s no real past-customer list to work — verify one exists before ranking this high.',
    },
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
      play_key: 'seo_content',
      title: 'SEO content — the pages people are already searching for',
      category: 'free',
      rationale: `${name} has no local storefront, so the free-play lever is organic search and content, not a physical profile. ${briefFacts(brief, ['revenue_sources'])}`,
      cost_estimate: '$0 (time)',
      speed_to_signal: '4-8 weeks — SEO is the slowest free play in any catalog',
      effort_level: 'medium',
      honest_risk: 'Slowest signal of any play here — don\'t use it as the only test.',
    },
    {
      play_key: 'email_list_reactivation',
      title: 'Email list — reactivate past buyers',
      category: 'free',
      rationale: `An existing customer/email list is the cheapest repeat-revenue lever an ecommerce brand has. ${briefFacts(brief, ['repeat_customer_pct'])}`,
      cost_estimate: '$0-20/mo (ESP)',
      speed_to_signal: 'Days',
      effort_level: 'low',
      honest_risk: 'Only viable if a real list exists — skip if it doesn\'t.',
    },
    {
      play_key: 'meta_prospecting',
      title: 'Meta prospecting ads',
      category: 'paid',
      rationale: 'Meta\'s targeting and catalog ads are built for exactly this shape of business — product-led, no local presence, national/online audience.',
      cost_estimate: '$300-500 total to reach the ~50 conversions Meta needs to optimize',
      speed_to_signal: '1-2 weeks once spend starts',
      effort_level: 'medium',
      honest_risk: 'Needs a converting product/landing page and real creative — an ad pointed at a weak page burns the budget finding that out.',
    },
    {
      play_key: 'google_shopping_search',
      title: 'Google Shopping / Search',
      category: 'paid',
      rationale: 'Captures people already searching for the product by name or category — high-intent traffic that a purely local channel can\'t reach for an online-only brand.',
      cost_estimate: '$15-30/day to start',
      speed_to_signal: '1-2 weeks',
      effort_level: 'medium',
      honest_risk: 'Competitive on price-comparison terms; margin needs to support the click cost.',
    },
  ],

  online_service: (brief, name) => [
    {
      play_key: 'content_seo',
      title: 'Content & SEO around the problem it solves',
      category: 'free',
      rationale: `${name} sells expertise, not a product on a shelf — content that answers the exact question a prospect is searching is the free-play equivalent of a storefront.`,
      cost_estimate: '$0 (time)',
      speed_to_signal: '4-8 weeks',
      effort_level: 'medium',
      honest_risk: 'Slow; needs real, specific content, not generic posts.',
    },
    {
      play_key: 'referral_ask',
      title: 'Structured referral ask',
      category: 'free',
      rationale: `A service sold on trust travels well by referral. ${briefFacts(brief, ['repeat_customer_pct'])}`,
      cost_estimate: '$0',
      speed_to_signal: '1-3 weeks after the first ask',
      effort_level: 'low',
      honest_risk: 'Needs a genuinely happy client base to work from.',
    },
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

  wholesale: (brief, name) => [
    {
      play_key: 'trade_directory_listings',
      title: 'Trade & industry directory listings',
      category: 'free',
      rationale: `${name} sells to other businesses, who source vendors through trade directories and industry associations, not consumer search or maps.`,
      cost_estimate: '$0 (some directories charge a small annual fee)',
      speed_to_signal: '2-6 weeks',
      effort_level: 'low',
      honest_risk: 'Only reaches buyers who are already searching that channel.',
    },
    {
      play_key: 'buyer_referral_network',
      title: 'Existing-buyer referral network',
      category: 'free',
      rationale: `B2B buyers trust other buyers in their network more than any ad. ${briefFacts(brief, ['revenue_sources'])}`,
      cost_estimate: '$0',
      speed_to_signal: '2-4 weeks',
      effort_level: 'medium',
      honest_risk: 'Needs a genuinely satisfied existing account to start from.',
    },
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

/** Nudges whichever play most directly addresses the diagnosed leak to
 *  the top, without changing what's actually in the catalog — the
 *  branch is still business-model-first; this only re-ranks it. */
const LEAK_PRIORITY_KEY: Record<NonNullable<MarketingBrief['primary_leak']>, string[]> = {
  retention: ['past_customer_reactivation', 'email_list_reactivation', 'buyer_referral_network'],
  awareness: ['gbp_build_out', 'local_search_ads', 'meta_prospecting', 'google_shopping_search', 'content_seo'],
  conversion: ['missed_call_audit', 'review_engine'],
  positioning: [],
  pricing: [],
};

/** Generates the slate for a client's brief. Deterministic and rule-
 *  based on purpose — the four validation cases in the build prompt
 *  (taco truck, small-town newspaper, emergency plumber, peptide
 *  ecommerce) are pass/fail requirements, not something an LLM call
 *  should be trusted to get right run to run. */
export function generateSlate(brief: MarketingBrief, businessModel: BusinessModel, clientName: string): PlayDraft[] {
  const catalog = CATALOGS[businessModel](brief, clientName || 'this business');
  const priority = brief.primary_leak ? LEAK_PRIORITY_KEY[brief.primary_leak] : [];
  if (priority.length === 0) return catalog;
  return [...catalog].sort((a, b) => {
    const ai = priority.indexOf(a.play_key);
    const bi = priority.indexOf(b.play_key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
