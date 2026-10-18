// One-time import of Marq's terminal-scraper output (CSV or JSON) into the lead table, matched by place_id.
// Shared by the import screen (parsing and column mapping in the browser) and the Worker (final clean-up before insert).

export const IMPORT_FIELDS = [
  { key: 'place_id', label: 'Google place ID', required: true, hints: ['place_id', 'placeid', 'google_place_id', 'place id', 'id'] },
  { key: 'business_name', label: 'Business name', required: true, hints: ['business_name', 'name', 'title', 'business', 'company'] },
  { key: 'phone', label: 'Phone', hints: ['phone', 'phone_number', 'telephone', 'tel', 'national_phone_number'] },
  { key: 'website', label: 'Website', hints: ['website', 'site', 'url', 'web', 'website_uri', 'domain'] },
  { key: 'address', label: 'Address', hints: ['address', 'formatted_address', 'full_address', 'street'] },
  { key: 'city', label: 'City', hints: ['city', 'town', 'locality'] },
  { key: 'state', label: 'State', hints: ['state', 'region', 'province'] },
  { key: 'category', label: 'Category', hints: ['category', 'type', 'primary_type', 'industry'] },
  { key: 'rating', label: 'Rating', hints: ['rating', 'stars', 'avg_rating'] },
  { key: 'review_count', label: 'Review count', hints: ['review_count', 'reviews', 'user_ratings_total', 'rating_count', 'num_reviews'] },
  { key: 'owner_name', label: 'Owner name', hints: ['owner_name', 'owner', 'contact_name'] },
  { key: 'owner_email', label: 'Email', hints: ['email', 'owner_email', 'contact_email', 'e-mail'] },
  { key: 'maps_url', label: 'Google Maps link', hints: ['maps_url', 'google_maps_url', 'maps_link', 'map_url', 'google_maps_uri'] },
] as const;
export type ImportKey = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<ImportKey, string>>;
export type RawRow = Record<string, unknown>;

/** RFC-4180-ish CSV (quotes, escaped quotes, newlines in cells). Returns objects keyed by header. */
export function parseCsv(text: string): RawRow[] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = '', q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { cur.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; cur.push(cell); cell = ''; if (cur.some((x) => x.trim() !== '')) rows.push(cur); cur = []; }
    else cell += c;
  }
  if (cell !== '' || cur.length) { cur.push(cell); if (cur.some((x) => x.trim() !== '')) rows.push(cur); }
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}
/** JSON array, {results|data|leads|items: []}, or one object per line (NDJSON). */
export function parseJsonRows(text: string): RawRow[] {
  const t = text.trim();
  try {
    const j = JSON.parse(t) as unknown;
    if (Array.isArray(j)) return j.filter((x) => x && typeof x === 'object') as RawRow[];
    for (const k of ['results', 'data', 'leads', 'items', 'places', 'rows']) { const v = (j as Record<string, unknown>)?.[k]; if (Array.isArray(v)) return v as RawRow[]; }
    return [];
  } catch {
    return t.split(/\r?\n/).map((l) => { try { return JSON.parse(l) as RawRow; } catch { return null; } }).filter((x): x is RawRow => !!x && typeof x === 'object');
  }
}
export const parseAny = (name: string, text: string): RawRow[] => (/\.(json|ndjson|jsonl)$/i.test(name) || /^\s*[[{]/.test(text) ? parseJsonRows(text) : parseCsv(text));
export const columnsOf = (rows: RawRow[]): string[] => [...new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r)))];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
/** Best guess at which column feeds which field, exact name first, then known aliases. The user can change every one. */
export function guessMapping(columns: string[]): Mapping {
  const out: Mapping = {}; const used = new Set<string>();
  for (const f of IMPORT_FIELDS) {
    const hit = columns.find((c) => !used.has(c) && norm(c) === f.key) ?? f.hints.map((h) => columns.find((c) => !used.has(c) && norm(c) === norm(h))).find(Boolean);
    if (hit) { out[f.key] = hit; used.add(hit); }
  }
  return out;
}
const str = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? '' : String(v).trim(); return s || null; };
const numOf = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
export interface CleanLead { place_id: string; business_name: string; phone: string | null; website: string | null; address: string | null; city: string | null; state: string | null; category: string | null; rating: number | null; review_count: number | null; owner_name: string | null; owner_email: string | null; maps_url: string | null }
/** One row through the mapping. null when it has no place ID or no name (counted as skipped, never guessed). */
export function mapRow(row: RawRow, m: Mapping): CleanLead | null {
  const get = (k: ImportKey) => (m[k] ? row[m[k] as string] : undefined);
  const place_id = str(get('place_id')), business_name = str(get('business_name'));
  if (!place_id || !business_name) return null;
  const rating = numOf(get('rating')), reviews = numOf(get('review_count'));
  const email = str(get('owner_email'))?.toLowerCase() ?? null;
  const state = str(get('state'))?.toUpperCase().slice(0, 2) ?? null;
  return {
    place_id: place_id.slice(0, 200), business_name: business_name.slice(0, 200), phone: str(get('phone')), website: str(get('website')), address: str(get('address')), city: str(get('city')), state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    category: str(get('category')), rating: rating != null && rating >= 0 && rating <= 5 ? rating : null, review_count: reviews != null && reviews >= 0 ? Math.round(reviews) : null, owner_name: str(get('owner_name')),
    owner_email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null, maps_url: str(get('maps_url')),
  };
}
/** Whole file through the mapping, deduped by place_id within the file. */
export function mapRows(rows: RawRow[], m: Mapping): { leads: CleanLead[]; skipped: number; duplicates: number } {
  const seen = new Set<string>(), leads: CleanLead[] = []; let skipped = 0, duplicates = 0;
  for (const r of rows) {
    const c = mapRow(r, m);
    if (!c) { skipped++; continue; }
    if (seen.has(c.place_id)) { duplicates++; continue; }
    seen.add(c.place_id); leads.push(c);
  }
  return { leads, skipped, duplicates };
}
export const missingRequired = (m: Mapping): string[] => IMPORT_FIELDS.filter((f) => 'required' in f && f.required && !m[f.key]).map((f) => f.label);
