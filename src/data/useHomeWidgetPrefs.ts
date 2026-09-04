import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PrefRow {
  widget_key: string;
  hidden: boolean;
  sort_order: number | null;
}

/** This account's own Overview widget preferences
 *  (schema_058_home_widget_prefs.sql) — which widgets are hidden from
 *  its own Overview screen, and where the rest sit relative to each
 *  other. Identical shape and identical semantics to useNavModulePrefs
 *  (nav_module_prefs), just for src/data/homeWidgets.ts's registry
 *  instead of the nav's modules. Purely cosmetic — hiding or reordering
 *  a widget never touches that module's real data, so it's always fully
 *  reversible. */
export function useHomeWidgetPrefs() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<Record<string, number>>({});
  // Every widget_key with ANY saved row, hidden or not — distinct from
  // `hidden` because a defaultHidden registry widget (see homeWidgets.ts)
  // needs to tell "never touched, stays off by default" apart from
  // "explicitly turned back on" (hidden=false written), and both of those
  // collapse to "not in the hidden set" on their own.
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('home_widget_prefs').select('widget_key, hidden, sort_order');
    const rows = (data ?? []) as PrefRow[];
    setHidden(new Set(rows.filter((r) => r.hidden).map((r) => r.widget_key)));
    setKnown(new Set(rows.map((r) => r.widget_key)));
    setOrder(Object.fromEntries(rows.filter((r) => r.sort_order !== null).map((r) => [r.widget_key, r.sort_order as number])));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setWidgetHidden = async (widgetKey: string, hide: boolean) => {
    // Optimistic, same reasoning as useNavModulePrefs.setModuleHidden — a
    // display-only preference, no reason to make the toggle wait on a
    // round trip. Only `hidden` is sent, so an existing sort_order is
    // left untouched.
    setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(widgetKey);
      else next.delete(widgetKey);
      return next;
    });
    setKnown((prev) => new Set(prev).add(widgetKey));
    await supabase.from('home_widget_prefs').upsert({ widget_key: widgetKey, hidden: hide }, { onConflict: 'user_id,widget_key' });
  };

  /** Persists a full custom order at once — every widget key currently
   *  in the registry, in the order it should render. Same "write an
   *  explicit position for the whole list" pattern as
   *  useNavModulePrefs.reorderCategory, so the order is either fully
   *  untouched (registry default) or fully explicit, never a partial
   *  mix from one write. Only sort_order is sent, so this never touches
   *  whether anything is hidden. */
  const reorderWidgets = async (orderedWidgetKeys: string[]) => {
    setOrder((prev) => ({ ...prev, ...Object.fromEntries(orderedWidgetKeys.map((key, i) => [key, i])) }));
    await Promise.all(
      orderedWidgetKeys.map((widget_key, i) =>
        supabase.from('home_widget_prefs').upsert({ widget_key, sort_order: i }, { onConflict: 'user_id,widget_key' }),
      ),
    );
  };

  return { hidden, order, known, loading, setWidgetHidden, reorderWidgets, reload: load };
}
