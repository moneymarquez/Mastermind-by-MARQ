import { describe, it, expect } from 'vitest';
import { profileView, draftHasChanges, parseProfileSuggestions, BIO_LIMIT } from '../src/data/profileMock';

describe('profile page model', () => {
  const live = { name: 'Made by MARQ', username: 'made.bymarq', biography: 'We build sites.', website: 'https://madebymarq.com', followers_count: 10, follows_count: 3, media_count: 4, account_type: 'BUSINESS', profile_picture_url: 'https://x/p.jpg' };
  it('shows the live page when there is no draft', () => {
    const v = profileView('instagram', 'made.bymarq', live, null);
    expect(v).toMatchObject({ name: 'Made by MARQ', bio: 'We build sites.', followers: 10, following: 3, posts: 4, accountType: 'BUSINESS', hasDraft: false });
    expect(draftHasChanges(v)).toBe(false);
  });
  it('shows the draft where there is one and marks what changed', () => {
    const v = profileView('instagram', 'made.bymarq', live, { bio: 'New bio', category: 'Web designer', highlights: ['Work'] });
    expect(v.bio).toBe('New bio'); expect(v.name).toBe('Made by MARQ');
    expect(v.changed).toMatchObject({ bio: true, name: false, category: true, highlights: true });
    expect(draftHasChanges(v)).toBe(true);
  });
  it('flags a bio over the platform limit and copes with nothing synced yet', () => {
    expect(profileView('instagram', 'x', live, { bio: 'a'.repeat(BIO_LIMIT.instagram + 1) }).bioOver).toBe(true);
    const empty = profileView('tiktok', 'newacct', null, null, { followers: 5 });
    expect(empty).toMatchObject({ name: '', bio: '', username: 'newacct', followers: 5, posts: null, bioLimit: 80 });
  });
  it('trims AI suggestions to the limits and survives bad answers', () => {
    const r = parseProfileSuggestions('Sure: {"bios":["' + 'x'.repeat(300) + '","ok"],"names":["N"],"links":[],"notes":"n"}', 'instagram');
    expect(r.bios[0].length).toBe(150); expect(r.bios[1]).toBe('ok'); expect(r.names).toEqual(['N']);
    expect(parseProfileSuggestions('no json', 'instagram')).toEqual({ bios: [], names: [], links: [], notes: '' });
  });
});
