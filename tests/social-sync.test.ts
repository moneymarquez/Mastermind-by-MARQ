import { describe, it, expect } from 'vitest';
import { ownerForHandle, avgOf, igProvider, fetchIgNumbers, applyIgNumbers } from '../worker/lib/socialSync';

describe('Instagram numbers into Content profiles', () => {
  it('maps real handles to the right profile and keeps one token per account', () => {
    expect(ownerForHandle('mastermindsbymarq')).toBe('mastermind');
    expect(ownerForHandle('made.bymarq')).toBe('madebymarq');
    expect(ownerForHandle('crismarquezply')).toBe('personal');
    expect(igProvider('@Made.ByMarq')).toBe('instagram:made.bymarq');
  });
  it('averages only the views that exist', () => {
    expect(avgOf([100, null, 300])).toBe(200);
    expect(avgOf([])).toBeNull();
  });
  it('reads followers, post count and 30-day average views; missing insights never throw', async () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString(), old = new Date(Date.now() - 90 * 86400000).toISOString();
    const f = (async (u: string) => {
      const ok = (b: unknown) => ({ ok: true, json: async () => b });
      if (u.includes('/me?fields=username')) return ok({ username: 'made.bymarq', followers_count: 812, media_count: 40 });
      if (u.includes('/me/media')) return ok({ data: [{ id: 'a', timestamp: recent }, { id: 'b', timestamp: recent }, { id: 'c', timestamp: old }] });
      if (u.includes('/a/insights')) return ok({ data: [{ name: 'views', values: [{ value: 1000 }] }] });
      return { ok: false, json: async () => ({}) };
    }) as unknown as typeof fetch;
    const n = await fetchIgNumbers('tok', f);
    expect(n).toMatchObject({ username: 'made.bymarq', followers: 812, posts: 40, avgViews: 1000, viewed: 1 });
    expect(n.media).toHaveLength(3);
    expect(n.media![0]).toMatchObject({ id: 'a', views: 1000, type: 'image' });
    await expect(fetchIgNumbers('tok', (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch)).rejects.toThrow(/Connect it again/);
  });
  it('takes over a placeholder row instead of making a duplicate, then updates it', async () => {
    const rows = [{ id: 'p1', platform: 'instagram', handle: 'madebymarq', owner: 'madebymarq', connected: false }, { id: 'p2', platform: 'instagram', handle: 'Madebymarq', owner: 'personal', connected: false }];
    const log: string[] = [];
    const sb = { get: async () => rows, patch: async (_t: string, f: string, b: Record<string, unknown>) => { log.push(`patch ${f} ${JSON.stringify(b).slice(0, 60)}`); }, insert: async (t: string) => { log.push(`insert ${t}`); return [{ id: 'new' }]; } } as never;
    const r = await applyIgNumbers(sb, 'u', { username: 'made.bymarq', followers: 812, posts: 40, avgViews: 1000, viewed: 1 });
    expect(r).toEqual({ account_id: 'p1', created: false, renamed: true });
    expect(log.some((l) => l.includes('handle'))).toBe(true);
    expect(log).toContain('insert social_account_snapshots');
    expect(log).not.toContain('insert social_accounts');
    const none = await applyIgNumbers({ ...(sb as object), get: async () => [] } as never, 'u', { username: 'crismarquezply', followers: 5, posts: 1, avgViews: null, viewed: 0 });
    expect(none.created).toBe(true);
  });
});
