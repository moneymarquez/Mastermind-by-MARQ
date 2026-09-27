import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './office.css';
import type { Domain } from '../../data/ecom';
import { AUTONOMY_LABEL, LIVE_WORKERS, money, ago, workersFor } from '../../data/ecom';
import type { RunRow, WorkerRow } from '../../data/useEngine';
import { usePlaybooks } from '../../data/useEngine';
import type { PlaybookVersion } from '../../data/useEngine';
import { useOffice, assignTask, raiseWithOrchestrator, applyProposal, threadFor } from '../../data/useOffice';
import type { Proposal, ThreadMessage } from '../../data/useOffice';
import { spriteState, roomOrder, SPRITE_ROW, STATE_LABEL, spriteUrl } from '../../data/office';
import type { SpriteState } from '../../data/office';
import { E, Badge, Drawer, Metric, TeachingEmpty, btn, field, label, tint, useIsMobile } from '../screens/ecom/ecomShared';
import { askConfirm } from '../../lib/confirm';

const TITLE: Record<string, string> = { ecom: 'E-commerce', content: 'Content', marketing: 'Marketing' };
const BUBBLE: Partial<Record<SpriteState, { text: string; cls: string }>> = {
  waiting: { text: '!', cls: 'of-bubble--alert' }, error: { text: '?', cls: 'of-bubble--error' }, asleep: { text: 'Zz', cls: 'of-bubble--zz' },
};

/** View Office (Appendix 5 Part 3): a top-down floor plan per module. The
 *  orchestrator sits in the centre room and never wanders; hallways lead to
 *  one room per worker; every sprite state comes from real rows (ai_workers
 *  + today's ai_worker_runs + pending approvals), and an envelope travels
 *  down the hallway only when a real run is created. */
