import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MODULE_KEYS } from '../modules.config';

// Belt-and-suspenders owner check that doesn't depend on schema_023 having
// been run at all. The DB-side is_owner() (see schema_023) is the real,
// durable mechanism — but it strictly requires that migration to exist
// first, and a migration-ordering mistake (deploy before running it) or
// any transient RPC failure means the DB check silently resolves to "not
// owner," which — before this fix — fell straight through to the most
// restrictive state (onboarding) for the one account this app has ever
// run as. That's exactly backwards: a broken/unmigrated owner check should
// never be able to strand the owner. This email match is the fallback that
// makes that failure mode impossible regardless of migration state.
const OWNER_EMAIL = 'madebymarquez@icloud.com';

export interface ModuleAccess {
  loading: boolean;
  /** True only for the single account app_owner bootstrapped to on first
   *  migration run (see schema_023). Checked FIRST, before anything else —
   *  the owner always has full, unrestricted access regardless of
   *  hasOnboarded/enabledKeys/subscription state. */
  isOwner: boolean;
  /** False only for a real, non-owner account with zero user_modules rows
   *  — i.e. it hasn't been through onboarding yet. Always true for the
   *  owner (who never sees onboarding), and always true once loading. */
  hasOnboarded: boolean;
  enabledKeys: Set<string>;
  canAccess: (moduleKey: string) => boolean;
  /** Writes the onboarding module picks. Always includes every module key
   *  when called for the owner is unnecessary (owner bypasses this
   *  entirely) — this is only ever invoked from the onboarding flow, which
   *  the owner never reaches. */
  saveModuleSelections: (keys: string[]) => Promise<void>;
}

export function useModuleAccess(): ModuleAccess {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(true);
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);

    // Email check first — works even if schema_023 hasn't been run yet or
    // the RPC call below fails for any reason. This is the check that
    // makes "the owner account is stranded" structurally impossible.
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user?.email === OWNER_EMAIL) {
      setIsOwner(true);
      setHasOnboarded(true);
      setEnabledKeys(new Set(MODULE_KEYS));
      setLoading(false);
      return;
    }

    // DB-side check second — is_owner() is SECURITY DEFINER and only ever
    // answers for auth.uid() itself, so this can't be used to probe other
    // accounts. Wrapped so a missing function (migration not run) or any
    // other RPC error doesn't throw — it just falls through to "not owner"
    // the same as a real, non-owner account would.
    let ownerResult = false;
    try {
      const { data, error } = await supabase.rpc('is_owner');
      ownerResult = data === true && !error;
    } catch {
      ownerResult = false;
    }
    if (ownerResult) {
      setIsOwner(true);
      setHasOnboarded(true);
      setEnabledKeys(new Set(MODULE_KEYS));
      setLoading(false);
      return;
    }
    setIsOwner(false);

    const { data } = await supabase.from('user_modules').select('module_key, enabled');
    const rows = data ?? [];
    setHasOnboarded(rows.length > 0);
    setEnabledKeys(new Set(rows.filter((r) => r.enabled).map((r) => r.module_key)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canAccess = (moduleKey: string) => isOwner || enabledKeys.has(moduleKey);

  const saveModuleSelections = async (keys: string[]) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const rows = keys.map((module_key) => ({ user_id: userId, module_key, enabled: true }));
    await supabase.from('user_modules').upsert(rows, { onConflict: 'user_id,module_key' });
    await load();
  };

  return { loading, isOwner, hasOnboarded, enabledKeys, canAccess, saveModuleSelections };
}
