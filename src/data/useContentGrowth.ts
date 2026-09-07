import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type GrowthPlatform = 'instagram' | 'tiktok' | 'youtube_shorts' | 'youtube_long' | 'linkedin' | 'facebook' | 'twitter';
export type GrowthPhase = 'setup' | 'volume' | 'pattern_finding' | 'concentration';

export interface ContentGrowthPlan {
  id: string;
  client_id: string;
  platform: GrowthPlatform;
  account_handle: string | null;
  target_followers: number | null;
  starting_followers: number | null;
  phase: GrowthPhase;
  niche_viewer: string | null;
  pillars: string[];
  started_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCheckin {
  id: string;
  plan_id: string;
  checkin_date: string;
  follower_count: number;
  posts_count: number | null;
  what_worked: string | null;
  what_to_change: string | null;
  created_at: string;
}

type PlanPatch = Partial<Pick<ContentGrowthPlan, 'account_handle' | 'target_followers' | 'starting_followers' | 'phase' | 'niche_viewer' | 'pillars' | 'notes'>>;
type CheckinInput = { follower_count: number; posts_count?: number | null; what_worked?: string | null; what_to_change?: string | null; checkin_date?: string };

// Owner-only tables (schema_070), same lock as every other Marketing/
// Scaling table — no client-side owner check needed for the same reason
// useMarketing.ts has none.
export function useContentGrowth() {
  const [plans, setPlans] = useState<ContentGrowthPlan[]>([]);
  const [checkins, setCheckins] = useState<ContentCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [plansRes, checkinsRes] = await Promise.all([
      supabase.from('content_growth_plans').select('*').order('created_at', { ascending: false }),
      supabase.from('content_checkins').select('*').order('checkin_date', { ascending: false }),
    ]);
    if (plansRes.error) setError(plansRes.error.message);
    else if (checkinsRes.error) setError(checkinsRes.error.message);
    else setError('');
    setPlans((plansRes.data ?? []) as ContentGrowthPlan[]);
    setCheckins((checkinsRes.data ?? []) as ContentCheckin[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createPlan = async (input: {
    client_id: string;
    platform: GrowthPlatform;
    account_handle?: string | null;
    target_followers?: number | null;
    starting_followers?: number | null;
  }): Promise<ContentGrowthPlan | null> => {
    const { data, error: err } = await supabase.from('content_growth_plans').insert(input).select('*').single();
    if (err) {
      setError(err.message);
      return null;
    }
    await load();
    return data as ContentGrowthPlan;
  };

  const updatePlan = async (id: string, patch: PlanPatch) => {
    const { error: err } = await supabase.from('content_growth_plans').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  const removePlan = async (id: string) => {
    const { error: err } = await supabase.from('content_growth_plans').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  const addCheckin = async (planId: string, input: CheckinInput) => {
    const { error: err } = await supabase.from('content_checkins').insert({ plan_id: planId, ...input });
    if (err) setError(err.message);
    await load();
  };

  const removeCheckin = async (id: string) => {
    const { error: err } = await supabase.from('content_checkins').delete().eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  return { plans, checkins, loading, error, reload: load, createPlan, updatePlan, removePlan, addCheckin, removeCheckin };
}
