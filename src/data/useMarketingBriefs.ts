import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Which of Marketing 101's five leaks this campaign is actually fixing —
 *  the brief's own diagnosis, not a guess made downstream. Asked before
 *  anything else per the doc's own "diagnose, then prescribe" rule. */
export type PrimaryLeak = 'positioning' | 'pricing' | 'conversion' | 'retention' | 'awareness';

// Ordered exactly as Marketing 101 Fundamentals Part 1's own diagnostic
// order — positioning and pricing before conversion, conversion before
// retention, awareness last — because "fixing a later leak while an
// earlier one is open wastes money, but fixing an earlier one while a
// later one is open wastes more." The "test" text is the doc's own
// diagnostic test for that leak, not a paraphrase, so picking one is
// actually running the diagnosis, not just labeling it after the fact.
// Single source of truth — both the diagnosis header (setting/overriding
// the leak) and anything else that needs the five options read from here.
export const LEAKS: { key: PrimaryLeak; label: string; test: string }[] = [
  { key: 'positioning', label: 'Positioning', test: 'Can they say in one sentence why someone picks them over the place down the street — without saying "quality" or "service"? If no, this is it.' },
  { key: 'pricing', label: 'Pricing', test: 'Busy but broke? If a 10% price increase would lose fewer than 10% of customers — and it almost always would — they\'re underpriced.' },
  { key: 'conversion', label: 'Conversion', test: 'Decent traffic or foot traffic, weak sales — "lookers, not buyers"? Check what % of contacts become customers.' },
  { key: 'retention', label: 'Retention', test: 'Under 30% of this month\'s revenue from someone who bought before? They buy once and never come back.' },
  { key: 'awareness', label: 'Awareness', test: 'If 100 ideal customers showed up tomorrow, would they convert? If yes — and reach is genuinely the gap — it\'s this one.' },
];
export type BudgetPeriod = 'one_time' | 'monthly';
export type BriefStatus = 'draft' | 'ready';

export interface MarketingBrief {
  id: string;
  client_id: string;
  status: BriefStatus;

  primary_leak: PrimaryLeak | null;
  /** Why this leak, in the operator's own words — required whenever they
   *  set or override the diagnosis from the header (schema_073). */
  leak_note: string | null;
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
