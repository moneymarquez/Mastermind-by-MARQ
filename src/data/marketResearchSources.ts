export interface ResearchSource {
  key: string;
  title: string;
  link: string;
  lookFor: string;
  whyItMatters: string;
}

// The fixed core set — every client gets these five regardless of
// industry, per the build prompt. Never changes based on business model
// or industry; only the swap-in set below does.
export const CORE_SOURCES: ResearchSource[] = [
  {
    key: 'census_quickfacts',
    title: 'Census QuickFacts',
    link: 'https://www.census.gov/quickfacts',
    lookFor: "The city's median household income, population, and median age.",
    whyItMatters: "Benchmarks who actually lives there — the baseline every other number here gets compared against.",
  },
  {
    key: 'census_reporter',
    title: 'Census Reporter (tract-level)',
    link: 'https://censusreporter.org',
    lookFor: "The specific census tract around the client's address, not just the city-wide average.",
    whyItMatters: 'A single neighborhood can look nothing like its city\'s overall numbers — this is the finer-grained read.',
  },
  {
    key: 'state_data_center',
    title: 'Utah State Data Center (Gardner Policy Institute)',
    link: 'https://gardner.utah.edu/demographics/',
    lookFor: 'Population growth projections and recent migration trends for the area.',
    whyItMatters: "Captures growth the decennial Census can't — whether the area is filling up or emptying out right now.",
  },
  {
    key: 'google_trends',
    title: 'Google Trends',
    link: 'https://trends.google.com',
    lookFor: 'Search interest over time for the category — flat, seasonal, or growing.',
    whyItMatters: "Tells you if demand is even there before spending anything to capture it — a seasonal dip isn't a failing campaign.",
  },
  {
    key: 'meta_audience_estimates',
    title: 'Meta Ads Manager audience estimates',
    link: 'https://www.facebook.com/adsmanager',
    lookFor: 'The estimated audience size for the category + location, before creating a single ad.',
    whyItMatters: "Sanity-checks whether the audience is even big enough to spend against — a 900-person audience can't sustain a real budget.",
  },
];

/** Pre-written swap-in sets (2-3 sources) for ~10-12 known industries —
 *  the build prompt's own worked examples (plumber, food truck, salon,
 *  newspaper) plus enough common local-service/retail industries to
 *  round out the set. Keyed by canonical slug; matchIndustryKey below
 *  does the free-text -> slug matching. */
