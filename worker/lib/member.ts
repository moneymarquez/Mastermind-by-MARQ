// Who may spend the app's money (bug inventory B-02). The billing screen
// is only a client-side gate, so every route that calls a paid API checks
// here: the owner, a comped account, or an active/trialing subscription.
// A client-portal login is never a member, whatever else is true.
import { requireUser, isOwnerUser, OWNER_USER_ID } from './auth';
import type { AuthedUser } from './auth';
import { Sb, json } from './sb';
import type { SbEnv } from './sb';
import { costOf, spentToday, capFor, DEFAULT_DAILY_CAP_USD } from './ai';

export async function isMember(sb: Sb, userId: string): Promise<boolean> {
  if (userId === OWNER_USER_ID) return true;
  const [profile, comped, subs] = await Promise.all([
    sb.get<{ role: string | null }>(`profiles?id=eq.${userId}&select=role`),
    sb.get<{ user_id: string }>(`comped_users?user_id=eq.${userId}&select=user_id`),
    sb.get<{ status: string }>(`subscriptions?user_id=eq.${userId}&select=status`),
  ]);
  if (profile[0]?.role === 'client') return false;
  return comped.length > 0 || subs.some((s) => s.status === 'active' || s.status === 'trialing');
}

/** Every member's user id, for crons that spend per user. */
export async function memberIds(sb: Sb): Promise<Set<string>> {
  const [comped, subs, clients] = await Promise.all([
    sb.get<{ user_id: string }>('comped_users?select=user_id'),
    sb.get<{ user_id: string }>('subscriptions?status=in.(active,trialing)&select=user_id'),
    sb.get<{ id: string }>('profiles?role=eq.client&select=id'),
  ]);
  const client = new Set(clients.map((c) => c.id));
  return new Set([OWNER_USER_ID, ...comped.map((c) => c.user_id), ...subs.map((s) => s.user_id)].filter((id) => !client.has(id)));
}

/** requireUser + member check. 402 tells the app to show the billing screen. */
export async function requireMember(request: Request, env: SbEnv): Promise<{ user: AuthedUser; sb: Sb; owner: boolean } | Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set as a Worker secret.' }, 500);
  const sb = new Sb(env);
  const owner = isOwnerUser(user);
  if (!owner && !(await isMember(sb, user.id))) return json({ error: 'This needs an active Mastermind subscription.', code: 'subscription_required' }, 402);
  return { user, sb, owner };
}

// ── The assistant meter (/api/claude, /api/nova-chat) ─────────────────
// Separate from the worker domains so Nova and the in-screen AI helpers
// can't eat the workers' budget. Members get the daily cap (ai_domain_caps
// 'assistant', else $1); the owner is metered but never blocked.
export const ASSISTANT_DOMAIN = 'assistant';
export const MAX_ASSISTANT_TOKENS = 4000;

export async function assistantBudget(sb: Sb, userId: string, owner: boolean, date: string): Promise<Response | null> {
  if (owner) return null;
  const [spent, cap] = await Promise.all([spentToday(sb, userId, ASSISTANT_DOMAIN, date), capFor(sb, userId, ASSISTANT_DOMAIN)]);
  if (spent >= cap) return json({ error: `You've used today's AI allowance ($${cap.toFixed(2)}). It resets at midnight.`, code: 'cap_reached' }, 429);
  return null;
}

export async function recordAssistantCost(sb: Sb, userId: string, date: string, model: string, tokensIn: number, tokensOut: number): Promise<void> {
  await sb.insert('ai_cost_ledger', { user_id: userId, date, domain: ASSISTANT_DOMAIN, cost_usd: Number(costOf(model, tokensIn, tokensOut).toFixed(5)) }).catch((e) => console.error('assistant ledger', e));
}

export { DEFAULT_DAILY_CAP_USD };
