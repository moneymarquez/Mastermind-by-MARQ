import { useState } from 'react';
import { workersFor, AUTONOMY_LABEL, CHANNELS, LIVE_WORKERS, money, ago } from '../../../data/ecom';
import type { Domain, Channel } from '../../../data/ecom';
import { useWorkers, runScout, startCompany } from '../../../data/useEngine';
import type { WorkerRow, RunResult } from '../../../data/useEngine';
import { E, Badge, Drawer, Metric, TeachingEmpty, btn, field, label, tint } from './ecomShared';

const STATUS: Record<string, { color: string; label: string }> = {
  running: { color: E.green, label: 'Working' }, idle: { color: E.accent, label: 'Idle' }, failed: { color: E.red, label: 'Error' }, disabled: { color: E.faint, label: 'Off' },
};
/** Which workers can actually run in this build. Everyone else shows the
 *  phase they arrive in. */
const LIVE = new Set(LIVE_WORKERS);

/** §9 "Rooms": one room per worker — status light, current task, last
 *  output, today's count, approval rate, cost today. Tap a room for its run
 *  log. Live from ai_workers / ai_worker_runs; the config roster shows
 *  until "Start the company" creates the rows. */
export default function WorkersTab({ domain = 'ecom', phaseLabel = 'Phase', onRan }: { domain?: Domain; phaseLabel?: string; onRan?: () => void }) {
  const live = useWorkers(domain);
  const config = workersFor(domain);
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState('');
  const open = live.workers.find((w) => w.id === openId) ?? null;

  if (!live.loading && live.workers.length === 0) {
    return (
      <div>
        <TeachingEmpty what="The workers aren't hired yet." connection="Setup → Start the company (creates every worker at L0 · Draft)"
          action={<button style={btn('primary')} onClick={async () => { setStarting('…'); const r = await startCompany(); setStarting(r.error ?? ''); await live.reload(); }}>{starting === '…' ? 'Starting…' : 'Start the company now'}</button>} />
        {starting && starting !== '…' && <div style={{ color: E.red, marginTop: 8, fontSize: 'var(--text-body)' }}>{starting}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
          {config.map((w) => (
            <div key={w.key} style={{ ...E.card, padding: 14, opacity: 0.7 }}>
              <div style={{ fontWeight: 700, color: E.text }}>{w.name}</div>
              <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>{w.role}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}><Badge color={E.blue}>{w.model}</Badge><Badge color={E.amber}>{w.domain === 'all' ? 'Phase' : phaseLabel} {w.phase}</Badge></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const phaseOf = (w: WorkerRow) => config.find((c) => c.key === w.key)?.phase;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {live.workers.map((w) => {
          const st = live.stats[w.id];
          const s = !w.enabled ? STATUS.disabled : STATUS[w.status] ?? STATUS.idle;
          const asleep = w.enabled && w.status === 'idle' && LIVE.has(w.key) && (st?.runsToday ?? 0) === 0;
          const rate = st && st.decided ? Math.round((st.approved / st.decided) * 100) : null;
          return (
            <div key={w.id} onClick={() => setOpenId(w.id)} style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', borderColor: w.status === 'running' ? E.green : w.status === 'failed' ? E.red : (E.border as string) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: w.status === 'running' ? `0 0 8px ${E.green}` : 'none' }} title={s.label} />
                <span style={{ fontWeight: 700, color: E.text, flex: 1 }}>{w.name}</span>
                {w.key === 'orchestrator' && <Badge color={E.violet}>Brain</Badge>}
                {asleep && <Badge color={E.amber}>Zz · no runs today</Badge>}
              </div>
              <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.45 }}>{w.current_task ?? w.role}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={E.blue}>{w.model}</Badge>
                <Badge color={E.faint}>{AUTONOMY_LABEL[w.autonomy_level]}</Badge>
                {LIVE.has(w.key) ? <Badge color={E.green}>Live</Badge> : <Badge color={E.amber}>{w.domain === 'all' ? 'Phase' : phaseLabel} {phaseOf(w) ?? '—'}</Badge>}
              </div>
              {st?.lastRun && <div style={{ fontSize: 'var(--text-caption)', color: st.lastRun.status === 'failed' ? E.red : E.faint }}>Last: {st.lastRun.status === 'failed' ? (st.lastRun.error ?? 'failed').slice(0, 80) : st.lastRun.summary ?? st.lastRun.status} · {ago(st.lastRun.created_at)}</div>}
              <div style={{ borderTop: `1px solid ${E.border}`, paddingTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Metric label="Today" value={String(st?.runsToday ?? 0)} unit="runs" />
                <Metric label="Approval · 14d" value={rate == null ? '—' : `${rate}%`} />
                <Metric label="Cost today" value={money(st?.costToday ?? 0)} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 14, lineHeight: 1.5 }}>
        Everyone starts at L0 · Draft: every output goes to approvals. Promotion needs two weeks at 80%+ approval with clean spot-checks, and never applies to money. Send-back notes are read into the worker's next run.
      </div>
      {open && <WorkerRoom w={open} api={live} phaseLabel={phaseLabel} onClose={() => setOpenId(null)} onRan={onRan} />}
    </div>
  );
}

function WorkerRoom({ w, api, phaseLabel, onClose, onRan }: { w: WorkerRow; api: ReturnType<typeof useWorkers>; phaseLabel: string; onClose: () => void; onRan?: () => void }) {
  const [channel, setChannel] = useState<Channel>('tiktok');
  const [count, setCount] = useState(10);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const runs = api.runs.filter((r) => r.worker_id === w.id).slice(0, 30);
  const st = api.stats[w.id];
  const eligible = st && st.decided >= 10 && st.approved / st.decided >= 0.8;

  const run = async () => {
    setBusy(true); setResult(null);
    const r = await runScout(channel, count, instructions.trim() || undefined);
    setResult(r); setBusy(false); await api.reload(); onRan?.();
  };

  return (
    <Drawer open onClose={onClose} title={w.name} subtitle={`${w.model} · ${AUTONOMY_LABEL[w.autonomy_level]}${w.enabled ? '' : ' · off'}`} width={620}>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>{w.role}</div>

      {LIVE.has(w.key) ? (
        <div style={{ ...E.card, padding: 14, marginTop: 14 }}>
          <div style={{ ...label, marginBottom: 8 }}>Run now</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select style={{ ...field, width: 'auto' }} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <select style={{ ...field, width: 'auto' }} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}</select>
          </div>
          <input style={{ ...field, marginTop: 8 }} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder='Optional: "only products over $30", "nothing fragile"' />
          <button style={{ ...btn('primary'), marginTop: 10 }} disabled={busy || !w.enabled} onClick={run}>{busy ? 'Scouting… (30–90 seconds)' : `Run ${w.name}`}</button>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>Uses web search on public pages (never Instagram, Facebook or TikTok video pages). Counts against today's e-commerce cap; results go to Approvals, not straight into the sheet.</div>
          {result && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', background: tint(result.ok ? E.green : E.red, 10), border: `1px solid ${tint(result.ok ? E.green : E.red, 35)}`, fontSize: 'var(--text-body)', color: E.text }}>
              {result.ok ? <>Found <strong>{result.count}</strong> products → waiting in Approvals. {result.summary} <span style={{ color: E.faint }}>({money(result.costUsd ?? 0)}, {result.searches ?? 0} searches)</span>{result.dropped?.length ? <div style={{ color: E.amber, marginTop: 4 }}>Dropped: {result.dropped.join('; ')}</div> : null}</> : <><strong>{result.capReached ? 'Cost cap hit.' : 'Run failed.'}</strong> {result.error}</>}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}><TeachingEmpty what={`${w.name} doesn't run yet.`} phase={undefined} connection={`${w.domain === 'all' ? 'Phase' : phaseLabel} ${workersFor(w.domain as Domain).find((c) => c.key === w.key)?.phase ?? ''} of the build`} /></div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
        <Metric label="Runs today" value={String(st?.runsToday ?? 0)} />
        <Metric label="Approved · 14d" value={st?.decided ? `${st.approved}/${st.decided}` : '—'} />
        <Metric label="Cost today" value={money(st?.costToday ?? 0)} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
        <span style={label}>Autonomy</span>
        {[0, 1, 2].map((lv) => (
          <button key={lv} style={{ ...btn('ghost'), padding: '5px 10px', fontSize: 12, background: w.autonomy_level === lv ? tint(E.accent, 16) : 'transparent', color: w.autonomy_level === lv ? E.accent : E.muted, borderColor: w.autonomy_level === lv ? E.accent : E.border }}
            disabled={lv > 0 && !eligible && w.autonomy_level < lv}
            title={lv > 0 && !eligible ? 'Needs two weeks at 80%+ approval (10+ decisions)' : ''}
            onClick={() => api.setAutonomy(w.id, lv)}>{AUTONOMY_LABEL[lv]}</button>
        ))}
        <button style={{ ...btn('ghost'), padding: '5px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => api.setEnabled(w.id, !w.enabled)}>{w.enabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      {!eligible && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4 }}>Promotion unlocks at 80%+ approval over 10+ decisions in two weeks.</div>}

      <div style={{ ...label, marginTop: 18, marginBottom: 6 }}>Run log</div>
      {runs.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No runs yet.</div>}
      {runs.map((r) => (
        <div key={r.id} style={{ borderTop: `1px solid ${E.border}`, padding: '8px 0', fontSize: 'var(--text-caption)', color: E.muted }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge color={r.status === 'done' ? E.green : r.status === 'failed' ? E.red : E.accent}>{r.status}</Badge>
            <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            <span>{String(r.input?.channel ?? '')}{r.trigger !== 'manual' ? ` · ${r.trigger}` : ''}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{money(Number(r.cost_usd))}{r.started_at && r.finished_at ? ` · ${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s` : ''}</span>
          </div>
          <div style={{ color: r.status === 'failed' ? E.red : E.text, marginTop: 3 }}>{r.status === 'failed' ? r.error : r.summary}</div>
          {r.instructions && <div style={{ color: E.faint, marginTop: 2 }}>Instructions: {r.instructions}</div>}
        </div>
      ))}
    </Drawer>
  );
}
