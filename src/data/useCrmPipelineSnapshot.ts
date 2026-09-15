import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientStage } from './types';

/** Just stage counts across every crm_clients row — kept as its own tiny
 *  query (not useClientCRM's full load, which also pulls audits/pricing/
 *  invoices/services) since the Client CRM Overview widget only needs
 *  "how many clients are in each stage right now." */
export function useCrmPipelineSnapshot() {
  const [counts, setCounts] = useState<Record<ClientStage, number>>({
    new_lead: 0, discovery_complete: 0, analysis_sent: 0, invoice_sent: 0, active: 0, retainer: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('crm_clients').select('stage');
    const rows = (data ?? []) as { stage: ClientStage }[];
    const next: Record<ClientStage, number> = { new_lead: 0, discovery_complete: 0, analysis_sent: 0, invoice_sent: 0, active: 0, retainer: 0 };
    for (const r of rows) next[r.stage] = (next[r.stage] ?? 0) + 1;
    setCounts(next);
    setTotal(rows.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { counts, total, loading };
}
