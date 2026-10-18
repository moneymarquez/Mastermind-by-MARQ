import { describe, it, expect } from 'vitest';
import { normalizeContact } from '../src/data/contactsPure';
import { initials } from '../src/components/screens/v2/util';

describe('contacts with missing fields', () => {
  it('normalizes null name, phone, email, tags and lists without throwing', () => {
    const c = normalizeContact({ id: 'c1', name: null, phone: null, email: null, lists: null, tags: null } as never);
    expect(c.name).toBe('');
    expect(c.phone).toBeNull();
    expect((c as unknown as { lists: unknown[] }).lists).toEqual([]);
    expect(() => [c].filter((x) => (x.name ?? '').toLowerCase().includes('a'))).not.toThrow();
  });
  it('initials survive null and empty names', () => {
    expect(initials(null)).toBe('?');
    expect(initials(undefined)).toBe('?');
    expect(initials('  ')).toBe('?');
    expect(initials('Ada Lovelace')).toBe('AL');
  });
});
