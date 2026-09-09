import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MODULE_KEYS, MODULE_REGISTRY, SELECTABLE_MODULE_KEYS } from '../modules.config';

// The authoritative enforcement point for "owner-only modules are never
// accessible to a non-owner" — independent of what onboarding/Manage
// modules ever let a non-owner select, and independent of what
// user_modules happens to contain for them. Even if a stray row somehow
// existed there, canAccess() below still refuses it for these keys.
const OWNER_ONLY_KEYS = new Set(MODULE_REGISTRY.filter((m) => m.ownerOnly).map((m) => m.key));

export interface ModuleAccess {
  loading: boolean;
  /** Mirrors the isOwner passed in — the owner never has to wait on this
   *  hook's own query to know it has full access; see AuthedGate.tsx. */
  isOwner: boolean;
  /** False only for a real, non-owner account with zero user_modules rows
   *  — i.e. it hasn't been through onboarding yet. Always true for the
   *  owner (who never sees onboarding), and always true once loading. */
  hasOnboarded: boolean;
  enabledKeys: Set<string>;
  canAccess: (moduleKey: string) => boolean;
  saveModuleSelections: (keys: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Owner-vs-not is decided by the caller (see src/auth/ownerIdentity.ts,
 * checked synchronously in AuthedGate before this hook ever runs) — this
 * hook no longer probes for it itself. It used to (an async
 * supabase.auth.getUser() call plus an is_owner() RPC, on every mount),
 * and that's exactly what once let the owner's own account fall through
 * to "not owner" on a slow network or an RPC error, live. Passing isOwner
 * in makes that failure mode structurally impossible here: for the owner,
 * this hook does no network work at all.
 */
export function useModuleAccess(userId: string, isOwner: boolean): ModuleAccess {
  const [loading, setLoading] = useState(!isOwner);
  const [hasOnboarded, setHasOnboarded] = useState(isOwner);
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(new Set(isOwner ? MODULE_KEYS : []));
  // Named, per-account exceptions to an owner-only module (schema_060) —
  // e.g. a comped account the owner has explicitly decided should get its
  // own separate Scaling workspace. Empty for everyone until the owner
  // grants a row; never settable by the account itself (see that
  // migration's RLS — only the owner can write here).
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (isOwner) {
      setHasOnboarded(true);
      setEnabledKeys(new Set(MODULE_KEYS));
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data }, { data: comped }, { data: grants }] = await Promise.all([
      supabase.from('user_modules').select('module_key, enabled'),
      supabase.rpc('is_comped'),
      supabase.from('owner_only_grants').select('module_key'),
    ]);
    setGrantedKeys(new Set((grants ?? []).map((r) => r.module_key)));
    const rows = data ?? [];
    // A comped (owner-granted, no real subscription) account skips the
    // module picker entirely — same as an owner minus the owner-only
    // keys, which canAccess() below still blocks unless separately
    // granted. Defaults to everything on, but still honors an explicit
    // enabled:false row — otherwise a comped account could never actually
    // turn a module off from Manage Modules; the account-wide default
    // would silently override it back on every load.
    if (comped) {
      setHasOnboarded(true);
      const explicitlyOff = new Set(rows.filter((r) => !r.enabled).map((r) => r.module_key));
      setEnabledKeys(new Set(SELECTABLE_MODULE_KEYS.filter((k) => !explicitlyOff.has(k))));
      setLoading(false);
      return;
    }
    setHasOnboarded(rows.length > 0);
    setEnabledKeys(new Set(rows.filter((r) => r.enabled).map((r) => r.module_key)));
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const canAccess = (moduleKey: string) => {
    if (OWNER_ONLY_KEYS.has(moduleKey)) return isOwner || grantedKeys.has(moduleKey);
    return isOwner || enabledKeys.has(moduleKey);
  };

  const saveModuleSelections = async (keys: string[]) => {
    if (!userId) return;
    // Belt-and-suspenders: even if a caller somehow passed an owner-only
    // key through (the picker itself never lets a non-owner select one),
    // it's dropped here before it ever reaches the database.
    const filtered = isOwner ? keys : keys.filter((k) => !OWNER_ONLY_KEYS.has(k));
    const selected = new Set(filtered);
    // Write true/false for every selectable key, not just the ones being
    // turned on — writing only the "on" set left a deselected key with
    // either no row at all (comped account: read side just re-defaulted
    // it back on) or a stale enabled:true row (regular account), so
    // unchecking a module and saving never actually turned it off.
    const keysToWrite = isOwner ? MODULE_KEYS : SELECTABLE_MODULE_KEYS;
    const rows = keysToWrite.map((module_key) => ({ user_id: userId, module_key, enabled: selected.has(module_key) }));
    await supabase.from('user_modules').upsert(rows, { onConflict: 'user_id,module_key' });
    await load();
  };

  return { loading, isOwner, hasOnboarded, enabledKeys, canAccess, saveModuleSelections, refresh: load };
}
