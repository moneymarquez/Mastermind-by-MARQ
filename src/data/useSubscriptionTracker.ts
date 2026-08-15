import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export interface TrackedSubscription {
  id: string;
  name: string;
  cost: number;
  billing_cycle: BillingCycle;
  renewal_date: string;
  category: string | null;
  last_marked_used_at: string | null;
}

/** Normalizes any billing cycle to a monthly figure so totals are comparable. */
export function monthlyCost(sub: Pick<TrackedSubscription, 'cost' | 'billing_cycle'>): number {
  if (sub.billing_cycle === 'weekly') return sub.cost * 52 / 12;
  if (sub.billing_cycle === 'yearly') return sub.cost / 12;
  return sub.cost;
}

/** A subscription is flagged for review once it's gone unmarked-as-used for
 *  45+ days (or was never marked used at all, past that same window since
 *  it was added) — the "surface it for review" requirement. */
const STALE_DAYS = 45;
export function isStale(sub: TrackedSubscription): boolean {
  const ref = sub.last_marked_used_at;
  if (!ref) return true;
  const days = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
  return days >= STALE_DAYS;
}

export function useSubscriptionTracker() {
  const [subscriptions, setSubscriptions] = useState<TrackedSubscription[]>([]);
  const [mastermindMonthlyCost, setMastermindMonthlyCost] = useState(49);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [subRes, settingsRes] = await Promise.all([
      supabase.from('tracked_subscriptions').select('*').order('renewal_date'),
      supabase.from('budget_settings').select('mastermind_monthly_cost').maybeSingle(),
    ]);
    setSubscriptions(((subRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, name: r.name as string, cost: Number(r.cost), billing_cycle: r.billing_cycle as BillingCycle,
      renewal_date: r.renewal_date as string, category: r.category as string | null, last_marked_used_at: r.last_marked_used_at as string | null,
    })));
    if (settingsRes.data) setMastermindMonthlyCost(Number(settingsRes.data.mastermind_monthly_cost));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSubscription = async (input: Omit<TrackedSubscription, 'id' | 'last_marked_used_at'>) => {
    await supabase.from('tracked_subscriptions').insert({ ...input, last_marked_used_at: new Date().toISOString() });
    await load();
  };
  const removeSubscription = async (id: string) => {
    await supabase.from('tracked_subscriptions').delete().eq('id', id);
    await load();
  };
  const markUsed = async (id: string) => {
    await supabase.from('tracked_subscriptions').update({ last_marked_used_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  const setMastermindCost = async (value: number) => {
    setMastermindMonthlyCost(value);
    await supabase.from('budget_settings').upsert({ mastermind_monthly_cost: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  const totalMonthly = subscriptions.reduce((s, sub) => s + monthlyCost(sub), 0);
  const totalAnnual = totalMonthly * 12;
  const upcomingRenewals = subscriptions
    .filter((s) => {
      const days = (new Date(s.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));
  const staleSubscriptions = subscriptions.filter(isStale);

  return {
    loading, subscriptions, mastermindMonthlyCost,
    addSubscription, removeSubscription, markUsed, setMastermindCost,
    totalMonthly, totalAnnual, upcomingRenewals, staleSubscriptions,
  };
}
