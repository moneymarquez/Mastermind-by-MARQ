import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MODULE_KEYS } from '../modules.config';

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

  const load = useCallback(async () => {
    if (isOwner) {
      setHasOnboarded(true);
      setEnabledKeys(new Set(MODULE_KEYS));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('user_modules').select('module_key, enabled');
    const rows = data ?? [];
    setHasOnboarded(rows.length > 0);
    setEnabledKeys(new Set(rows.filter((r) => r.enabled).map((r) => r.module_key)));
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const canAccess = (moduleKey: string) => isOwner || enabledKeys.has(moduleKey);

  const saveModuleSelections = async (keys: string[]) => {
    if (!userId) return;
    const rows = keys.map((module_key) => ({ user_id: userId, module_key, enabled: true }));
    await supabase.from('user_modules').upsert(rows, { onConflict: 'user_id,module_key' });
    await load();
  };

  return { loading, isOwner, hasOnboarded, enabledKeys, canAccess, saveModuleSelections };
}
