import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { Domain } from './ecom';
import type { WorkerRow, RunRow } from './useEngine';
import type { WorkerFacts } from './office';

export interface TaskRow { id: string; domain: string; body: string; worker_id: string | null; instructions: string | null; status: string; note: string | null; run_id: string | null; created_at: string }
export interface ThreadMessage { id: string; thread_id: string; role: 'user' | 'orchestrator'; body: string; proposal: Proposal[]; cost_usd: number; created_at: string }
export type Proposal =
  | { kind: 'rerun'; instructions: string; why: string; applied_at?: string }
  | { kind: 'playbook'; playbook: string; before: string; after: string; why: string; applied_at?: string }
  | { kind: 'settings'; model?: string; autonomy_level?: number; enabled?: boolean; why: string; applied_at?: string };
export interface ApprovalLite { id: string; run_id: string | null; worker_id: string | null; status: string; title: string; payload: Record<string, unknown>; my_note: string | null }

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Everything the office draws, live: workers, today's runs, approvals,
 *  tasks, and the module's daily summary. Realtime on ai_workers /
 *  ai_worker_runs / ai_tasks refreshes it; a new run fires onNewRun so the
 *  envelope animation is triggered by a real run, never a loop. */
export function useOffice(domain: Domain, onNewRun?: (run: RunRow) => void) {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalLite[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const cb = useRef(onNewRun); cb.current = onNewRun;

  const load = useCallback(async () => {
    const since = dayStart();
    const [w, r, a, t, s, m] = await Promise.all([
      supabase.from('ai_workers').select('*').in('domain', [domain, 'all']).order('created_at'),
      supabase.from('ai_worker_runs').select('*').in('domain', [domain, 'all']).gte('created_at', since).order('created_at', { ascending: false }).limit(200),
      supabase.from('ai_approvals').select('id,run_id,worker_id,status,title,payload,my_note').eq('domain', domain).order('created_at', { ascending: false }).limit(200),
      supabase.from('ai_tasks').select('*').eq('domain', domain).gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('ai_daily_summaries').select('summary_text').eq('domain', domain === 'marketing' ? 'marketing' : domain).eq('date', localDay()).maybeSingle(),
      supabase.from('ai_thread_messages').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
    ]);
    setWorkers((w.data ?? []) as WorkerRow[]); setRuns((r.data ?? []) as RunRow[]); setApprovals((a.data ?? []) as ApprovalLite[]);
    setTasks((t.data ?? []) as TaskRow[]); setSummary((s.data as { summary_text?: string } | null)?.summary_text ?? null); setMessages((m.data ?? []) as ThreadMessage[]);
    setLoading(false);
  }, [domain]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`office-${domain}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_workers' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_tasks' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_worker_runs' }, (payload) => {
        if (payload.eventType === 'INSERT') cb.current?.(payload.new as RunRow);
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [domain, load]);

  const facts: Record<string, WorkerFacts> = {};
  for (const w of workers) {
    const mine = runs.filter((r) => r.worker_id === w.id);
    facts[w.id] = { runsToday: mine.length, lastRunFailed: mine[0]?.status === 'failed', pendingApprovals: approvals.filter((a) => a.worker_id === w.id && a.status === 'pending').length };
  }
  return { workers, runs, approvals, tasks, summary, messages, facts, loading, reload: load };
}

export const assignTask = (domain: string, text: string) => api<{ task_id?: string; worker?: string | null; reply?: string; run?: { ok: boolean; count?: number; error?: string } }>('/api/office/assign', { body: { domain, text } });
export const raiseWithOrchestrator = (runId: string, message: string, threadId?: string) => api<{ thread_id: string; message_id: string; reply: string; proposals: Proposal[]; cost_usd: number }>('/api/office/raise', { body: { run_id: runId, message, thread_id: threadId } });
export const applyProposal = (messageId: string, index: number) => api<{ ok: boolean; playbook?: string; version?: number; mode?: string; rerun?: { ok: boolean; count?: number; error?: string } }>('/api/office/apply', { body: { message_id: messageId, index } });
export async function threadFor(runId: string): Promise<{ threadId: string | null; messages: ThreadMessage[] }> {
  const { data } = await supabase.from('ai_threads').select('id').eq('run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const id = (data as { id: string } | null)?.id ?? null;
  if (!id) return { threadId: null, messages: [] };
  const m = await supabase.from('ai_thread_messages').select('*').eq('thread_id', id).order('created_at');
  return { threadId: id, messages: (m.data ?? []) as ThreadMessage[] };
}