export const INDUSTRY_SOURCES: Record<string, ResearchSource[]> = {
  plumber: [
    {
      key: 'gbp_search_volume',
      title: '"[service] near me" search volume',
      link: 'https://trends.google.com',
      lookFor: 'Relative search volume for "emergency plumber near me" and similar in the service area.',
      whyItMatters: 'This is a bought-in-the-moment category — search volume IS the demand signal, more than any demographic.',
    },
    {
      key: 'review_platform_density',
      title: 'Review platform density (BBB, Angi-style sites)',
      link: 'https://www.bbb.org',
      lookFor: 'How many competitors are listed and reviewed in the immediate area.',
      whyItMatters: 'Home-service trust is built on reviews more than branding — this shows how crowded that trust competition already is.',
    },
    {
      key: 'building_permits',
      title: 'Local building permit filings',
      link: 'https://www.usa.gov/local-governments',
      lookFor: 'Recent renovation/new-construction permits in the service area.',
      whyItMatters: 'New construction and renovations create real plumbing demand — a leading indicator ahead of any ad spend.',
    },
  ],
  food_truck: [
    {
      key: 'food_truck_event_calendars',
      title: 'Local food-truck event & festival calendars',
      link: 'https://www.eventbrite.com',
      lookFor: 'Recurring events, farmers markets, and festivals that already draw food-truck crowds.',
      whyItMatters: 'This is where the actual foot traffic already is — often cheaper and faster than any ad.',
    },
    {
      key: 'local_food_hashtags',
      title: 'Local food hashtag search (Instagram/TikTok)',
      link: 'https://www.instagram.com/explore/tags/',
      lookFor: 'What\'s already getting attention under local food hashtags — cuisines, price points, presentation styles.',
      whyItMatters: "Food trucks are discovered visually and by word of mouth — this shows what's already resonating locally.",
    },
    {
      key: 'food_truck_permits',
      title: 'City food-truck permit list',
      link: 'https://www.usa.gov/local-governments',
      lookFor: 'How many other trucks are permitted to operate in the same area.',
      whyItMatters: 'Direct read on competitive density in a category with real geographic limits.',
    },
  ],
  salon: [
    {
      key: 'instagram_location_tags',
      title: 'Instagram location tags for the neighborhood',
      link: 'https://www.instagram.com/explore/',
      lookFor: 'What local salons are actually posting and how much engagement it gets.',
      whyItMatters: 'Salons are a highly visual, highly local-discovery category — this is closer to real demand signal than a demographic table.',
    },
    {
      key: 'yelp_category_density',
      title: 'Yelp category density for "hair salon"',
      link: 'https://www.yelp.com',
      lookFor: 'How many salons are listed and their review counts in the immediate area.',
      whyItMatters: 'Shows how saturated the category already is before spending to enter it.',
    },
  ],
  newspaper: [
    {
      key: 'chamber_directory',
      title: 'Chamber of commerce member directory',
      link: 'https://www.uschamber.com/co/chambers',
      lookFor: 'Who the actual local business base is — the pool of potential advertisers.',
      whyItMatters: "A local paper's real customer is the advertiser, not the reader — this is that market.",
    },
    {
      key: 'business_license_registry',
      title: 'Local business license/permit registry',
      link: 'https://www.usa.gov/local-governments',
      lookFor: 'Recently registered new businesses in the coverage area.',
      whyItMatters: 'New businesses are the freshest potential advertisers — nobody has pitched them yet.',
    },
    {
      key: 'competing_media_rates',
      title: 'Competing local media rate cards',
      link: 'https://www.google.com/search?q=local+advertising+rate+card',
      lookFor: 'What other local outlets (radio, other papers, community boards) charge for comparable placement.',
      whyItMatters: 'Sets a real price anchor for the pitch instead of guessing what advertisers will pay.',
    },
  ],
  restaurant: [
    {
      key: 'restaurant_review_density',
      title: 'Yelp/Google review density for the category',
      link: 'https://www.yelp.com',
      lookFor: 'Review counts and ratings for comparable restaurants nearby.',
      whyItMatters: 'Restaurant discovery runs almost entirely on reviews and maps — this is the real competitive read.',
    },
    {
      key: 'delivery_platform_presence',
      title: 'Delivery platform category browse (DoorDash/UberEats)',
      link: 'https://www.doordash.com',
      lookFor: 'How many comparable restaurants are already listed and how they\'re positioned.',
      whyItMatters: 'A growing share of restaurant discovery happens inside delivery apps, not search.',
    },
  ],
  retail_boutique: [
    {
      key: 'instagram_shopping_tags',
      title: 'Instagram Shopping tags in the category',
      link: 'https://www.instagram.com/explore/',
      lookFor: 'What comparable boutiques are posting and selling, and the engagement it gets.',
      whyItMatters: 'Boutique retail is discovered visually far more than through search.',
    },
    {
      key: 'foot_traffic_area',
      title: 'Local foot-traffic / walkability data for the block',
      link: 'https://www.walkscore.com',
      lookFor: "The area's walk score and general foot-traffic pattern.",
      whyItMatters: 'A storefront\'s real audience is often just who walks by — this sizes that.',
    },
  ],
  gym: [
    {
      key: 'gym_density_maps',
      title: 'Gym/fitness studio density on Google Maps',
      link: 'https://www.google.com/maps',
      lookFor: 'How many comparable gyms or studios exist within a real drive-time radius.',
      whyItMatters: 'Fitness is a drive-time-radius business — density within that radius is the real competitive set.',
    },
    {
      key: 'fitness_trend_search',
      title: 'Google Trends for the specific fitness format',
      link: 'https://trends.google.com',
      lookFor: "Whether the specific format (e.g. \"pilates,\" \"crossfit\") is trending up or down locally.",
      whyItMatters: 'Fitness fads move fast — this tells you if the format itself still has momentum.',
    },
  ],
  auto_repair: [
    {
      key: 'auto_repair_reviews',
      title: 'Review platform density for auto repair',
      link: 'https://www.google.com/maps',
      lookFor: 'Review counts and common complaints for comparable shops nearby.',
      whyItMatters: 'Trust is the entire sale in auto repair — this shows the trust bar competitors have already set.',
    },
    {
      key: 'vehicle_age_data',
      title: 'Average vehicle age for the region (state DMV/insurance data)',
      link: 'https://www.google.com/search?q=average+vehicle+age+by+state',
      lookFor: "The area's average vehicle age — older fleets need more repair work.",
      whyItMatters: 'A region with older cars on average is a structurally better market for repair, not just marketing.',
    },
  ],
  dentist: [
    {
      key: 'insurance_network_data',
      title: 'Common dental insurance networks in the area',
      link: 'https://www.google.com/search?q=dental+insurance+networks+by+area',
      lookFor: 'Which insurance networks are most common locally.',
      whyItMatters: "Being in-network for the area's dominant plan is often a bigger lever than any ad creative.",
    },
    {
      key: 'practice_density',
      title: 'Dental practice density on Google Maps',
      link: 'https://www.google.com/maps',
      lookFor: 'How many practices are within a real drive-time radius, and their review counts.',
      whyItMatters: 'Shows exactly how crowded the local market already is before spending to enter it.',
    },
  ],
  real_estate: [
    {
      key: 'listing_inventory',
      title: 'Local listing inventory (Zillow/Redfin market data)',
      link: 'https://www.redfin.com/news/data-center/',
      lookFor: "Months of inventory and median days-on-market for the area.",
      whyItMatters: 'A buyer\'s vs. seller\'s market changes what the whole offer and message should even be.',
    },
    {
      key: 'agent_density',
      title: 'Local agent density (brokerage websites)',
      link: 'https://www.google.com/search?q=real+estate+agents+near+me',
      lookFor: 'How many agents actively work the same area.',
      whyItMatters: 'Real estate is a referral- and reputation-heavy category — this sizes the actual competition.',
    },
  ],
  landscaping: [
    {
      key: 'seasonal_search_pattern',
      title: 'Google Trends seasonal pattern for lawn/landscaping',
      link: 'https://trends.google.com',
      lookFor: 'The specific months demand spikes and drops in this climate.',
      whyItMatters: "Landscaping is brutally seasonal — spending flat all year wastes budget in the dead months.",
    },
    {
      key: 'hoa_density',
      title: 'HOA-governed neighborhood density nearby',
      link: 'https://www.google.com/search?q=hoa+communities+near+me',
      lookFor: 'How many HOA communities (often a maintenance-contract source) are in the area.',
      whyItMatters: 'HOA contracts are a completely different, more stable sales motion than one-off residential jobs.',
    },
  ],
  daycare: [
    {
      key: 'birth_rate_data',
      title: 'Local birth rate / young-family population (Census)',
      link: 'https://www.census.gov/quickfacts',
      lookFor: 'The share of the population under 5 and household counts with young children.',
      whyItMatters: 'This is the actual addressable market size — not the general population figure.',
    },
    {
      key: 'waitlist_signal',
      title: 'Competing daycare waitlist/capacity signals (Google reviews, local parent forums)',
      link: 'https://www.google.com/search?q=daycare+waitlist',
      lookFor: 'Whether nearby daycares mention waitlists or being at capacity.',
      whyItMatters: "A market with real waitlists elsewhere is a demand signal stronger than any survey.",
    },
  ],
};

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  plumber: ['plumb'],
  food_truck: ['food truck', 'taco truck', 'food cart'],
  salon: ['salon', 'hair', 'barber', 'nail'],
  newspaper: ['newspaper', 'paper', 'gazette', 'press'],
  restaurant: ['restaurant', 'cafe', 'diner', 'eatery', 'pizzeria'],
  retail_boutique: ['boutique', 'retail', 'clothing store', 'shop'],
  gym: ['gym', 'fitness', 'crossfit', 'pilates', 'yoga studio'],
  auto_repair: ['auto repair', 'mechanic', 'auto shop', 'car repair'],
  dentist: ['dentist', 'dental'],
  real_estate: ['real estate', 'realtor', 'realty'],
  landscaping: ['landscap', 'lawn care', 'lawn service'],
  daycare: ['daycare', 'childcare', 'preschool'],
};

/** Matches free-text industry input to a pre-written swap set via simple
 *  keyword substring matching — not fuzzy/AI matching, since a wrong
 *  silent match (e.g. matching "landscaper" to "plumber") would be worse
 *  than falling through to the honest "generate on the fly" path. */
export function matchIndustryKey(industry: string): string | null {
  const norm = industry.trim().toLowerCase();
  if (!norm) return null;
  for (const [key, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (keywords.some((kw) => norm.includes(kw))) return key;
  }
  return null;
}
