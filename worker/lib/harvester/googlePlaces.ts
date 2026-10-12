import type { Adapter, HarvestJob } from './types';

// Places API (New), Text Search. Google bills by the fields requested, so only what the engines use is asked for.
// phone, website and rating are in the "Enterprise" tier; the test call asks for IDs only (the free tier).
// Prices are the published list prices per request (check Google Maps Platform pricing; they change).
export const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
export const PLACES_FIELDS = ['places.id', 'places.displayName', 'places.formattedAddress', 'places.websiteUri', 'places.nationalPhoneNumber', 'places.rating', 'places.userRatingCount', 'places.googleMapsUri', 'places.businessStatus', 'places.primaryType', 'places.types', 'nextPageToken'] as const;
export const PLACES_COST_PER_REQUEST = 0.035;
const PAGE = 20;

export interface PlaceRaw { id?: string; displayName?: { text?: string }; formattedAddress?: string; websiteUri?: string; nationalPhoneNumber?: string; rating?: number; userRatingCount?: number; googleMapsUri?: string; businessStatus?: string; primaryType?: string; types?: string[] }
/** One Places result as our row. The place_id is kept for good; the rest is re-fetched when needed. Pure. */
export function mapPlace(p: PlaceRaw): { key: string; data: Record<string, unknown> } | null {
  if (!p.id) return null;
  const addr = p.formattedAddress ?? '';
  const m = addr.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d{5}/);
  return { key: p.id, data: { place_id: p.id, name: p.displayName?.text ?? '', address: addr, city: m?.[1]?.trim() ?? null, state: m?.[2] ?? null, website: p.websiteUri ?? null, phone: p.nationalPhoneNumber ?? null, rating: p.rating ?? null, review_count: p.userRatingCount ?? null, maps_url: p.googleMapsUri ?? null, status: p.businessStatus ?? null, category: p.primaryType ?? null, types: p.types ?? [] } };
}
export const pagesFor = (limit: number) => Math.min(3, Math.max(1, Math.ceil(limit / PAGE)));

export const googlePlaces: Adapter = {
  id: 'googlePlaces',
  defaultCacheDays: 30,
  cacheKey: (j) => `q:${j.query.toLowerCase().trim()}|a:${(j.area ?? '').toLowerCase().trim()}|n:${j.limit ?? PAGE}`,
  estimate: (j) => pagesFor(j.limit ?? PAGE) * PLACES_COST_PER_REQUEST,
  async run(job: HarvestJob, ctx) {
    const key = ctx.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error('Google Places isn\'t connected. Add the key in Setup → Google Places.');
    const out: { key: string; data: Record<string, unknown> }[] = [];
    let token: string | undefined, calls = 0;
    const want = job.limit ?? PAGE;
    for (let i = 0; i < pagesFor(want); i++) {
      const res = await ctx.http(PLACES_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS.join(',') }, body: JSON.stringify({ textQuery: job.area ? `${job.query} in ${job.area}` : job.query, pageSize: PAGE, ...(token ? { pageToken: token } : {}) }) });
      calls++;
      const j = (await res.json().catch(() => ({}))) as { places?: PlaceRaw[]; nextPageToken?: string; error?: { message?: string; status?: string } };
      if (!res.ok) throw new Error(`Google Places ${res.status}: ${j.error?.message ?? j.error?.status ?? 'failed'}`);
      for (const p of j.places ?? []) { const m = mapPlace(p); if (m) out.push(m); }
      token = j.nextPageToken;
      if (!token || out.length >= want) break;
    }
    return { items: out.slice(0, want), calls, cost: calls * PLACES_COST_PER_REQUEST };
  },
};

/** Setup → Test: one IDs-only request, which is the free tier. */
export async function testPlacesKey(key: string, f: typeof fetch = fetch): Promise<{ ok: boolean; detail: string }> {
  const res = await f(PLACES_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' }, body: JSON.stringify({ textQuery: 'coffee shop Denver', pageSize: 1 }) });
  const j = (await res.json().catch(() => ({}))) as { places?: unknown[]; error?: { message?: string } };
  if (res.ok) return { ok: true, detail: `Google Places answered (${(j.places ?? []).length} result). The test asked for IDs only, which is free. A real search costs about $${PLACES_COST_PER_REQUEST} per 20 businesses.` };
  return { ok: false, detail: `Google Places ${res.status}: ${j.error?.message ?? 'refused'}${res.status === 403 ? ' Enable "Places API (New)" for this key in Google Cloud and make sure billing is on.' : ''}` };
}
