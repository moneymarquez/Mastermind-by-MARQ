// Invite links look like /?join=<token>. The token is lifted out of the URL
// before anything renders (so it never sits in history or gets shared on),
// kept for the tab, and redeemed once there's a signed-in session.
import { api } from '../lib/api';

const KEY = 'dp:join';

export function captureJoinToken(): void {
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('join');
    if (!t) return;
    sessionStorage.setItem(KEY, t);
    url.searchParams.delete('join');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* no window / storage */ }
}

export function hasPendingJoin(): boolean { try { return !!sessionStorage.getItem(KEY); } catch { return false; } }

export async function redeemPendingJoin(): Promise<{ joined?: boolean; owner_name?: string; error?: string } | null> {
  let t: string | null = null;
  try { t = sessionStorage.getItem(KEY); } catch { return null; }
  if (!t) return null;
  const r = await api<{ joined: boolean; owner_name: string }>('/api/dispatch/join', { body: { token: t } });
  // Keep the token only if it was a network blip, not a real refusal.
  if (!r.error || !/Not signed in|Failed to fetch|NetworkError/i.test(r.error)) { try { sessionStorage.removeItem(KEY); } catch { /* ok */ } }
  return r;
}
