// What the LeadFlow lead routes accept from the browser. Pure, so it is tested without a network.
//
// POST /api/leadflow/leads and PATCH /api/leadflow/leads/:id used to forward the whole request body to the database,
// so a typo or a tampered body could rewrite any column. Now only known columns get through: a PATCH may only touch
// the columns the LeadFlow screens actually edit, and a POST may only carry columns the table really has. The columns
// the scraper and the filter/scoring workers own (place_id, scores, tier, chain flags…) can't be changed from a PATCH.

/** Every status the leads_status_check constraint allows once schema_135 is applied (the first eleven exist today). */
export const LEAD_STATUSES = ['new', 'queued', 'called', 'no_answer', 'voicemail', 'gatekeeper', 'callback', 'interested', 'not_interested', 'client', 'dead', 'do_not_contact', 'wrong_number', 'converted'] as const;
export const DNC_STATUS = 'do_not_contact';

/** Columns a PATCH may set: what the lead card, call log, flag, pool and Dialing buttons write. */
export const PATCH_COLUMNS = new Set(['status', 'call_notes', 'call_count', 'last_called_at', 'next_followup_at', 'owner_name', 'owner_phone', 'owner_email', 'flagged', 'flag_note', 'pooled', 'dialing_queued', 'dialing_queued_at', 'tag', 'dnc_at', 'dnc_reason']);

/** Columns that exist on `leads` today (read from the live table). A POST may carry these, except the ones the database sets itself. */
export const LEAD_COLUMNS = ['workspace_id', 'place_id', 'business_name', 'phone', 'owner_name', 'owner_is_agent_only', 'registered_agent', 'registry_legal_name', 'registry_confidence', 'registry_note', 'registry_url', 'address', 'city', 'lat', 'lng', 'category', 'search_category', 'website', 'summary', 'rating', 'review_count', 'days_since_last_review', 'fizzle_score', 'tier', 'fizzle_reasons', 'maps_url', 'streetview_url', 'streetview_path', 'photo_path', 'status', 'call_notes', 'last_called_at', 'call_count', 'next_followup_at', 'industry', 'tag', 'state', 'pooled', 'photo_paths', 'owner_phone', 'owner_email', 'flagged', 'flag_note', 'dialing_queued', 'dialing_queued_at', 'is_chain', 'chain_name', 'business_size', 'duplicate_of', 'filter_note', 'filtered_at', 'dnc_at', 'dnc_reason'] as const;
const POST_COLUMNS = new Set<string>(LEAD_COLUMNS);
export const MAX_POST_ROWS = 500;
const MAX_TEXT = 4000;
const JSONB = new Set(['fizzle_reasons', 'photo_paths']);
const BOOL = new Set(['owner_is_agent_only', 'pooled', 'flagged', 'dialing_queued', 'is_chain']);
const NUM = new Set(['registry_confidence', 'lat', 'lng', 'rating', 'review_count', 'days_since_last_review', 'fizzle_score', 'call_count']);

export type Guarded<T> = { ok: true; value: T; dropped: string[] } | { ok: false; error: string };

/** CSV imports send every cell as text, so for those the value is converted first: "12" → 12, "true" → true, a JSON string → its list. */
function coerce(col: string, v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (NUM.has(col)) { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) ? n : v; }
  if (BOOL.has(col)) return v.toLowerCase() === 'true' ? true : v.toLowerCase() === 'false' ? false : v;
  if (JSONB.has(col)) { try { return JSON.parse(v); } catch { return v; } }
  return v;
}

function clean(col: string, v: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null };
  if (col === 'status') return typeof v === 'string' && (LEAD_STATUSES as readonly string[]).includes(v) ? { ok: true, value: v } : { ok: false, error: `Not a valid status: ${String(v).slice(0, 40)}` };
  if (col === 'tier') return v === 'A' || v === 'B' || v === 'C' ? { ok: true, value: v } : { ok: false, error: 'tier must be A, B or C' };
  if (col === 'business_size') return v === 'single' || v === 'multi' || v === 'unknown' ? { ok: true, value: v } : { ok: false, error: 'business_size must be single, multi or unknown' };
  if (BOOL.has(col)) return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, error: `${col} must be true or false` };
  if (NUM.has(col)) return typeof v === 'number' && Number.isFinite(v) ? { ok: true, value: v } : { ok: false, error: `${col} must be a number` };
  if (JSONB.has(col)) return Array.isArray(v) && JSON.stringify(v).length <= 20000 ? { ok: true, value: v } : { ok: false, error: `${col} must be a list` };
  if (typeof v !== 'string') return { ok: false, error: `${col} must be text` };
  if (v.length > MAX_TEXT) return { ok: false, error: `${col} is too long` };
  return { ok: true, value: v };
}

function pick(input: unknown, allowed: (c: string) => boolean, lenient = false): Guarded<Record<string, unknown>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Expected a JSON object.' };
  const out: Record<string, unknown> = {}; const dropped: string[] = [];
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed(k)) { dropped.push(k); continue; }
    const c = clean(k, lenient ? coerce(k, v) : v);
    // An import row with one bad cell loses that cell (listed in `dropped`) instead of failing the whole batch of 500.
    if (!c.ok) { if (lenient) { dropped.push(k); continue; } return c; }
    out[k] = c.value;
  }
  return { ok: true, value: out, dropped };
}

/** A PATCH body for one lead. Empty after filtering is an error, so a body of only unknown keys can't silently "succeed". */
export function guardPatch(body: unknown): Guarded<Record<string, unknown>> {
  const r = pick(body, (c) => PATCH_COLUMNS.has(c));
  if (!r.ok) return r;
  if (Object.keys(r.value).length === 0) return { ok: false, error: 'Nothing in that update can be changed here.' };
  // Marking do-not-contact stamps the date unless the caller set one.
  if (r.value.status === DNC_STATUS && r.value.dnc_at === undefined) r.value.dnc_at = new Date().toISOString();
  return r;
}

/** A POST body: one lead or a list of up to 500. A row with no place_id (a lead typed in by hand) gets a manual one, because place_id is required and unique. */
export function guardInsert(body: unknown, newId: () => string = () => crypto.randomUUID()): Guarded<Record<string, unknown>[]> {
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length === 0) return { ok: false, error: 'No leads given.' };
  if (rows.length > MAX_POST_ROWS) return { ok: false, error: `Too many leads in one request (${rows.length} > ${MAX_POST_ROWS}).` };
  const out: Record<string, unknown>[] = []; const dropped = new Set<string>();
  for (const row of rows) {
    const r = pick(row, (c) => POST_COLUMNS.has(c), true);
    if (!r.ok) return r;
    r.dropped.forEach((d) => dropped.add(d));
    const v = r.value;
    if (typeof v.business_name !== 'string' || !v.business_name.trim()) return { ok: false, error: 'Every lead needs a business name.' };
    if (typeof v.place_id !== 'string' || !v.place_id.trim()) v.place_id = `manual:${newId()}`;
    out.push(v);
  }
  return { ok: true, value: out, dropped: [...dropped] };
}

/** Bulk patches use the same column rule as a single patch, plus the do-not-contact guard below. */
export const bulkPatch = (patchIn: unknown) => guardPatch(patchIn);

/** PostgREST filter that keeps do-not-contact leads out of a request. NULL status counts as fine. */
export const NOT_DNC_FILTER = `or=(status.is.null,status.neq.${DNC_STATUS})`;
/** True when a patch would put a lead into a calling list. Those requests must skip do-not-contact leads. */
export const entersCallList = (patch: Record<string, unknown>) => patch.dialing_queued === true || patch.pooled === true;
