import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { M0Row, M0Venture } from './stageZero';

export interface M0Site { venture: M0Venture; hostname: string | null; site_tag: string | null }

export function useStageZero() {
  const [rows, setRows] = useState<M0Row[]>([]);
  const [sites, setSites] = useState<M0Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [f, s] = await Promise.all([supabase.from('mkt_foundation').select('*'), supabase.from('mkt_sites').select('venture,hostname,site_tag')]);
    if (f.error) setError(f.error.message); else setError('');
    setRows((f.data ?? []) as M0Row[]); setSites((s.data ?? []) as M0Site[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const mark = async (venture: M0Venture, key: string, done: boolean, proof?: string | null) => {
    const { error: e } = await supabase.from('mkt_foundation').upsert({ venture, item_key: key, done, done_at: done ? new Date().toISOString() : null, ...(proof !== undefined ? { proof_url: proof || null } : {}), updated_at: new Date().toISOString() }, { onConflict: 'user_id,venture,item_key' });
    if (e) setError(e.message);
    await load();
  };
  const saveProof = async (venture: M0Venture, key: string, proof: string) => {
    const existing = rows.find((r) => r.venture === venture && r.item_key === key);
    await mark(venture, key, existing?.done ?? false, proof);
  };
  const saveSite = async (venture: M0Venture, hostname: string, siteTag: string) => {
    const { error: e } = await supabase.from('mkt_sites').upsert({ venture, hostname: hostname || null, site_tag: siteTag || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,venture' });
    if (e) setError(e.message);
    await load();
  };
  return { rows, sites, loading, error, reload: load, mark, saveProof, saveSite };
}
