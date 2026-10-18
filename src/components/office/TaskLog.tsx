import { useState } from 'react';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import { field } from '../mm/Page';

export interface LogTask { id: string; created_at: string; instructions: string | null; body: string; note: string | null; status: string; worker_id?: string | null }
export interface LogRun { id: string; created_at: string; summary: string | null; error: string | null; status: string; cost_usd: number; trigger: string; worker_id: string | null }

/** Everything the orchestrators and workers did, newest first — Marq's
 *  audit trail for "is anyone doing it wrong" (brief §2.4). */
export default function TaskLog({ tasks, runs, workerName }: { tasks: LogTask[]; runs: LogRun[]; workerName?: (id: string | null | undefined) => string | null }) {
  const [status, setStatus] = useState<'all' | 'failed' | 'done'>('all');
  const [who, setWho] = useState('all');
  const rows = [
    ...tasks.map((t) => ({ id: `t${t.id}`, at: t.created_at, what: t.instructions ?? t.body, result: t.note ?? '', status: t.status, cost: null as number | null, worker: t.worker_id ?? null, kind: 'task' })),
    ...runs.map((r) => ({ id: `r${r.id}`, at: r.created_at, what: r.summary ?? `${r.trigger} run`, result: r.error ?? '', status: r.status, cost: Number(r.cost_usd), worker: r.worker_id, kind: 'run' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).filter((r) => (status === 'all' || r.status === status) && (who === 'all' || r.worker === who));
  const workers = [...new Set([...tasks.map((t) => t.worker_id), ...runs.map((r) => r.worker_id)].filter(Boolean))] as string[];
  return (
    <Card title="Task log" meta="every task and run, newest first" flush action={
      <span style={{ display: 'flex', gap: 6 }}>
        {workerName && <select aria-label="Worker" value={who} onChange={(e) => setWho(e.target.value)} style={{ ...field, height: 32, width: 'auto', fontSize: 13 }}><option value="all">Everyone</option>{workers.map((w) => <option key={w} value={w}>{workerName(w) ?? 'Worker'}</option>)}</select>}
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ ...field, height: 32, width: 'auto', fontSize: 13 }}><option value="all">All</option><option value="done">Done</option><option value="failed">Failed</option></select>
      </span>}>
      {rows.length === 0 ? <div style={{ padding: '4px 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>Nothing logged yet.</div> : rows.slice(0, 150).map((r, i) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) auto', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 13.5, alignItems: 'start' }}>
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.4 }}>{new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<br />{new Date(r.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          <span style={{ minWidth: 0 }}>{workerName && r.worker && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{workerName(r.worker)} · </span>}<span style={{ color: 'var(--text)' }}>{r.what}</span>{r.result && <span style={{ display: 'block', color: r.status === 'failed' ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 2 }}>{r.result}</span>}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{r.cost != null && r.cost > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>${r.cost.toFixed(3)}</span>}<Chip k={r.status === 'done' ? 'good' : r.status === 'failed' ? 'bad' : 'neutral'}>{r.status}</Chip></span>
        </div>
      ))}
    </Card>
  );
}
