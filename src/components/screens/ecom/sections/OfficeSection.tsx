import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { api } from '../../../../lib/api';
import { ALLOWED_MODELS } from '../../../../data/models';
import { money, ago } from '../../../../data/ecom';
import { useFlags } from '../../../../data/useFlags';
import { buildGraphData } from '../../../../data/officeGraph';
import type { GWorker, GHandoff } from '../../../../data/officeGraph';
import OfficeGraph from '../../../office/OfficeGraph';
import type { GraphNode } from '../../../office/OfficeGraph';
import TaskLog from '../../../office/TaskLog';
import type { LogRun, LogTask } from '../../../office/TaskLog';
import OfficeView from '../../../office/OfficeView';
import Thumbs from '../../../mm/Thumbs';
import Card from '../../../mm/Card';
import { Sheet } from '../../../mm/Page';
import { KillSwitch, useHqStatus } from '../../hq/HqScreen';
import WorkersTab from '../WorkersTab';
import { E, Badge, btn, field } from '../ecomShared';

type Run = LogRun & { cost_usd: number };

/** Office = the command center (brief §2.4): the live graph, a node drawer
 *  (last runs, cost, 👍/👎, enable, model override), the task log, the
 *  orchestrator chat and the kill switch. */
export default function OfficeSection({ onRan }: { onRan: () => void }) {
  const [workers, setWorkers] = useState<GWorker[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tasks, setTasks] = useState<LogTask[]>([]);
  const [handoffs, setHandoffs] = useState<GHandoff[]>([]);
  const [pick, setPick] = useState<GraphNode | null>(null);
  const [floor, setFloor] = useState(false);
  const [tick, setTick] = useState(0);
  const flags = useFlags(true);
  const hq = useHqStatus();
  useEffect(() => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    Promise.all([
      supabase.from('ai_workers').select('id,key,name,domain,enabled,status,model').order('created_at'),
      supabase.from('ai_worker_runs').select('id,worker_id,status,created_at,cost_usd,summary,error,trigger').gte('created_at', since).order('created_at', { ascending: false }).limit(300),
      supabase.from('ai_tasks').select('id,created_at,instructions,body,note,status,worker_id').order('created_at', { ascending: false }).limit(60),
      supabase.from('ai_handoffs').select('from_domain,to_domain,kind,status').in('status', ['open', 'working']).limit(30),
    ]).then(([w, r, t, h]) => {
      setWorkers((w.data ?? []) as GWorker[]);
      setRuns((r.data ?? []) as Run[]);
      setTasks((t.data ?? []) as LogTask[]);
      setHandoffs(h.error ? [] : ((h.data ?? []) as GHandoff[]));
    });
  }, [tick]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 20000); return () => clearInterval(t); }, []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRuns = useMemo(() => runs.filter((r) => new Date(r.created_at) >= today), [runs]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = useMemo(() => buildGraphData(workers, todayRuns, flags.flags.filter((f) => f.entity_type === 'worker'), handoffs), [workers, todayRuns, flags.flags, handoffs]);
  const nameOf = (id: string | null | undefined) => workers.find((w) => w.id === id)?.name ?? null;
  const refresh = () => { setTick((x) => x + 1); onRan(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hq.s && <KillSwitch controls={hq.s.controls} onChanged={() => void hq.load()} />}
      <Card title="Who's working" meta="tap a node · lines pulse while a run is live" action={<button style={btn('ghost')} onClick={() => setFloor(true)}>Floor plan view</button>}>
        {workers.length === 0 ? <div style={{ fontSize: 14, color: E.muted }}>Nobody's hired yet. Setup → Start the company.</div> : <OfficeGraph data={data} onPick={setPick} focusDomain="ecom" />}
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <OrchestratorChat onDone={refresh} />
        <Card title="Task log" meta="every order and every run, newest first"><TaskLog tasks={tasks} runs={runs} workerName={nameOf} /></Card>
      </div>
      <div>
        <div style={{ fontSize: 13, color: E.faint, marginBottom: 8 }}>Workers</div>
        <div style={{ background: E.bg, borderRadius: 16, border: '1px solid var(--border)', color: E.text, padding: 14 }}><WorkersTab onRan={refresh} /></div>
      </div>
      {pick && <NodeDrawer node={pick} worker={workers.find((w) => w.id === pick.id) ?? null} runs={runs.filter((r) => r.worker_id === pick.id)} onClose={() => setPick(null)} onChanged={refresh} />}
      {floor && <OfficeView domain="ecom" onClose={() => { setFloor(false); refresh(); }} />}
    </div>
  );
}

function NodeDrawer({ node, worker, runs, onClose, onChanged }: { node: GraphNode; worker: GWorker | null; runs: Run[]; onClose: () => void; onChanged: () => void }) {
  const [model, setModel] = useState(worker?.model ?? '');
  const [msg, setMsg] = useState('');
  const cost = runs.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const save = async (patch: Record<string, unknown>) => {
    if (!worker) return;
    const { error } = await supabase.from('ai_workers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', worker.id);
    setMsg(error ? error.message : 'Saved.'); onChanged();
  };
  return (
    <Sheet title={node.label} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge color={E.blue}>{node.kind}</Badge><Badge color={node.state === 'red' ? E.red : node.state === 'amber' ? E.amber : E.faint}>{node.state}</Badge><Badge color={E.faint}>{money(cost, 2)} · 7 days</Badge></div>
        {worker && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={worker.enabled} onChange={(e) => void save({ enabled: e.target.checked, status: e.target.checked ? 'idle' : 'disabled' })} /> Enabled
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select style={{ ...field, flex: 1 }} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
                {[...new Set([worker.model, ...ALLOWED_MODELS])].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button style={btn('ghost')} disabled={model === worker.model} onClick={() => void save({ model })}>Use this model</button>
            </div>
          </>
        )}
        {msg && <div style={{ fontSize: 13, color: E.muted }}>{msg}</div>}
        <div style={{ fontSize: 13, color: E.faint }}>Last runs</div>
        {runs.length === 0 && <div style={{ fontSize: 14, color: E.muted }}>No runs in the last 7 days.</div>}
        {runs.slice(0, 10).map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', borderTop: `1px solid ${E.border}`, paddingTop: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              <div style={{ color: r.status === 'failed' ? E.red : E.text }}>{r.summary ?? r.error ?? r.status}</div>
              <div style={{ fontSize: 12, color: E.faint }}>{ago(r.created_at)} · {r.trigger} · {money(Number(r.cost_usd ?? 0), 3)}</div>
            </div>
            <Thumbs entityType="run" entityId={r.id} domain="ecom" workerId={r.worker_id} compact />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function OrchestratorChat({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ me: string; reply: string; taskId: string | null }[]>([]);
  const send = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true); setText('');
    const r = await api<{ task_id?: string; worker?: string; reply?: string; note?: string; run?: { summary?: string; error?: string } }>('/api/office/assign', { body: { domain: 'ecom', text: t } });
    setBusy(false);
    setLog((l) => [...l, { me: t, reply: r.error ?? [r.reply ?? r.note, r.worker ? `→ ${r.worker}${r.run?.summary ? `: ${r.run.summary}` : ''}` : ''].filter(Boolean).join(' '), taskId: r.task_id ?? null }]);
    onDone();
  };
  return (
    <Card title="Talk to the E-commerce orchestrator" meta="it picks the worker and runs it">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {log.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '8px 12px', borderRadius: 12, background: 'var(--surface-2)', fontSize: 14 }}>{m.me}</div>
            <div style={{ maxWidth: '90%', padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, lineHeight: 1.5 }}>{m.reply}</div>
            {m.taskId && <Thumbs entityType="task" entityId={m.taskId} domain="ecom" compact />}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...field, flex: 1 }} value={text} placeholder="e.g. find 5 more pet products under $40" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
          <button style={btn('primary')} disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? '…' : 'Send'}</button>
        </div>
      </div>
    </Card>
  );
}
