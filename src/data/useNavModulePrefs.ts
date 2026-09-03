import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PrefRow {
  module_key: string;
  hidden: boolean;
  sort_order: number | null;
}

/** This account's own nav preferences (schema_056_nav_module_order.sql,
 *  built on schema_055's hidden_nav_modules — renamed nav_module_prefs
 *  once it grew a second thing to remember): which modules are hidden
 *  from its own Sidebar/MobileMenuSheet, and where the rest sit relative
 *  to each other within their own category. Both are purely cosmetic —
 *  neither touches user_modules (real access) or a module's own data, so
 *  hiding or reordering something is always instantly and completely
 *  reversible. */
export function useNavModulePrefs() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nav_module_prefs').select('module_key, hidden, sort_order');
    const rows = (data ?? []) as PrefRow[];
    setHidden(new Set(rows.filter((r) => r.hidden).map((r) => r.module_key)));
    setOrder(Object.fromEntries(rows.filter((r) => r.sort_order !== null).map((r) => [r.module_key, r.sort_order as number])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setModuleHidden = async (moduleKey: string, hide: boolean) => {
    // Optimistic — a display-only preference with no real consequence if
    // a rare write races, so there's no reason to make the menu wait on
    // a round trip. Only the `hidden` column is sent, so an existing
    // sort_order on this row is left exactly as it was.
    setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(moduleKey);
      else next.delete(moduleKey);
      return next;
    });
    await supabase.from('nav_module_prefs').upsert({ module_key: moduleKey, hidden: hide }, { onConflict: 'user_id,module_key' });
  };

  /** Persists a full custom order for one category at once — every
   *  module key the account can currently see there, in the order it
   *  should render. Same "write an explicit position for the whole
   *  list" pattern as useClientCRM's reorderQuestions, so a category is
   *  always either fully untouched (registry order) or fully explicit,
   *  never a confusing partial mix. Only sort_order is sent, so nothing
   *  here touches whether any of them is hidden. */
  const reorderCategory = async (orderedModuleKeys: string[]) => {
    setOrder((prev) => ({ ...prev, ...Object.fromEntries(orderedModuleKeys.map((key, i) => [key, i])) }));
    await Promise.all(
      orderedModuleKeys.map((module_key, i) =>
        supabase.from('nav_module_prefs').upsert({ module_key, sort_order: i }, { onConflict: 'user_id,module_key' }),
      ),
    );
  };

  return { hidden, order, loading, setModuleHidden, reorderCategory, reload: load };
}
