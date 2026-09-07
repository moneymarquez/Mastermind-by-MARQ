import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Which of Marketing 101's five leaks this campaign is actually fixing —
 *  the brief's own diagnosis, not a guess made downstream. Asked before
 *  anything else per the doc's own "diagnose, then prescribe" rule. */
export type PrimaryLeak = 'positioning' | 'pricing' | 'conversion' | 'retention' | 'awareness';
export type BudgetPeriod = 'one_time' | 'monthly';
export type BriefStatus = 'draft' | 'ready';

export interface MarketingBrief {
  id: string;
  client_id: string;
  status: BriefStatus;

  primary_leak: PrimaryLeak | null;
  goal: string | null;
  budget_amount: number | null;
  budget_period: BudgetPeriod | null;
  budget_notes: string | null;
  timeline: string | null;

  avg_transaction_value: number | null;
  customer_ltv_notes: string | null;
  revenue_sources: string | null;
  repeat_customer_pct: number | null;
  last_price_change: string | null;
  competitor_diff: string | null;
  capacity_constraint: string | null;
  gross_margin: string | null;
  contact_to_customer_rate: string | null;
  biggest_constraint: string | null;

  target_audience: string | null;
  positioning_statement: string | null;
  must_avoid: string | null;

  created_at: string;
  updated_at: string;
}

export type MarketingBriefPatch = Partial<Omit<MarketingBrief, 'id' | 'client_id' | 'created_at' | 'updated_at'>>;

// Owner-only table (schema_069), same is_owner(auth.uid()) lock as every
// other marketing_* table — see the CRITICAL ACCESS RESTRICTION note in
// schema_025. No client-side owner check needed for the same reason
// useMarketing.ts has none: the database already refuses non-owner access.
export function useMarketingBriefs() {
  const [briefs, setBriefs] = useState<MarketingBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('marketing_briefs')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) setError(err.message);
    else setError('');
    setBriefs((data ?? []) as MarketingBrief[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createBrief = async (clientId: string): Promise<MarketingBrief | null> => {
    const { data, error: err } = await supabase
      .from('marketing_briefs')
      .insert({ client_id: clientId })
      .select('*')
      .single();
    if (err) {
      setError(err.message);
      return null;
    }
    await load();
    return data as MarketingBrief;
  };

  const updateBrief = async (id: string, patch: MarketingBriefPatch) => {
    const { error: err } = await supabase
      .from('marketing_briefs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  const removeBrief = async (id: string) => {
    const { error: err } = await supabase.from('marketing_briefs').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { briefs, loading, error, reload: load, createBrief, updateBrief, removeBrief };
}
