// Single source of truth for "is this the owner's account" — deliberately
// synchronous and zero-network. It only ever reads fields off the auth
// session App.tsx already resolved before AuthedGate mounts; it never
// re-fetches anything.
//
// The previous version of this check (formerly inside
// src/data/useModuleAccess.ts) called supabase.auth.getUser() and an
// is_owner() RPC on every mount. Either could race, hang, or error — and
// when that happened, it silently fell through to "not owner," which is
// exactly what stranded the owner's own account behind the onboarding
// screen once, live. There is no request in flight here for any of that
// to happen to.
//
// OWNER_USER_ID is the durable, non-heuristic identity check requested
// for this gate — the account's real auth.users.id, hardcoded. It's left
// null until that id is supplied (Supabase Studio → Authentication →
// Users → copy the id for madebymarquez@icloud.com); OWNER_EMAIL alone is
// still a real, fixed identity check (not a heuristic) and is sufficient
// on its own until then. Either match is enough.
export const OWNER_USER_ID: string | null = null;
export const OWNER_EMAIL = 'madebymarquez@icloud.com';

export interface IdentityLike {
  id?: string | null;
  email?: string | null;
}

export function isOwnerIdentity(user: IdentityLike | null | undefined): boolean {
  if (!user) return false;
  if (OWNER_USER_ID && user.id === OWNER_USER_ID) return true;
  return !!user.email && user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}
