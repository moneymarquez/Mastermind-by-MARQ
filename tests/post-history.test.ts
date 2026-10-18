import { describe, it, expect } from 'vitest';
import { buildHistory, filterHistory, historyCsv, isTestPost } from '../src/data/postHistory';
import type { SocialPost } from '../src/data/contentEngine';

const post = (id: string, account_id: string, posted_at: string, extra: Partial<SocialPost> = {}): SocialPost => ({ id, account_id, external_id: id, url: `https://x/${id}`, type: 'reel', caption: `cap ${id}`, hook: null, format: null, length_sec: null, thumbnail_url: null, posted_at, content_item_id: null, created_at: posted_at, updated_at: posted_at, ...extra });
const accts = [{ id: 'a1', handle: 'made.bymarq', platform: 'instagram' as const }, { id: 'a2', handle: 'mastermindsbymarq', platform: 'instagram' as const }];

describe('post history', () => {
  const posts = [post('p1', 'a1', '2026-10-01T10:00:00Z'), post('p2', 'a2', '2026-10-03T10:00:00Z', { content_item_id: 'c1' }), post('p3', 'a1', '2026-10-02T10:00:00Z', { external_id: 'dry-run-instagram-abc' })];
  const metrics = { p1: [{ id: 'm', post_id: 'p1', captured_at: 'x', views: 900, reach: null, likes: 40, comments: 3, shares: null, saves: 7, follows: null, source: 'api' as const }] };
  const attempts = [{ id: 't1', account_id: 'a1', platform: 'instagram', status: 'failed', url: null, error: 'Only JPEG', created_at: '2026-10-04T10:00:00Z', content_item_id: null }, { id: 't2', account_id: 'a1', platform: 'instagram', status: 'published', url: null, error: null, created_at: '2026-10-05T10:00:00Z', content_item_id: null }];
  const rows = buildHistory(accts, posts, metrics, attempts);
  it('puts every account together, newest first, with failures and test posts marked', () => {
    expect(rows.map((r) => r.id)).toEqual(['try-t1', 'post-p2', 'post-p3', 'post-p1']);
    expect(rows.find((r) => r.id === 'post-p3')!.kind).toBe('test');
    expect(rows.find((r) => r.id === 'try-t1')).toMatchObject({ kind: 'failed', error: 'Only JPEG', handle: 'made.bymarq' });
    expect(rows.find((r) => r.id === 'post-p1')).toMatchObject({ kind: 'posted', views: 900, likes: 40, source: 'imported' });
    expect(rows.find((r) => r.id === 'post-p2')!.source).toBe('masterminds');
    expect(isTestPost({ external_id: null })).toBe(false);
  });
  it('filters by account, status and text', () => {
    expect(filterHistory(rows, { account: 'a2', kind: 'all', q: '' })).toHaveLength(1);
    expect(filterHistory(rows, { account: 'all', kind: 'failed', q: '' })).toHaveLength(1);
    expect(filterHistory(rows, { account: 'all', kind: 'all', q: 'jpeg' })).toHaveLength(1);
  });
  it('exports a CSV with quoted captions', () => {
    const csv = historyCsv(rows);
    expect(csv.split('\n')).toHaveLength(5);
    expect(csv).toContain('"made.bymarq"');
  });
});
