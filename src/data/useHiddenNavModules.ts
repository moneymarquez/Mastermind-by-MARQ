import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Which of the current account's own modules are hidden from its own
 *  nav (schema_055) — purely a display preference. Hiding a module never
 *  touches user_modules (real access) or any of the module's own data;
 *  it only removes the row from Sidebar/MobileMenuSheet's list. Toggle
 *  it back on and it reappears exactly where it was, with everything it
 *  had still there. */
export function useHiddenNavModules() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('hidden_nav_modules').select('module_key');
    setHidden(new Set((data ?? []).map((r) => r.module_key as string)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setModuleHidden = async (moduleKey: string, hide: boolean) => {
    // Optimistic — this is a display-only preference with no real
    // consequence if a rare write races, so there's no reason to make
    // the menu wait on a round trip to update.
    setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(moduleKey);
      else next.delete(moduleKey);
      return next;
    });
    if (hide) {
      await supabase.from('hidden_nav_modules').upsert({ module_key: moduleKey }, { onConflict: 'user_id,module_key' });
    } else {
      await supabase.from('hidden_nav_modules').delete().eq('module_key', moduleKey);
    }
  };

  return { hidden, loading, setModuleHidden, isHidden: (key: string) => hidden.has(key), reload: load };
}
