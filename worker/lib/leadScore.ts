// Lead scoring for the "Find leads" button. A straight port of the marqleads
// scraper's chains.py and fizzle.py, so a lead found from the app scores the
// same as one pushed from the terminal. Pure: no network, no env.
//
// The pitch is for businesses that WERE good and lost momentum, so a lead
// needs both a strong period (review count high for its category, decent
// rating) and falloff (newest review is old). Google only returns the 5
// newest reviews, so this is a single-scan estimate, not a measured trend.

export interface Band { floor: number; strong: number }

export const CATEGORY_BANDS: Record<string, Band> = {
  restaurant: { floor: 40, strong: 250 },
  cafe: { floor: 40, strong: 200 },
  'coffee shop': { floor: 40, strong: 200 },
  bar: { floor: 40, strong: 200 },
  gym: { floor: 35, strong: 150 },
  'yoga studio': { floor: 30, strong: 120 },
  'hair salon': { floor: 25, strong: 120 },
  barbershop: { floor: 25, strong: 120 },
  'nail salon': { floor: 25, strong: 120 },
  spa: { floor: 25, strong: 120 },
  boutique: { floor: 20, strong: 90 },
  'pet grooming': { floor: 20, strong: 90 },
  'dry cleaner': { floor: 20, strong: 80 },
  plumber: { floor: 15, strong: 80 },
  hvac: { floor: 15, strong: 80 },
  roofing: { floor: 15, strong: 70 },
  electrician: { floor: 15, strong: 80 },
  landscaping: { floor: 15, strong: 70 },
  'house cleaning': { floor: 15, strong: 70 },
  handyman: { floor: 12, strong: 60 },
  contractor: { floor: 12, strong: 60 },
  'auto repair': { floor: 30, strong: 150 },
  dentist: { floor: 25, strong: 150 },
  chiropractor: { floor: 25, strong: 130 },
  'tax preparation': { floor: 15, strong: 70 },
};
export const DEFAULT_BAND: Band = { floor: 25, strong: 120 };

export const MIN_RATING = 3.8;
export const STALE_AFTER_DAYS = 150;
export const VERY_STALE_AFTER_DAYS = 365;

export function bandFor(searchCategory: string, primaryType = ''): Band {
  for (const key of [searchCategory, primaryType]) {
    const k = (key || '').toLowerCase().replace(/_/g, ' ').trim();
    if (!k) continue;
    if (CATEGORY_BANDS[k]) return CATEGORY_BANDS[k];
    for (const [name, band] of Object.entries(CATEGORY_BANDS)) {
      if (name.includes(k) || k.includes(name)) return band;
    }
  }
  return DEFAULT_BAND;
}

const KNOWN_CHAINS = [
  'subway', 'mcdonald', 'burger king', 'wendy', 'taco bell', 'kfc', 'popeyes',
  'chick-fil-a', 'chipotle', 'panera', 'starbucks', 'dunkin', 'dutch bros',
  'jimmy john', 'jersey mike', 'firehouse subs', 'arby', 'sonic drive',
  'little caesars', 'domino', 'pizza hut', 'papa john', 'papa murphy',
  'panda express', 'in-n-out', 'five guys', 'culver', 'del taco', "carl's jr",
  'wingstop', 'buffalo wild wings', 'applebee', "chili's", 'olive garden',
  'red lobster', 'outback', 'texas roadhouse', 'denny', 'ihop', 'village inn',
  'cafe rio', 'costa vida', 'swig', 'sodalicious', 'crumbl', 'jamba',
  'smoothie king', 'baskin-robbins', 'cold stone', 'dairy queen',
  'great clips', 'supercuts', 'sport clips', 'fantastic sams', 'cost cutters',
  'massage envy', 'european wax', 'drybar', 'regis salon',
  'anytime fitness', 'planet fitness', "gold's gym", '24 hour fitness',
  'orangetheory', 'f45', 'club pilates', 'vasa fitness', 'eos fitness',
  'jiffy lube', 'valvoline', 'midas', 'meineke', 'firestone', 'big o tires',
  'les schwab', 'discount tire', 'aamco', 'maaco',
  'servpro', 'servicemaster', 'stanley steemer', 'chem-dry', 'molly maid',
  'merry maids', 'the maids', 'mr. rooter', 'roto-rooter', 'benjamin franklin',
  'one hour heating', 'aire serv', 'mr. handyman', 'handyman connection',
  'lawn doctor', 'trugreen', 'weed man',
  '7-eleven', 'circle k', 'maverik', 'chevron', 'sinclair', "smith's",
  'harmons', 'walmart', 'target', 'walgreens', 'cvs', 'rite aid',
  'gnc', 'vitamin shoppe', 'verizon', 't-mobile', 'at&t store',
  'h&r block', 'jackson hewitt', 'liberty tax',
  'aspen dental', 'smile brands', 'western dental',
  'the joint chiropractic', 'petsmart', 'petco', 'pet supplies plus',
];

export function normName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function knownChain(name: string): string {
  const n = normName(name);
  for (const brand of KNOWN_CHAINS) {
    const b = normName(brand);
    if (b && (n.startsWith(b) || ` ${n} `.includes(` ${b} `))) return brand;
  }
  return '';
}

