import type { Contact } from './types';

/** A contact row with every text field safe to read: nulls become '' / [] so no screen has to guard. */
export function normalizeContact(r: Partial<Contact>): Contact {
  return { ...r, name: typeof r.name === 'string' ? r.name : '', phone: r.phone ?? null, email: r.email ?? null, business_name: r.business_name ?? null, notes: r.notes ?? null, status: r.status ?? null, tags: Array.isArray((r as { tags?: unknown }).tags) ? (r as { tags: unknown[] }).tags : [], lists: Array.isArray((r as { lists?: unknown }).lists) ? (r as { lists: unknown[] }).lists : [] } as unknown as Contact;
}
