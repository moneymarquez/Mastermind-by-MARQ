import { describe, it, expect } from 'vitest';
import { pickForDialing, availableForDialing } from '../src/components/screens/leadflow/leadFilters';
import { isDnc, leadTags } from '../src/components/screens/leadflow/format';
import type { LeadflowLead } from '../src/data/useLeadflow';

const lead = (o: Partial<LeadflowLead>) => ({ id: 'x', business_name: 'A', status: 'new', fizzle_score: 50, dialing_queued: false, call_count: 0, last_called_at: null, ...o }) as unknown as LeadflowLead;
describe('do-not-contact in LeadFlow', () => {
  it('is never sent to Dialing', () => {
    const leads = [lead({ id: '1', fizzle_score: 90, status: 'do_not_contact' }), lead({ id: '2', fizzle_score: 60 })];
    expect(pickForDialing(leads, 10).map((l) => l.id)).toEqual(['2']);
    expect(availableForDialing(leads)).toBe(1);
  });
  it('shows on the lead as a stop tag', () => {
    expect(isDnc(lead({ status: 'do_not_contact' }))).toBe(true);
    expect(leadTags(lead({ status: 'do_not_contact' })).some((t) => t.label === 'Do not contact' && t.s === 'stop')).toBe(true);
    expect(isDnc(lead({}))).toBe(false);
  });
});
