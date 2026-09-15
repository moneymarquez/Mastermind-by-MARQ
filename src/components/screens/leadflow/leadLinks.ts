import type { LeadflowLead } from '../../../data/useLeadflow';

/** Outbound lookup links for a lead.
 *
 *  These exist because the automated owner lookup (OpenCorporates, via the
 *  scraper's registry.py) currently returns nothing — every row comes back
 *  with a null confidence, so owner_name and registry_url are empty across
 *  the board. Until that source is authenticated and working, finding an
 *  owner is a manual hop, and the job here is to make that hop one tap
 *  instead of retyping a business name into three different sites.
 */

/** Google Maps. Prefers the scraper's own maps_url (built from place_id, so
 *  it resolves to the exact listing rather than a name guess). */
export function mapsUrl(lead: Pick<LeadflowLead, 'maps_url' | 'business_name' | 'address'>): string {
  if (lead.maps_url) return lead.maps_url;
  const q = [lead.business_name, lead.address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Street View at the storefront. Falls back to coordinates when the
 *  scraper didn't store a link. */
export function streetViewUrl(lead: Pick<LeadflowLead, 'streetview_url' | 'lat' | 'lng'>): string | null {
  if (lead.streetview_url) return lead.streetview_url;
  if (lead.lat == null || lead.lng == null) return null;
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lead.lat},${lead.lng}`;
}

/** The business's own site, normalised — scraped values often lack a scheme,
 *  and an href without one is treated as a relative path. */
export function websiteUrl(website: string | null): string | null {
  if (!website) return null;
  const w = website.trim();
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

/** Per-state business registry search. Utah is the only one wired up
 *  because it's the only state being scraped; the map is the extension
 *  point rather than a hardcoded URL buried in a component.
 *
 *  These are search landing pages, not deep links — none of these
 *  registries documents a stable query parameter for prefilling a name, so
 *  pretending to deep-link would produce buttons that land on a blank
 *  search. The business name is shown next to the link to paste instead. */
const REGISTRY_SEARCH: Record<string, string> = {
  UT: 'https://businessregistration.utah.gov/',
};

/** The lead's state code. The scraper's build_row never writes the `state`
 *  column — it's empty on every scraped row — but the address it does write
 *  ends "..., Sandy, UT 84070, USA", so parse it out rather than letting the
 *  registry link silently disappear for every lead. */
export function stateOf(lead: Pick<LeadflowLead, 'state' | 'address'>): string {
  const explicit = (lead.state || '').trim();
  if (explicit) return explicit.toUpperCase();
  const parts = (lead.address || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Second-from-last is the "UT 84070" segment when the country is present.
  for (const seg of [parts[parts.length - 2], parts[parts.length - 1]]) {
    const m = (seg || '').match(/^([A-Za-z]{2})\b/);
    if (m) return m[1].toUpperCase();
  }
  return '';
}

export function registryUrl(lead: Pick<LeadflowLead, 'registry_url' | 'state' | 'address'>): string | null {
  // OpenCorporates gives a direct record link when it finds a match — far
  // better than a search page, since it's already resolved to the company.
  if (lead.registry_url) return lead.registry_url;
  return REGISTRY_SEARCH[stateOf(lead)] ?? null;
}

/** TruePeopleSearch, prefilled with a person's name and the business's city.
 *
 *  A link rather than a scrape on purpose: the site runs bot protection, so
 *  scraping it would be brittle, would risk the droplet's IP, and runs
 *  against their terms. One tap costs nothing and never breaks.
 *
 *  NOTE: the query parameter names below are the commonly used ones but are
 *  NOT confirmed against the live site — if a lookup lands on an empty
 *  search, correcting them here fixes every link at once. */
export function peopleSearchUrl(name: string, lead: Pick<LeadflowLead, 'city' | 'state' | 'address'>): string | null {
  const n = name.trim();
  if (!n) return null;
  const where = [(lead.city || '').trim(), stateOf(lead)].filter(Boolean).join(' ');
  const params = new URLSearchParams({ name: n });
  if (where) params.set('citystatezip', where);
  return `https://www.truepeoplesearch.com/results?${params.toString()}`;
}

/** Whichever owner-ish name the scraper managed to find, in order of how
 *  much it's worth typing into a people search. A registered agent is last
 *  — it's often a lawyer or formation service, not the owner. */
export function bestOwnerGuess(lead: Pick<LeadflowLead, 'owner_name' | 'registry_legal_name' | 'registered_agent'>): string {
  return (lead.owner_name || '').trim()
    || (lead.registry_legal_name || '').trim()
    || (lead.registered_agent || '').trim();
}

/** "3 yrs" / "8 mo" / "24 d" — review recency is the core fizzle signal, and
 *  a raw day count buries the lede at the high end. */
export function staleLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days < 60) return `${days} d`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yrs`;
}
