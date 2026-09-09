import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AccountAuditResult } from '../lib/accountAuditAi';
import type { PrimaryGap } from '../lib/accountAuditAi';

export interface AccountAudit {
  id: string;
  client_id: string;
  plan_id: string;
  handle: string | null;
  posts_reviewed: number | null;
  stated_viewer: string | null;
  observed_pillars: string[];
  top_performers: { note: string }[];
  bottom_performers: { note: string }[];
  primary_gap: PrimaryGap | null;
  keep: string[];
  kill: string[];
  test: string[];
  created_at: string;
  updated_at: string;
}

/** One growth plan can have several audits over time — "re-runnable,
 *  monthly re-audit compares against the previous one." Loaded newest
 *  first so [0] is always the current audit and [1] the one to compare
 *  against. */
export function useAccountAudits(planId: string | null) {
  const [audits, setAudits] = useState<AccountAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!planId) {
      setAudits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('account_audits')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setError('');
    setAudits((data ?? []) as AccountAudit[]);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveAudit = async (
    clientId: string,
    planIdArg: string,
    handle: string,
    postsReviewed: number,
    statedViewer: string,
    result: AccountAuditResult,
  ) => {
    const { error: err } = await supabase.from('account_audits').insert({
      client_id: clientId,
      plan_id: planIdArg,
      handle: handle.trim() || null,
      posts_reviewed: postsReviewed,
      stated_viewer: statedViewer.trim() || null,
      observed_pillars: result.observed_pillars,
      top_performers: result.top_performers,
      bottom_performers: result.bottom_performers,
      primary_gap: result.primary_gap,
      keep: result.keep,
      kill: result.kill,
      test: result.test,
    });
    if (err) setError(err.message);
    await load();
  };

  return { audits, loading, error, reload: load, saveAudit };
}
