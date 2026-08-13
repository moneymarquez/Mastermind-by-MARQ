import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MODULE_KEYS } from '../modules.config';

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
    // First and only question that matters before anything else: is this
    // the owner? is_owner() is SECURITY DEFINER and only ever answers for
    // auth.uid() itself, so this can't be used to probe other accounts.
    const { data: ownerResult } = await supabase.rpc('is_owner');
    if (ownerResult === true) {
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
