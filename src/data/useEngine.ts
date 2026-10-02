import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Domain } from './ecom';
import { PLAYBOOK_MAX_CHARS } from './ecom';

export interface WorkerRow { id: string; domain: string; key: string; name: string; role: string; model: string; autonomy_level: number; status: 'idle' | 'running' | 'failed' | 'disabled'; current_task: string | null; enabled: boolean; updated_at: string }
export interface RunRow { id: string; worker_id: string | null; domain: string; status: 'queued' | 'running' | 'done' | 'failed'; input: Record<string, unknown>; output: Record<string, unknown>; summary: string | null; error: string | null; cost_usd: number; tokens_in: number; tokens_out: number; trigger: string; instructions: string | null; started_at: string | null; finished_at: string | null; created_at: string }
export interface WorkerStats { runsToday: number; costToday: number; approved: number; decided: number; lastRun: RunRow | null }

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

/** Live roster for one domain (plus the shared orchestrator), with today's
 *  runs, cost and a 14-day approval rate per worker. */
export function useWorkers(domain: Domain) {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [stats, setStats] = useState<Record<string, WorkerStats>>({});
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const [w, r, a, c] = await Promise.all([
      supabase.from('ai_workers').select('*').in('domain', [domain, 'all']).order('created_at'),
      supabase.from('ai_worker_runs').select('*').in('domain', [domain, 'all']).order('created_at', { ascending: false }).limit(200),
      supabase.from('ai_approvals').select('worker_id,status,decided_at').not('worker_id', 'is', null).gte('created_at', since14),
      supabase.from('ai_cost_ledger').select('worker_id,cost_usd,date').gte('created_at', dayStart()),
    ]);
    const ws = (w.data ?? []) as WorkerRow[];
    const rs = (r.data ?? []) as RunRow[];
    const st: Record<string, WorkerStats> = {};
    for (const x of ws) st[x.id] = { runsToday: 0, costToday: 0, approved: 0, decided: 0, lastRun: null };
    const today = dayStart();
    for (const run of rs) if (run.worker_id && st[run.worker_id]) { if (run.created_at >= today) st[run.worker_id].runsToday++; st[run.worker_id].lastRun ??= run; }
    for (const ap of (a.data ?? []) as { worker_id: string; status: string }[]) if (st[ap.worker_id] && ap.status !== 'pending') { st[ap.worker_id].decided++; if (ap.status === 'approved') st[ap.worker_id].approved++; }
    for (const l of (c.data ?? []) as { worker_id: string | null; cost_usd: number }[]) if (l.worker_id && st[l.worker_id]) st[l.worker_id].costToday += Number(l.cost_usd);
    setWorkers(ws); setRuns(rs); setStats(st); setLoading(false);
  }, [domain]);
  useEffect(() => { load(); }, [load]);
  const setAutonomy = async (id: string, level: number) => { await supabase.from('ai_workers').update({ autonomy_level: level, updated_at: new Date().toISOString() }).eq('id', id); await load(); };
  const setEnabled = async (id: string, enabled: boolean) => { await supabase.from('ai_workers').update({ enabled, status: enabled ? 'idle' : 'disabled', updated_at: new Date().toISOString() }).eq('id', id); await load(); };
  return { workers, runs, stats, loading, reload: load, setAutonomy, setEnabled };
}

export interface RunResult { ok: boolean; runId?: string; approvalId?: string; summary?: string; count?: number; dropped?: string[]; costUsd?: number; searches?: number; error?: string; capReached?: boolean }
export interface RunRes extends RunResult { skipped?: boolean }
export const runScout = (channel: string, count: number, instructions?: string) => api<RunRes>('/api/engine/run', { body: { worker: 'scout', channel, count, instructions } });
/** Any live worker: body carries what that worker needs (product_id,
 *  venture, script_channel, all…). */
export const runWorkerNow = (worker: string, body: Record<string, unknown>) => api<RunRes>('/api/engine/run', { body: { worker, ...body } });

// ── The Orchestrator's overnight plan ─────────────────────────────────
export interface DailyTask { id: string; body: string; status: string; note: string | null; created_at: string }
export interface DailyPlan { date: string; plan: { key: string; worker: string | null; label: string }[]; tasks: DailyTask[]; summary: { date: string; summary_text: string; numbers: Record<string, unknown> } | null }
export const getDailyPlan = () => api<DailyPlan>('/api/engine/daily', { method: 'GET' });
export const runDailyStep = () => api<{ date: string; done: boolean; step: { step: { key: string; label: string }; status: string; note: string } | null }>('/api/engine/daily', { method: 'POST' });
export const decideApproval = (approvalId: string, status: 'approved' | 'sent_back' | 'killed', note?: string | null, rerun?: boolean, choice?: number) =>
  api<{ ok: boolean; applied?: Record<string, unknown> | null; rerun?: RunResult; error?: string }>('/api/engine/decide', { body: { approval_id: approvalId, status, note, rerun, choice } });
export const startCompany = () => api<{ workers: WorkerRow[]; anthropic: boolean }>('/api/engine/start', { method: 'POST' });

