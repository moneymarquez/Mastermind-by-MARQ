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
// OWNER_USER_ID is the durable, non-heuristic identity check this gate
// requires — the account's real auth.users.id, hardcoded, confirmed
// directly from Supabase Studio → Authentication → Users (first account
// ever created, matching schema_023's app_owner bootstrap). This is now
// the primary check.
//
// OWNER_EMAIL was wrong for a while — it was set to madebymarquez@icloud.com,
// which doesn't match this account's real Supabase Auth email at all. That
// mismatch is what caused the owner to be shown onboarding: this file's
// email fallback was the ONLY thing checked before OWNER_USER_ID was
// filled in, and it never matched. Fixed to the real address below; kept
// only as a redundant fallback now that the ID is the primary check.
export const OWNER_USER_ID: string | null = 'a4b89df9-7122-424a-afb5-fc4871e0963b';
export const OWNER_EMAIL = 'marquez.cristopher@icloud.com';

export interface IdentityLike {
  id?: string | null;
  email?: string | null;
}

export function isOwnerIdentity(user: IdentityLike | null | undefined): boolean {
  if (!user) return false;
  if (OWNER_USER_ID && user.id === OWNER_USER_ID) return true;
  return !!user.email && user.email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}
