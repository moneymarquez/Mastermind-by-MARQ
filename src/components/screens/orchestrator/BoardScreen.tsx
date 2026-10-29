import { useCallback, useEffect, useState } from 'react';
import { Page, Tabs, Sheet, field, useModule } from '../../mm/Page';
import Chip from '../../mm/Chip';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { band, overallOf } from '../../../data/aiScores';
import { STREAMS, PHASES, cleanLabels } from '../../../data/board';
import type { Board, BoardStream, BoardWorker, Label, Phase, WorkerState } from '../../../data/board';

// Placeholder art: one emoji per kind of worker until real characters land.
const AVATAR: Record<string, string> = { ecom: '🧑‍💼', content: '🎬', marketing: '📞', all: '🧭' };
const ROOM: Record<string, string> = { all: 'HQ', ecom: 'E-commerce', marketing: 'Made by', content: 'Content' };
const STATE_TEXT: Record<WorkerState, string> = { running: 'At the desk, working', waiting: 'Waiting on you', error: 'Stuck: last run failed', idle: 'Idle' };
const BAND_COLOR = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--danger)' } as const;

const CSS = `
.bd-desk{position:relative;height:96px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);overflow:hidden;cursor:pointer}
.bd-desk:focus-visible{outline:2px solid var(--accent)}
.bd-table{position:absolute;right:10px;bottom:12px;width:44px;height:26px;border-radius:6px;background:color-mix(in srgb,var(--text) 12%,transparent)}
.bd-table:after{content:'';position:absolute;left:12px;top:-14px;width:20px;height:14px;border-radius:3px;background:color-mix(in srgb,var(--text) 22%,transparent)}
.bd-guy{position:absolute;bottom:14px;font-size:30px;line-height:1;transition:left 1.4s steps(8,end);will-change:left}
.bd-guy[data-s=idle]{left:12px;animation:bdIdle 3s ease-in-out infinite}
.bd-guy[data-s=running]{left:calc(100% - 64px);animation:bdType .5s steps(2) infinite}
.bd-guy[data-s=waiting]{left:calc(100% - 64px)}
.bd-guy[data-s=error]{left:calc(100% - 64px);filter:grayscale(.7)}
.bd-flag{position:absolute;top:-20px;left:18px;font-size:18px;animation:bdWave 1s ease-in-out infinite;transform-origin:bottom left}
.bd-name{position:absolute;left:10px;top:8px;right:10px;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bd-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:1px}
@keyframes bdIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes bdType{0%{transform:translateY(0)}100%{transform:translateY(-2px)}}
@keyframes bdWave{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(14deg)}}
@media (prefers-reduced-motion: reduce){.bd-guy,.bd-flag{animation:none!important;transition:none!important}}
.bd-cols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(170px,1fr);gap:10px;overflow-x:auto;padding-bottom:4px}
.bd-col{display:flex;flex-direction:column;gap:6px;min-width:0;padding:10px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)}
.bd-col--wait{background:color-mix(in srgb,var(--warning) 12%,var(--surface-2));border:2px solid color-mix(in srgb,var(--warning) 55%,transparent)}
.bd-item{font-size:13px;padding:7px 9px;border-radius:8px;background:var(--surface);border:1px solid var(--border);min-width:0}
`;

const stateColor = (s: WorkerState) => (s === 'running' ? 'var(--success)' : s === 'waiting' ? 'var(--warning)' : s === 'error' ? 'var(--danger)' : 'var(--text-tertiary)');
const ago = (iso: string | null) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

/** Office & Classroom (spec Part 5), both fed by /api/orchestrator/board.
 *  Office: every worker as a character — walks to the desk when running,
 *  idles in the corner, raises a flag when waiting on you. Tap for the job,
 *  last output and Trust Score. Classroom: each workstream in Phase 1–5 with
 *  "Waiting on you" first. MostFit and side hustles are labels you type. */
export default function BoardScreen() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const [tab, setTab] = useState<'office' | 'classroom'>(() => { try { return (localStorage.getItem('board_tab') as 'office' | 'classroom') || 'office'; } catch { return 'office'; } });
  const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<BoardWorker | null>(null);
  const load = useCallback(async () => {
    const r = await api<Board>('/api/orchestrator/board', { method: 'GET' });
    if (r.error) setErr(r.error); else { setErr(''); setBoard(r); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { try { localStorage.setItem('board_tab', tab); } catch { /* fine */ } }, [tab]);

  const waitingTotal = board ? board.streams.reduce((s, x) => s + x.waiting.length, 0) : 0;
  return (
    <Page title="Office & Classroom" sub="Who's working, and where everything stands." back="Orchestrator" backTo="orchestrator">
      <style>{CSS}</style>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'office' as const, label: 'Office' }, { id: 'classroom' as const, label: 'Classroom', badge: waitingTotal || undefined }]} />
      {err && <span style={{ fontSize: 14, color: 'var(--danger)' }}>{err}</span>}
      {!board && !err && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</span>}
      {board && tab === 'office' && <Office workers={board.workers} phone={phone} onOpen={setOpen} />}
      {board && tab === 'classroom' && board.streams.map((s) => <Room key={s.key} s={s} onChanged={load} onWaiting={() => nav('today')} />)}
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <WorkerDetail w={open} onApprovals={() => { setOpen(null); nav('today'); }} />
        </Sheet>
      )}
    </Page>
  );
}

