// One list of everything that went out (or tried to): every post on every account,
// including the ones imported from Instagram/TikTok, the app's own test posts, and
// publish attempts that failed. Pure, so it's tested.
import type { SocialPost, PostMetrics, SocialAccount } from './contentEngine';
import { latestMetrics } from './contentEngine';

export interface PublishAttempt { id: string; account_id: string | null; platform: string; status: string; url: string | null; error: string | null; created_at: string; content_item_id: string | null }
export type HistoryKind = 'posted' | 'test' | 'failed';
export interface HistoryRow {
  id: string; kind: HistoryKind; account_id: string | null; handle: string; platform: string; at: string; caption: string; thumb: string | null; url: string | null; error: string | null;
  views: number | null; likes: number | null; comments: number | null; saves: number | null; shares: number | null; source: 'imported' | 'masterminds';
}

export const isTestPost = (p: Pick<SocialPost, 'external_id'>) => (p.external_id ?? '').startsWith('dry-run-');

export function buildHistory(accounts: Pick<SocialAccount, 'id' | 'handle' | 'platform'>[], posts: SocialPost[], metrics: Record<string, PostMetrics[]>, attempts: PublishAttempt[]): HistoryRow[] {
  const acct = (id: string | null) => accounts.find((a) => a.id === id);
  const rows: HistoryRow[] = posts.map((p) => {
    const m = latestMetrics(metrics[p.id] ?? []);
    const a = acct(p.account_id);
    return { id: `post-${p.id}`, kind: isTestPost(p) ? 'test' : 'posted', account_id: p.account_id, handle: a?.handle ?? 'unknown', platform: a?.platform ?? 'instagram', at: p.posted_at, caption: (p.caption || p.hook || '').trim(), thumb: p.thumbnail_url, url: p.url, error: null,
      views: m?.views ?? null, likes: m?.likes ?? null, comments: m?.comments ?? null, saves: m?.saves ?? null, shares: m?.shares ?? null, source: p.content_item_id ? 'masterminds' : 'imported' };
  });
  // Attempts that failed have no post row; show them with the reason.
  for (const t of attempts.filter((x) => x.status === 'failed')) {
    const a = acct(t.account_id);
    rows.push({ id: `try-${t.id}`, kind: 'failed', account_id: t.account_id, handle: a?.handle ?? 'unknown', platform: a?.platform ?? t.platform, at: t.created_at, caption: '', thumb: null, url: t.url, error: t.error ?? 'The platform refused the post.', views: null, likes: null, comments: null, saves: null, shares: null, source: 'masterminds' });
  }
  return rows.sort((x, y) => +new Date(y.at) - +new Date(x.at));
}

export interface HistoryFilter { account: string; kind: 'all' | HistoryKind; q: string }
export function filterHistory(rows: HistoryRow[], f: HistoryFilter): HistoryRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => (f.account === 'all' || r.account_id === f.account) && (f.kind === 'all' || r.kind === f.kind) && (!q || r.caption.toLowerCase().includes(q) || r.handle.toLowerCase().includes(q) || (r.error ?? '').toLowerCase().includes(q)));
}

export function historyCsv(rows: HistoryRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const head = ['date', 'account', 'platform', 'status', 'source', 'caption', 'views', 'likes', 'comments', 'saves', 'shares', 'link', 'error'];
  return [head.join(','), ...rows.map((r) => [r.at, r.handle, r.platform, r.kind, r.source, r.caption, r.views, r.likes, r.comments, r.saves, r.shares, r.url, r.error].map(esc).join(','))].join('\n');
}
