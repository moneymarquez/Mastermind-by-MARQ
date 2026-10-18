import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PortalKey } from '../portals.config';

/** One open status flag (worker/lib/flags.ts writes them every 5 minutes). */
export interface FlagRow { id: string; domain: string; entity_type: string; entity_id: string; severity: 'amber' | 'red'; rule: string; message: string; link: string | null; opened_at: string }

/** Which flag domains each portal's top bar counts. */
export const PORTAL_FLAG_DOMAINS: Record<PortalKey, string[]> = {
  masterminds: ['master', 'personal'],
  madeby: ['madeby', 'marketing', 'master'],
  content: ['content'],
  ecommerce: ['ecommerce'],
};

const rank = (s: string | undefined) => (s === 'red' ? 0 : s === 'amber' ? 1 : 2);
/** Red first, then amber, then the rest; stable otherwise. */
export function sortBySeverity<T>(rows: T[], sev: (r: T) => string | undefined): T[] {
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(sev(a.r)) - rank(sev(b.r)) || a.i - b.i).map((x) => x.r);
}

let cache: FlagRow[] = [];
let loadedAt = 0;
const subs = new Set<(f: FlagRow[]) => void>();
async function fetchFlags(): Promise<FlagRow[]> {
  const { data, error } = await supabase.from('ai_flags').select('id,domain,entity_type,entity_id,severity,rule,message,link,opened_at').is('resolved_at', null).order('opened_at', { ascending: false }).limit(300);
  // Before schema_121 the table doesn't exist: no flags, not an error screen.
  cache = error ? [] : ((data ?? []) as FlagRow[]);
  loadedAt = Date.now();
  for (const s of subs) s(cache);
  return cache;
}

/** Shared, lightly cached open flags for owner screens. */
export function useFlags(enabled = true) {
  const [flags, setFlags] = useState<FlagRow[]>(cache);
  useEffect(() => {
    if (!enabled) return;
    subs.add(setFlags);
    if (Date.now() - loadedAt > 30000) void fetchFlags();
    const t = setInterval(() => void fetchFlags(), 60000);
    return () => { subs.delete(setFlags); clearInterval(t); };
  }, [enabled]);
  const reload = useCallback(() => fetchFlags(), []);
  const index = useMemo(() => {
    const m = new Map<string, FlagRow>();
    for (const f of flags) { const k = `${f.entity_type}:${f.entity_id}`; const cur = m.get(k); if (!cur || rank(f.severity) < rank(cur.severity)) m.set(k, f); }
    return m;
  }, [flags]);
  return {
    flags, reload,
    /** Worst open flag on one thing (a brand, a worker, an approval…). */
    flagFor: (entityType: string, entityId: string) => index.get(`${entityType}:${entityId}`) ?? null,
    redsIn: (domains: string[]) => flags.filter((f) => f.severity === 'red' && domains.includes(f.domain)).length,
    inDomain: (domains: string[]) => sortBySeverity(flags.filter((f) => domains.includes(f.domain)), (f) => f.severity),
  };
}