function Office({ workers, phone, onOpen }: { workers: BoardWorker[]; phone: boolean; onOpen: (w: BoardWorker) => void }) {
  if (!workers.length) return <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No workers yet. Start the company from Settings → Workers.</span>;
  const rooms = ['all', 'ecom', 'marketing', 'content'].filter((d) => workers.some((w) => w.domain === d));
  const counts = { running: workers.filter((w) => w.state === 'running').length, waiting: workers.filter((w) => w.state === 'waiting').length };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip k={counts.running ? 'good' : 'neutral'}>{counts.running} working</Chip>
        <Chip k={counts.waiting ? 'warn' : 'neutral'}>{counts.waiting} waiting on you</Chip>
        <Chip>{workers.length - counts.running - counts.waiting} idle</Chip>
      </div>
      {rooms.map((d) => (
        <section key={d} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ROOM[d] ?? d}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
            {workers.filter((w) => w.domain === d).map((w) => (
              <div key={w.id} className="bd-desk" role="button" tabIndex={0} onClick={() => onOpen(w)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(w); }} aria-label={`${w.name}: ${STATE_TEXT[w.state]}`}>
                <span className="bd-name"><span className="bd-dot" style={{ background: stateColor(w.state) }} />{w.name}</span>
                <span className="bd-table" />
                <span className="bd-guy" data-s={w.state}>
                  {w.state === 'waiting' && <span className="bd-flag">🚩</span>}
                  {w.state === 'error' && <span className="bd-flag" style={{ animation: 'none' }}>❓</span>}
                  {AVATAR[w.domain] ?? '🧑'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WorkerDetail({ w, onApprovals }: { w: BoardWorker; onApprovals: () => void }) {
  const b = band(overallOf(w.trust));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: b ? BAND_COLOR[b] : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{w.trust ?? '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Trust Score, last output{w.trust7 != null ? ` · ${w.trust7} avg this week` : ''}</span>
      </div>
      <div><span style={{ color: stateColor(w.state), fontWeight: 600 }}>{STATE_TEXT[w.state]}</span></div>
      <div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Current job</div>{w.job || 'Nothing right now.'}</div>
      <div><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Last output {w.lastAt ? `· ${ago(w.lastAt)}` : ''}</div><span style={{ whiteSpace: 'pre-wrap' }}>{w.lastOutput || 'No runs in the last day.'}</span></div>
      {w.waiting > 0 && <button className="mm-btn mm-btn--primary" style={{ height: 40, alignSelf: 'flex-start' }} onClick={onApprovals}>{w.waiting} waiting on you</button>}
    </div>
  );
}

function Room({ s, onChanged, onWaiting }: { s: BoardStream; onChanged: () => void; onWaiting: () => void }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 16, flex: 1 }}>{s.name}</strong>
        {s.labelsOnly && <Chip>Status labels only</Chip>}
      </div>
      <div className="bd-cols">
        {s.key !== 'mostfit' && (
          <div className="bd-col bd-col--wait">
            <strong style={{ fontSize: 13 }}>Waiting on you · {s.waiting.length}</strong>
            {s.waiting.length === 0 ? <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Nothing.</span> : s.waiting.slice(0, 6).map((i) => (
              <button key={i.id} className="bd-item" style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }} onClick={onWaiting}>{i.title}{i.sub ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{i.sub}</span> : null}</button>
            ))}
            {s.waiting.length > 6 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>+{s.waiting.length - 6} more</span>}
          </div>
        )}
        {s.columns.map((c) => (
          <div key={c.phase} className="bd-col">
            <strong style={{ fontSize: 13 }}><span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{c.phase} · </span>{c.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{c.count || ''}</span></strong>
            {c.items.map((i) => (
              <div key={i.id} className="bd-item" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>{i.title}{i.sub ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{i.sub}</span> : null}</span>
                {s.labelsOnly && <button aria-label={`Remove ${i.title}`} title="Remove label" onClick={() => void saveLabels(s.key as 'mostfit' | 'side', (xs) => xs.filter((x) => x.id !== i.id)).then(onChanged)} style={{ background: 'none', border: 0, color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>}
              </div>
            ))}
            {c.count > c.items.length && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>+{c.count - c.items.length} more</span>}
          </div>
        ))}
      </div>
      {s.labelsOnly && <LabelEditor stream={s.key as 'mostfit' | 'side'} onChanged={onChanged} />}
    </section>
  );
}

async function saveLabels(stream: 'mostfit' | 'side', mutate: (xs: Label[]) => Label[]) {
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase.from('user_settings').select('board_labels').maybeSingle();
  const all = ((data?.board_labels ?? {}) as Record<string, unknown>);
  await supabase.from('user_settings').upsert({ user_id: u.user?.id, board_labels: { ...all, [stream]: mutate(cleanLabels(all[stream])) }, updated_at: new Date().toISOString() });
}

function LabelEditor({ stream, onChanged }: { stream: 'mostfit' | 'side'; onChanged: () => void }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>(1);
  const [busy, setBusy] = useState(false);
  const def = STREAMS.find((x) => x.key === stream)!;
  const save = async (mutate: (xs: Label[]) => Label[]) => { setBusy(true); await saveLabels(stream, mutate); setBusy(false); onChanged(); };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <input style={{ ...field, flex: '1 1 180px', height: 36 }} placeholder={stream === 'mostfit' ? 'MostFit status, e.g. "Waitlist page live"' : 'Side hustle, e.g. "Vending route"'} value={text} onChange={(e) => setText(e.target.value)} />
      <select style={{ ...field, width: 'auto', height: 36 }} value={phase} onChange={(e) => setPhase(Number(e.target.value) as Phase)}>
        {PHASES.map((p) => <option key={p} value={p}>{p} · {def.phases[p - 1]}</option>)}
      </select>
      <button className="mm-btn" style={{ height: 36 }} disabled={busy || !text.trim()} onClick={() => void save((xs) => [...xs.filter((x) => x.label.toLowerCase() !== text.trim().toLowerCase()), { id: `${Date.now()}`, label: text.trim(), phase }]).then(() => setText(''))}>Set</button>
    </div>
  );
}
