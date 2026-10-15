import { describe, it, expect } from 'vitest';
import { guardPatch, guardInsert, entersCallList, NOT_DNC_FILTER, MAX_POST_ROWS } from '../worker/lib/leadflowGuard';

describe('LeadFlow write guard', () => {
  it('lets the lead card write its own columns', () => {
    const r = guardPatch({ owner_name: 'Dana', owner_phone: '3035550100', call_notes: 'asked for a callback', flagged: true, status: 'callback', call_count: 2, last_called_at: '2026-10-15T10:00:00Z' });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['call_count', 'call_notes', 'flagged', 'last_called_at', 'owner_name', 'owner_phone', 'status']);
  });
  it('drops columns the scraper or workers own, and refuses a body with nothing left', () => {
    const r = guardPatch({ place_id: 'x', fizzle_score: 99, tier: 'A', business_name: 'Hijacked', is_chain: true, id: 'abc', status: 'interested' });
    expect(r.ok && r.value).toEqual({ status: 'interested' });
    expect(r.ok && r.dropped.sort()).toEqual(['business_name', 'fizzle_score', 'id', 'is_chain', 'place_id', 'tier']);
    expect(guardPatch({ place_id: 'x' })).toMatchObject({ ok: false });
    expect(guardPatch([1])).toMatchObject({ ok: false });
  });
  it('checks types and statuses', () => {
    expect(guardPatch({ status: 'banana' })).toMatchObject({ ok: false });
    expect(guardPatch({ flagged: 'yes' })).toMatchObject({ ok: false });
    expect(guardPatch({ call_count: NaN })).toMatchObject({ ok: false });
    expect(guardPatch({ call_notes: 'x'.repeat(5000) })).toMatchObject({ ok: false });
    expect(guardPatch({ owner_email: null })).toMatchObject({ ok: true });
  });
  it('marking do-not-contact stamps the date', () => {
    const r = guardPatch({ status: 'do_not_contact', dnc_reason: 'asked to stop' });
    expect(r.ok && typeof r.value.dnc_at).toBe('string');
  });
  it('POST keeps real columns, drops unknown ones (website_status is not a column) and numbers hand-typed leads', () => {
    const r = guardInsert({ business_name: 'Joe Plumbing', phone: '555', industry: 'Plumber', website_status: 'no_website', tag: 'Warm', pooled: false }, () => 'fixed');
    expect(r.ok && r.value[0]).toMatchObject({ business_name: 'Joe Plumbing', place_id: 'manual:fixed' });
    expect(r.ok && r.dropped).toEqual(['website_status']);
  });
  it('POST accepts a batch, requires a name, never lets id or created_at through, and caps the size', () => {
    expect(guardInsert([{ business_name: 'A', place_id: 'p1', id: 'evil', created_at: 'x' }, { business_name: 'B' }]).ok).toBe(true);
    const r = guardInsert({ business_name: 'A', place_id: 'p1', id: 'evil' });
    expect(r.ok && r.value[0].id).toBeUndefined();
    expect(guardInsert({ phone: '1' })).toMatchObject({ ok: false });
    expect(guardInsert(Array.from({ length: MAX_POST_ROWS + 1 }, () => ({ business_name: 'x' })))).toMatchObject({ ok: false });
    expect(guardInsert([])).toMatchObject({ ok: false });
  });
  it('an import row sent as text is converted, and one bad cell drops only that cell', () => {
    const r = guardInsert({ business_name: 'A', place_id: 'p', review_count: '120', flagged: 'false', fizzle_reasons: '["old site"]', rating: 'n/a', status: 'banana' });
    expect(r.ok && r.value[0]).toMatchObject({ review_count: 120, flagged: false, fizzle_reasons: ['old site'] });
    expect(r.ok && r.dropped.sort()).toEqual(['rating', 'status']);
  });
  it('knows when a patch would put a lead in a call list', () => {
    expect(entersCallList({ dialing_queued: true })).toBe(true);
    expect(entersCallList({ dialing_queued: false })).toBe(false);
    expect(NOT_DNC_FILTER).toContain('do_not_contact');
  });
});