// ── Playbooks ─────────────────────────────────────────────────────────
export interface Playbook { id: string; name: string; domain: string; body: string; version: number; change_reason: string | null; updated_at: string }
export interface PlaybookVersion { id: string; playbook_id: string; version: number; body: string; change_reason: string | null; thread_id: string | null; created_at: string }

/** The playbooks every orchestrator and worker loads (Appendix 1 §1). The
 *  psychology playbook is domain 'all' so every module reads it. */
export const STARTER_PLAYBOOKS: { name: string; domain: string; hint: string }[] = [
  { name: 'Psychology', domain: 'all', hint: 'The principles every recommendation must cite: anchoring, social proof, loss aversion, reciprocity… with how you want each used and never used.' },
  { name: 'E-commerce', domain: 'ecom', hint: 'What makes a product worth testing, your price and margin rules, kill and double-down rules, channels you trust.' },
  { name: 'Website design', domain: 'ecom', hint: 'Store layout rules and the "doesn\'t look AI-made" list — fonts, spacing, photos, copy tells to avoid.' },
  { name: 'Content', domain: 'content', hint: 'Hooks that work for you, formats, lengths, posting times, what you will never post.' },
  { name: 'Marketing', domain: 'marketing', hint: 'Who you sell to, the two packages, objections and answers, calling rules, what a good week looks like.' },
];

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('ai_playbooks').select('*').order('domain').order('name');
    if (e) setError(e.message); else setError('');
    let rows = (data ?? []) as Playbook[];
    if (!e && rows.length === 0) {
      await supabase.from('ai_playbooks').upsert(STARTER_PLAYBOOKS.map((p) => ({ name: p.name, domain: p.domain, body: '' })), { onConflict: 'user_id,name', ignoreDuplicates: true });
      rows = ((await supabase.from('ai_playbooks').select('*').order('domain').order('name')).data ?? []) as Playbook[];
    }
    setPlaybooks(rows); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  /** Every save is a new version with its reason; the row holds the latest. */
  const save = async (p: Playbook, body: string, reason: string, threadId: string | null = null): Promise<boolean> => {
    if (body.length > PLAYBOOK_MAX_CHARS) { setError(`Playbooks can be up to ${PLAYBOOK_MAX_CHARS.toLocaleString()} characters; this one is ${body.length.toLocaleString()}.`); return false; }
    const version = p.body.trim() || p.version > 1 ? p.version + 1 : 1;
    if (p.body.trim() && p.version === 1) {
      // Keep v1's text in history before it's replaced.
      await supabase.from('ai_playbook_versions').upsert({ playbook_id: p.id, version: 1, body: p.body, change_reason: p.change_reason ?? 'first version' }, { onConflict: 'playbook_id,version', ignoreDuplicates: true });
    }
    const { error: e1 } = await supabase.from('ai_playbooks').update({ body, version, change_reason: reason, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (e1) { setError(e1.message); return false; }
    await supabase.from('ai_playbook_versions').upsert({ playbook_id: p.id, version, body, change_reason: reason, thread_id: threadId }, { onConflict: 'playbook_id,version' });
    await load();
    return true;
  };
  const create = async (name: string, domain: string) => {
    const { error: e } = await supabase.from('ai_playbooks').insert({ name, domain, body: '' });
    if (e) setError(e.message);
    await load();
  };
  const versions = async (playbookId: string): Promise<PlaybookVersion[]> => {
    const { data } = await supabase.from('ai_playbook_versions').select('*').eq('playbook_id', playbookId).order('version', { ascending: false });
    return (data ?? []) as PlaybookVersion[];
  };
  /** Empty a playbook. Saved as a new version, so it's reversible until
   *  the old version is deleted from history. */
  const clear = (p: Playbook) => save(p, '', 'Cleared');
  /** Move a playbook's text into another one (replace or append), then
   *  clear the source — for when something went in the wrong tab. */
  const moveTo = async (src: Playbook, target: Playbook, mode: 'replace' | 'append'): Promise<boolean> => {
    const body = mode === 'append' && target.body.trim() ? `${target.body.trimEnd()}\n\n${src.body.trim()}` : src.body.trim();
    if (body.length > PLAYBOOK_MAX_CHARS) { setError(`${target.name} would be ${body.length.toLocaleString()} characters — over the ${PLAYBOOK_MAX_CHARS.toLocaleString()} limit. Use Replace, or trim first.`); return false; }
    if (!(await save(target, body, `Moved from ${src.name}`))) return false;
    const fresh = ((await supabase.from('ai_playbooks').select('*').eq('id', src.id).single()).data ?? src) as Playbook;
    return save(fresh, '', `Moved to ${target.name}`);
  };
  /** Delete one old version from history for good. */
  const deleteVersion = async (v: PlaybookVersion): Promise<boolean> => {
    const { error: e } = await supabase.from('ai_playbook_versions').delete().eq('id', v.id);
    if (e) { setError(e.message); return false; }
    await load();
    return true;
  };
  /** Delete a playbook you added (the five starters can be cleared, not deleted). */
  const remove = async (p: Playbook): Promise<boolean> => {
    const { error: e } = await supabase.from('ai_playbooks').delete().eq('id', p.id);
    if (e) { setError(e.message); return false; }
    await load();
    return true;
  };
  return { playbooks, loading, error, reload: load, save, create, versions, clear, moveTo, deleteVersion, remove };
}