/** Names seen 3+ times in one search = a multi-location operator. */
export function localChains(names: string[], threshold = 3): Set<string> {
  const counts = new Map<string, number>();
  for (const n of names) { const k = normName(n); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return new Set([...counts].filter(([, c]) => c >= threshold).map(([k]) => k));
}

export interface ScoreInput {
  name: string;
  searchCategory: string;
  primaryType?: string;
  status?: string;
  rating?: number | null;
  reviewCount: number;
  phone?: string;
  website?: string;
  /** ISO dates of the (up to 5) newest reviews, any order. */
  reviewDates?: string[];
}

export interface ScoreResult {
  score: number;
  tier: 'A' | 'B' | 'C' | 'X';
  daysSinceLastReview: number | null;
  reasons: string[];
  disqualified: string;
}

/** The cheap checks that need only search results — run before paying for Details. */
export function preDisqualify(b: Pick<ScoreInput, 'status' | 'reviewCount' | 'rating' | 'searchCategory' | 'primaryType'>): string {
  const band = bandFor(b.searchCategory, b.primaryType);
  if (b.status && b.status !== 'OPERATIONAL') return `status ${b.status}`;
  if (b.reviewCount < band.floor) return `${b.reviewCount} reviews, below the ${band.floor} floor`;
  if (b.rating != null && b.rating < MIN_RATING) return `rating ${b.rating}`;
  return '';
}

export function scoreLead(b: ScoreInput, now: Date = new Date()): ScoreResult {
  const x = (why: string): ScoreResult => ({ score: 0, tier: 'X', daysSinceLastReview: null, reasons: [], disqualified: why });
  const pre = preDisqualify(b);
  if (pre) return x(pre);
  if (!b.phone) return x('no phone number');

  const band = bandFor(b.searchCategory, b.primaryType);
  const cat = b.searchCategory || b.primaryType || 'business';
  const reasons: string[] = [];
  let s = 0;

  const ratio = band.strong ? b.reviewCount / band.strong : 0;
  if (ratio >= 1) { s += 35; reasons.push(`${b.reviewCount} reviews — top of range for a ${cat}`); }
  else if (ratio >= 0.6) { s += 28; reasons.push(`${b.reviewCount} reviews — solid for a ${cat}`); }
  else if (ratio >= 0.35) { s += 20; reasons.push(`${b.reviewCount} reviews — established`); }
  else { s += 10; reasons.push(`${b.reviewCount} reviews — modest but qualifying`); }

  if (b.rating != null && b.rating >= 4.5) { s += 5; reasons.push(`rating ${b.rating} — product is good`); }

  let days: number | null = null;
  const dates = (b.reviewDates ?? []).map((d) => Date.parse(d)).filter((t) => !Number.isNaN(t)).sort((a, z) => z - a);
  if (dates.length) {
    days = Math.floor((now.getTime() - dates[0]) / 86_400_000);
    if (days >= VERY_STALE_AFTER_DAYS) { s += 45; reasons.push(`last review ${days} days ago — gone quiet`); }
    else if (days >= STALE_AFTER_DAYS) { s += 30; reasons.push(`last review ${days} days ago — slowing`); }
    else if (days >= 60) { s += 10; reasons.push(`last review ${days} days ago`); }
    else reasons.push(`last review ${days} days ago — still active (weak fit)`);
  } else {
    s += 15; reasons.push('review dates unavailable');
  }

  if (!b.website) { s += 8; reasons.push('no website listed'); }

  s = Math.min(s, 100);
  const tier = s >= 70 ? 'A' : s >= 50 ? 'B' : 'C';
  return { score: s, tier, daysSinceLastReview: days, reasons, disqualified: '' };
}

/** "123 Main St, Sandy, UT 84070, USA" → { city: "Sandy", state: "UT" } */
export function cityState(address: string): { city: string; state: string } {
  const parts = (address || '').split(',').map((p) => p.trim());
  if (parts.length < 3) return { city: '', state: '' };
  const city = parts[parts.length - 3];
  const state = (parts[parts.length - 2].match(/^([A-Z]{2})\b/) ?? [])[1] ?? '';
  return { city, state };
}

/** Extra phrasings per industry: Google caps one search at 60 results, so
 *  reaching 100 in a city takes a few ways of asking. */
const SYNONYMS: Record<string, string[]> = {
  hvac: ['heating and air conditioning', 'furnace repair'], plumber: ['plumbing', 'drain cleaning'], electrician: ['electrical contractor'],
  roofing: ['roofer', 'roof repair'], landscaping: ['landscaper', 'lawn care'], 'house cleaning': ['cleaning service', 'maid service'],
  handyman: ['home repair'], 'auto repair': ['mechanic', 'auto shop'], restaurant: ['family restaurant', 'diner'], 'hair salon': ['beauty salon'],
  barbershop: ['barber'], dentist: ['dental office'], chiropractor: ['chiropractic'], gym: ['fitness studio'], 'med spa': ['medical spa', 'aesthetics clinic'],
  'real estate agent': ['realtor'], 'law firm': ['attorney', 'lawyer'], 'food truck': ['food trucks'], 'pest control': ['exterminator'], 'auto detailing': ['car detailing'],
};
export function queryVariants(industry: string): string[] {
  const k = industry.trim().toLowerCase();
  return [industry.trim(), ...(SYNONYMS[k] ?? [])].slice(0, 3);
}

/** Only businesses whose address is in the city that was asked for. Pure. */
export function inCity(address: string, city: string, state: string): boolean {
  const cs = cityState(address);
  return cs.city.trim().toLowerCase() === city.trim().toLowerCase() && (!state || cs.state === state);
}

