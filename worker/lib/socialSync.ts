// Real numbers from a connected Instagram account into the Content profile
// (Addendum: "carry over my real numbers"). One token is kept per account
// (provider "instagram:<handle>"), so several accounts can be connected.
// Reads only: followers, post count and average views over the last 30
// days. Nothing is posted or spent. Pure helpers are tested.
import type { Sb } from './sb';
import type { VaultEnv } from './vault';
import { loadToken } from './tokens';

const IG = 'https://graph.instagram.com';
export const igProvider = (handle: string) => `instagram:${handle.trim().replace(/^@/, '').toLowerCase()}`;

export type OwnerKind = 'mastermind' | 'madebymarq' | 'personal';
/** Which of Marq's own profiles a handle belongs to. Pure. */
export function ownerForHandle(handle: string): OwnerKind {
  const h = handle.toLowerCase().replace(/[._]/g, '');
  if (h.includes('mastermind')) return 'mastermind';
  if (h.includes('madeby')) return 'madebymarq';
  return 'personal';
}
/** Mean of the numbers that exist, rounded; null when there are none. Pure. */
export function avgOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : null;
}

export interface IgNumbers { username: string; followers: number | null; posts: number | null; avgViews: number | null; viewed: number }
/** One Instagram account's numbers. Never throws: a missing permission just leaves avg views empty. */
export async function fetchIgNumbers(token: string, f: typeof fetch = fetch): Promise<IgNumbers> {
  const get = async <T,>(path: string): Promise<T | null> => { try { const r = await f(`${IG}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`); return r.ok ? ((await r.json()) as T) : null; } catch { return null; } };
  const me = await get<{ username?: string; followers_count?: number; media_count?: number }>('/me?fields=username,followers_count,media_count');
  if (!me?.username) throw new Error('Instagram didn\'t answer for this account. Disconnect and Connect it again in Setup.');
  const since = Date.now() - 30 * 86400000;
  const media = await get<{ data?: { id: string; timestamp?: string }[] }>('/me/media?fields=id,timestamp&limit=25');
  const recent = (media?.data ?? []).filter((m) => m.timestamp && new Date(m.timestamp).getTime() >= since).slice(0, 12);
  const views: (number | null)[] = [];
  for (const m of recent) {
    const ins = await get<{ data?: { name?: string; values?: { value?: number }[] }[] }>(`/${m.id}/insights?metric=views`);
    views.push(ins?.data?.find((d) => d.name === 'views')?.values?.[0]?.value ?? null);
  }
  return { username: me.username, followers: me.followers_count ?? null, posts: me.media_count ?? null, avgViews: avgOf(views), viewed: views.filter((v) => v != null).length };
}

interface AcctRow { id: string; platform: string; handle: string; owner: string; connected: boolean }
/** Apply one account's numbers: update the matching Content profile (or take over an unconnected placeholder, or create one), and add a snapshot. */
export async function applyIgNumbers(sb: Sb, u: string, n: IgNumbers): Promise<{ account_id: string; created: boolean; renamed: boolean }> {
  const handle = n.username.toLowerCase();
  const rows = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.instagram&select=id,platform,handle,owner,connected`);
  const norm = (s: string) => s.toLowerCase().replace(/^@/, '');
  let acct = rows.find((r) => norm(r.handle) === handle);
  let renamed = false, created = false;
  const owner = ownerForHandle(handle);
  if (!acct) {
    // A placeholder from "Add Masterminds, Made by Marq + personal accounts" with the same role and no connection: it becomes this account.
    const placeholder = rows.find((r) => !r.connected && r.owner === owner);
    if (placeholder) { await sb.patch('social_accounts', `id=eq.${placeholder.id}&user_id=eq.${u}`, { handle: n.username }); acct = { ...placeholder, handle: n.username }; renamed = true; }
  }
  if (!acct) {
    const [row] = await sb.insert<AcctRow>('social_accounts', { user_id: u, platform: 'instagram', handle: n.username, owner, connected: true, followers: n.followers });
    acct = row; created = true;
  }
  await sb.patch('social_accounts', `id=eq.${acct.id}&user_id=eq.${u}`, { connected: true, ...(n.followers != null ? { followers: n.followers } : {}), updated_at: new Date().toISOString() });
  await sb.insert('social_account_snapshots', { user_id: u, account_id: acct.id, followers: n.followers, avg_views: n.avgViews, source: 'api' });
  return { account_id: acct.id, created, renamed };
}

/** "Sync numbers": every Instagram account with its own saved connection. */
export async function syncInstagram(env: VaultEnv, sb: Sb, u: string, f: typeof fetch = fetch): Promise<{ results: { handle: string; ok: boolean; detail: string }[] }> {
  const rows = await sb.get<AcctRow>(`social_accounts?user_id=eq.${u}&platform=eq.instagram&select=id,platform,handle,owner,connected`);
  const results: { handle: string; ok: boolean; detail: string }[] = [];
  for (const r of rows) {
    const tok = await loadToken(env, sb, u, igProvider(r.handle)).catch(() => null);
    if (!tok?.token) { results.push({ handle: r.handle, ok: false, detail: 'Not connected yet. Setup → Accounts → Instagram → Connect (while logged in as this account).' }); continue; }
    try {
      const n = await fetchIgNumbers(tok.token, f);
      await applyIgNumbers(sb, u, n);
      results.push({ handle: n.username, ok: true, detail: `${n.followers ?? 'no'} followers${n.avgViews != null ? `, ${n.avgViews} avg views over ${n.viewed} recent posts` : ', no recent post views yet'}.` });
    } catch (e) { results.push({ handle: r.handle, ok: false, detail: e instanceof Error ? e.message : String(e) }); }
  }
  return { results };
}