export default function OfficeView({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const mobile = useIsMobile();
  const roomRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const orchRef = useRef<HTMLDivElement | null>(null);
  const [openWorker, setOpenWorker] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<RunRow | null>(null);
  const [orchOpen, setOrchOpen] = useState(false);

  const flyEnvelope = useCallback((run: RunRow) => {
    const from = orchRef.current?.getBoundingClientRect();
    const to = run.worker_id ? roomRefs.current[run.worker_id]?.getBoundingClientRect() : null;
    if (!from || !to) return;
    const el = document.createElement('div');
    el.className = 'of-envelope';
    document.body.appendChild(el);
    const sx = from.left + from.width / 2 - 9, sy = from.bottom - 6;
    const tx = to.left + to.width / 2 - 9, ty = to.top - 6;
    const hallY = Math.max(sy + 16, Math.min(ty - 18, sy + 30));
    const anim = el.animate([
      { transform: `translate(${sx}px, ${sy}px)` },
      { transform: `translate(${sx}px, ${hallY}px)`, offset: 0.25 },
      { transform: `translate(${tx}px, ${hallY}px)`, offset: 0.7 },
      { transform: `translate(${tx}px, ${ty}px)` },
    ], { duration: 1600, easing: 'steps(24, end)' });
    anim.onfinish = () => el.remove();
  }, []);

  const office = useOffice(domain, flyEnvelope);
  const orch = office.workers.find((w) => w.key === 'orchestrator') ?? null;
  const rooms = useMemo(() => roomOrder(office.workers.filter((w) => w.domain === domain), office.facts, (w) => w.id), [office.workers, office.facts, domain]);
  const delegations = office.tasks;
  const saying = delegations[0] ? (delegations[0].note ?? delegations[0].body) : office.runs[0] ? `${office.workers.find((w) => w.id === office.runs[0].worker_id)?.name ?? 'A worker'}: ${office.runs[0].summary ?? office.runs[0].status}` : 'No delegations yet today.';
  const worker = office.workers.find((w) => w.id === openWorker) ?? null;
  const cols = mobile ? 2 : Math.min(4, Math.max(2, rooms.length > 6 ? 4 : 3));

  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !openWorker && !openRun && !orchOpen) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, openWorker, openRun, orchOpen]);

  return (
    <div className="of-root" style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'var(--bg)', color: E.text, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: mobile ? 'calc(10px + env(safe-area-inset-top)) 14px 10px' : '14px 20px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: `1px solid ${E.border}`, background: E.surface, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-subhead)' }}>{TITLE[domain] ?? domain} office</div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{office.workers.filter((w) => w.domain === domain).length} workers · {office.runs.length} run{office.runs.length === 1 ? '' : 's'} today · live</div>
        </div>
        <button style={btn('ghost')} onClick={onClose} aria-label="Close office">✕</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? 14 : '20px 5%' }}>
        {!office.loading && office.workers.length === 0 && <TeachingEmpty what="The office is empty — nobody's hired yet." connection="Setup → Start the company" />}
        {office.workers.length > 0 && (
          <div className="of-plan">
            {/* Orchestrator: centre room, stationary, current delegation in a bubble. */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexDirection: mobile ? 'column' : 'row', justifyContent: 'center' }}>
              <div ref={orchRef} className="of-room" data-state={orch ? spriteState(orch, office.facts[orch.id]) : 'off'} onClick={() => setOrchOpen(true)} style={{ height: 190, width: mobile ? '100%' : 420, flexShrink: 0 }}>
                <span className="of-room-label">Orchestrator</span>
                <span className="of-room-meta">{orch?.model ?? '—'}</span>
                <div className="of-rug" />
                <div className="of-monitor" style={{ width: 30 }} /><div className="of-desk" style={{ width: 90, marginLeft: -45 }} />
                <div className="of-plant" />
                {orch && <Sprite k="orchestrator" state={orch.status === 'running' ? 'working' : 'idle'} still={orch.status !== 'running'} style={{ left: '50%', marginLeft: -32, bottom: 22 }} />}
                <div className="of-bubble of-bubble--say" style={{ left: '50%', top: 28, transform: 'translateX(-8px)' }}>{saying.slice(0, 110)}</div>
                {!orch && <div className="of-dark" />}
              </div>
              <div style={{ ...E.card, padding: 12, width: mobile ? '100%' : 280, boxSizing: 'border-box', maxHeight: 190, overflowY: 'auto' }}>
                <div style={{ ...label, marginBottom: 6 }}>Today's delegations</div>
                {delegations.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>None yet. Tap the orchestrator → Assign task.</div>}
                {delegations.slice(0, 8).map((t) => (
                  <div key={t.id} style={{ fontSize: 'var(--text-caption)', color: E.muted, padding: '4px 0', borderTop: `1px solid ${E.border}` }}>
                    <Badge color={t.status === 'done' ? E.green : t.status === 'failed' ? E.red : t.status === 'waiting' ? E.amber : E.accent}>{t.status}</Badge>{' '}
                    <span style={{ color: E.text }}>{office.workers.find((w) => w.id === t.worker_id)?.name ?? 'unrouted'}</span> — {t.body.slice(0, 70)}
                  </div>
                ))}
              </div>
            </div>

            {/* Hallway, then one room per worker with a door stub up to it. */}
            <div className="of-stub" />
            <div className="of-hall" />
            <div className="of-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, marginTop: 0 }}>
              {rooms.map((w) => {
                const st = spriteState(w, office.facts[w.id]);
                const f = office.facts[w.id];
                const b = BUBBLE[st];
                const pos: CSSProperties = st === 'waiting' ? { left: '50%', marginLeft: -32, top: 24 } : st === 'idle' ? { left: '50%', marginLeft: -32, top: 44 } : { left: '50%', marginLeft: -32, bottom: 20 };
                return (
                  <div key={w.id}>
                    <div className="of-stub" />
                    <div ref={(el) => { roomRefs.current[w.id] = el; }} className="of-room" data-state={st} onClick={() => setOpenWorker(w.id)} style={{ height: mobile ? 150 : 170 }} title={STATE_LABEL[st]}>
                      <span className="of-door" />
                      <span className="of-room-label">{w.name}</span>
                      <span className="of-room-meta">{f?.runsToday ?? 0}▸</span>
                      <div className="of-monitor" /><div className="of-desk" />
                      <Sprite k={w.key} state={st} style={pos} />
                      {b && <div className={`of-bubble ${b.cls}`} style={{ left: 'calc(50% + 18px)', top: st === 'waiting' ? 26 : 38 }}>{b.text}</div>}
                      {(st === 'off' || st === 'unbuilt') && <div className="of-dark" />}
                      <div style={{ position: 'absolute', left: 6, bottom: 4, zIndex: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {st === 'asleep' && <Badge color={E.amber}>no runs today</Badge>}
                        {st === 'unbuilt' && <Badge color={E.faint}>not built yet</Badge>}
                        {st === 'off' && <Badge color={E.faint}>off</Badge>}
                        {st === 'waiting' && <Badge color={E.amber}>{f.pendingApprovals} waiting</Badge>}
                        {st === 'error' && <Badge color={E.red}>error</Badge>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 12, lineHeight: 1.5 }}>
              Every sprite is real state: typing = running, "!" at the door = output waiting on you, red "?" = last run failed, "Zz" = nothing ran today, lights off = off or not built yet. Placeholder art — see public/office/README.md to swap in real sprites.
            </div>
          </div>
        )}
      </div>

      {orchOpen && <OrchestratorDrawer domain={domain} office={office} orch={orch} onClose={() => setOrchOpen(false)} />}
      {worker && !openRun && <WorkerDrawer w={worker} office={office} onClose={() => setOpenWorker(null)} onOpenRun={setOpenRun} />}
      {openRun && <RunDrawer run={openRun} office={office} onClose={() => setOpenRun(null)} />}
    </div>
  );
}

/** still = the orchestrator: idle frames at its desk, never wandering. */
function Sprite({ k, state, style, still }: { k: string; state: SpriteState; style?: CSSProperties; still?: boolean }) {
  return <div className="of-sprite" data-state={still ? 'still' : state} style={{ backgroundImage: `url(${spriteUrl(k)})`, backgroundPositionY: -SPRITE_ROW[state] * 64, ...style }} />;
}

type OfficeApi = ReturnType<typeof useOffice>;

function OrchestratorDrawer({ domain, office, orch, onClose }: { domain: Domain; office: OfficeApi; orch: WorkerRow | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setReply('');
    const r = await assignTask(domain, text.trim());
    setBusy(false);
    setReply(r.error ?? `${r.reply ?? ''}${r.run ? (r.run.ok ? ` → ${r.run.count} results waiting in Approvals.` : ` → run failed: ${r.run.error}`) : ''}`);
    if (!r.error) setText('');
    office.reload();
  };
  return (
    <Drawer open onClose={onClose} title="Orchestrator" subtitle={`${orch?.model ?? ''} · assigns work, reads outputs, routes your notes`} width={560}>
      <div style={{ ...E.card, padding: 12 }}>
        <div style={{ ...label, marginBottom: 6 }}>＋ Assign task</div>
        <textarea style={{ ...field, minHeight: 70, resize: 'vertical' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={domain === 'ecom' ? 'e.g. "Find me 10 TikTok products over $30 that are easy to film"' : 'Type an order — the orchestrator picks the worker'} />
        <button style={{ ...btn('primary'), marginTop: 8 }} disabled={busy || !text.trim()} onClick={send}>{busy ? 'Routing…' : 'Send to orchestrator'}</button>
        {reply && <div style={{ fontSize: 'var(--text-body)', color: E.text, marginTop: 8 }}>{reply}</div>}
      </div>
      <Section2 title="Today's delegations">
        {office.tasks.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>None yet.</div>}
        {office.tasks.map((t) => (
          <div key={t.id} style={{ borderTop: `1px solid ${E.border}`, padding: '6px 0', fontSize: 'var(--text-caption)', color: E.muted }}>
            <Badge color={t.status === 'done' ? E.green : t.status === 'failed' ? E.red : E.amber}>{t.status}</Badge> <strong style={{ color: E.text }}>{office.workers.find((w) => w.id === t.worker_id)?.name ?? 'unrouted'}</strong> · {ago(t.created_at)}
            <div style={{ color: E.text, marginTop: 2 }}>{t.body}</div>
            {t.instructions && t.instructions !== t.body && <div>Told the worker: {t.instructions}</div>}
            {t.note && <div style={{ color: E.faint }}>{t.note}</div>}
          </div>
        ))}
      </Section2>
      <Section2 title="Its messages today">
        {office.messages.filter((m) => m.role === 'orchestrator').length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No threads today.</div>}
        {office.messages.filter((m) => m.role === 'orchestrator').slice(0, 6).map((m) => <div key={m.id} style={{ fontSize: 'var(--text-caption)', color: E.muted, borderTop: `1px solid ${E.border}`, padding: '6px 0' }}>{m.body}</div>)}
      </Section2>
      <Section2 title="Daily summary">
        {office.summary ? <div style={{ fontSize: 'var(--text-body)', color: E.text, whiteSpace: 'pre-wrap' }}>{office.summary}</div> : <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Written each morning by the digest desk for this module.</div>}
      </Section2>
    </Drawer>
  );
}

function Section2({ title, children }: { title: string; children: ReactNode }) {
  return <div style={{ marginTop: 16 }}><div style={{ ...label, marginBottom: 6 }}>{title}</div>{children}</div>;
}

function WorkerDrawer({ w, office, onClose, onOpenRun }: { w: WorkerRow; office: OfficeApi; onClose: () => void; onOpenRun: (r: RunRow) => void }) {
  const runs = office.runs.filter((r) => r.worker_id === w.id);
  const st = spriteState(w, office.facts[w.id]);
  const decided = office.approvals.filter((a) => a.worker_id === w.id && a.status !== 'pending');
  const approved = decided.filter((a) => a.status === 'approved').length;
  const done = runs.filter((r) => r.started_at && r.finished_at);
  const avgSec = done.length ? Math.round(done.reduce((s, r) => s + (new Date(r.finished_at!).getTime() - new Date(r.started_at!).getTime()) / 1000, 0) / done.length) : null;
  const phase = workersFor(w.domain as Domain).find((c) => c.key === w.key)?.phase;
  return (
    <Drawer open onClose={onClose} title={w.name} subtitle={`${STATE_LABEL[st]} · ${w.model} · ${AUTONOMY_LABEL[w.autonomy_level]}`} width={580}>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>{w.role}</div>
      {!LIVE_WORKERS.includes(w.key) && w.key !== 'orchestrator' && <div style={{ marginTop: 10 }}><TeachingEmpty what={`${w.name} isn't built yet — its room stays dark until it is.`} connection={phase ? `build phase ${phase}` : undefined} /></div>}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
        <Metric label="Runs today" value={String(runs.length)} />
        <Metric label="Approval rate" value={decided.length ? `${Math.round((approved / decided.length) * 100)}%` : '—'} />
        <Metric label="Cost today" value={money(runs.reduce((s, r) => s + Number(r.cost_usd), 0))} />
        <Metric label="Avg time" value={avgSec == null ? '—' : `${avgSec}s`} />
      </div>
      <Section2 title="Today's runs">
        {runs.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Nothing ran today.</div>}
        {runs.map((r) => {
          const appr = office.approvals.find((a) => a.run_id === r.id);
          return (
            <div key={r.id} onClick={() => onOpenRun(r)} style={{ borderTop: `1px solid ${E.border}`, padding: '8px 0', cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 'var(--text-caption)', color: E.muted }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <Badge color={r.status === 'done' ? E.green : r.status === 'failed' ? E.red : E.accent}>{r.status}</Badge>
                {appr && <Badge color={appr.status === 'approved' ? E.green : appr.status === 'pending' ? E.amber : E.red}>{appr.status.replace('_', ' ')}</Badge>}
                <span>{Object.entries(r.input ?? {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${String(v)}`).join(' · ').slice(0, 80)}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{money(Number(r.cost_usd))}</span>
              </div>
              <div style={{ fontSize: 'var(--text-body)', color: r.status === 'failed' ? E.red : E.text, marginTop: 2 }}>{(r.status === 'failed' ? r.error : r.summary) ?? '—'} <span style={{ color: E.accent }}>▸</span></div>
            </div>
          );
        })}
      </Section2>
      <PlaybookHistory name={`worker:${w.key}`} />
    </Drawer>
  );
}

/** Per-worker playbook history with revert (the rules View Office fixes wrote). */
function PlaybookHistory({ name }: { name: string }) {
  const pb = usePlaybooks();
  const p = pb.playbooks.find((x) => x.name === name);
  const [versions, setVersions] = useState<PlaybookVersion[]>([]);
  useEffect(() => { if (p) pb.versions(p.id).then(setVersions); }, [p?.id, p?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Section2 title={`Playbook history · ${name}`}>
      {!p && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No worker-specific rules yet. Raise a run with the orchestrator and apply a playbook fix to start one.</div>}
      {p && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, background: E.sunk, border: `1px solid ${E.border}`, padding: 10, margin: 0, color: E.text }}>{p.body || '(empty)'}</pre>}
      {versions.map((v) => (
        <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--text-caption)', color: E.muted, borderTop: `1px solid ${E.border}`, padding: '5px 0' }}>
          <Badge color={p && v.version === p.version ? E.green : E.faint}>v{v.version}</Badge>
          <span style={{ flex: 1 }}>{v.change_reason ?? '—'}{v.thread_id ? ' · orchestrator thread' : ''}</span>
          {p && v.version !== p.version && <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }} onClick={async () => { if (await askConfirm(`Revert ${name} to v${v.version}?`)) { await pb.save(p, v.body, `Reverted to v${v.version}`); } }}>Revert</button>}
        </div>
      ))}
    </Section2>
  );
}

function RunDrawer({ run, office, onClose }: { run: RunRow; office: OfficeApi; onClose: () => void }) {
  const w = office.workers.find((x) => x.id === run.worker_id);
  const appr = office.approvals.find((a) => a.run_id === run.id);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [applying, setApplying] = useState('');
  const [raised, setRaised] = useState(false);
  useEffect(() => { threadFor(run.id).then((t) => { setThreadId(t.threadId); setMsgs(t.messages); if (t.threadId) setRaised(true); }); }, [run.id]);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    const r = await raiseWithOrchestrator(run.id, text.trim(), threadId ?? undefined);
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setThreadId(r.thread_id); setText('');
    setMsgs((await threadFor(run.id)).messages);
  };
  const apply = async (m: ThreadMessage, i: number) => {
    setApplying(`${m.id}:${i}`); setErr('');
    const r = await applyProposal(m.id, i);
    setApplying('');
    if (r.error) { setErr(r.error); return; }
    setMsgs((await threadFor(run.id)).messages);
    office.reload();
  };
  const output = appr?.payload ?? run.output;
  return (
    <Drawer open onClose={onClose} title={`${w?.name ?? 'Run'} · ${new Date(run.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} subtitle={`${run.status}${run.cost_usd ? ` · ${money(Number(run.cost_usd))}` : ''}${run.trigger !== 'manual' ? ` · ${run.trigger}` : ''}`} width={640}>
      <div style={label}>Input</div>
      <pre style={preStyle}>{JSON.stringify({ ...run.input, instructions: run.instructions ?? undefined }, null, 2)}</pre>
      <div style={{ ...label, marginTop: 10 }}>Output {appr && <Badge color={appr.status === 'approved' ? E.green : appr.status === 'pending' ? E.amber : E.red}>{appr.status.replace('_', ' ')}</Badge>}</div>
      {run.error && <div style={{ color: E.red, fontSize: 'var(--text-body)' }}>{run.error}</div>}
      <pre style={{ ...preStyle, maxHeight: 320 }}>{JSON.stringify(output, null, 2)}</pre>
      {appr?.my_note && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>Your note: “{appr.my_note}”</div>}

      {!raised ? (
        <button style={{ ...btn('primary'), marginTop: 14 }} onClick={() => setRaised(true)}>Raise with orchestrator</button>
      ) : (
        <div style={{ ...E.card, padding: 12, marginTop: 14 }}>
          <div style={{ ...label, marginBottom: 6 }}>Raise with orchestrator</div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginBottom: 8 }}>It already has this run's input and output and the worker's playbook. Say what's wrong; it proposes a fix you can apply.</div>
          {msgs.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--text-caption)', color: m.role === 'user' ? E.accent : E.violet, fontWeight: 700 }}>{m.role === 'user' ? 'You' : 'Orchestrator'}</div>
              <div style={{ fontSize: 'var(--text-body)', color: E.text, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              {m.proposal.map((p, i) => <ProposalCard key={i} p={p} busy={applying === `${m.id}:${i}`} onApply={() => apply(m, i)} />)}
            </div>
          ))}
          <textarea style={{ ...field, minHeight: 64, resize: 'vertical' }} value={text} onChange={(e) => setText(e.target.value)} placeholder='e.g. "this product is trash — it’s under $15 and the reviews are bad"' />
          <button style={{ ...btn('primary'), marginTop: 8 }} disabled={busy || !text.trim()} onClick={send}>{busy ? 'Thinking…' : 'Send'}</button>
          {err && <div style={{ fontSize: 'var(--text-caption)', color: E.red, marginTop: 6 }}>{err}</div>}
        </div>
      )}
    </Drawer>
  );
}

const preStyle: CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, background: E.sunk, border: `1px solid ${E.border}`, padding: 10, margin: '4px 0 0', color: E.text, maxHeight: 160, overflow: 'auto' };

function ProposalCard({ p, busy, onApply }: { p: Proposal; busy: boolean; onApply: () => void }) {
  const title = p.kind === 'rerun' ? 'Rerun with changed instructions' : p.kind === 'playbook' ? `Playbook edit · ${p.playbook}` : 'Settings change';
  return (
    <div style={{ border: `1px solid ${p.applied_at ? E.green : E.border}`, background: tint(p.applied_at ? E.green : E.accent, 6), padding: 10, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)' }}>{title}</span>
        {p.applied_at && <Badge color={E.green}>applied {ago(p.applied_at)}</Badge>}
      </div>
      {p.why && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 2 }}>{p.why}</div>}
      {p.kind === 'rerun' && <div style={{ fontSize: 'var(--text-body)', color: E.text, marginTop: 4 }}>“{p.instructions}”</div>}
      {p.kind === 'playbook' && (
        <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {p.before && <div style={{ background: tint(E.red, 14), color: E.text, padding: '3px 6px', whiteSpace: 'pre-wrap' }}>− {p.before}</div>}
          <div style={{ background: tint(E.green, 14), color: E.text, padding: '3px 6px', whiteSpace: 'pre-wrap' }}>+ {p.after}</div>
        </div>
      )}
      {p.kind === 'settings' && <div style={{ fontSize: 'var(--text-body)', color: E.text, marginTop: 4 }}>{[p.model && `model → ${p.model}`, p.autonomy_level !== undefined && `autonomy → ${AUTONOMY_LABEL[p.autonomy_level]}`, p.enabled !== undefined && (p.enabled ? 'turn on' : 'turn off')].filter(Boolean).join(' · ')}</div>}
      {!p.applied_at && <button style={{ ...btn('primary'), marginTop: 8, padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={onApply}>{busy ? 'Applying…' : 'Apply'}</button>}
    </div>
  );
}
