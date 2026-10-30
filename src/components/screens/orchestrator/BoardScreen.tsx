import { useCallback, useEffect, useState } from 'react';
import { Page, Tabs, Sheet, field, useModule } from '../../mm/Page';
import Chip from '../../mm/Chip';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { band, overallOf } from '../../../data/aiScores';
import { STREAMS, PHASES, cleanLabels } from '../../../data/board';
import type { Board, BoardStream, BoardWorker, Label, Phase, QueueEntry, QueueItem, WorkerState } from '../../../data/board';
import IsoOffice from '../../office3d/IsoOffice';
import ClassroomLine from '../../office3d/ClassroomLine';
import School from '../../office3d/School';
import { TopTaskRow, useTopTasks } from '../../mm/TopTasks';
import type { TopTask } from '../../../data/topTasks';
import { DELIVERY_PHASES } from '../../../data/madeby';
import { nextSteps } from '../../../data/board';
import type { BoardItem, Step } from '../../../data/board';
import ScorePills, { useNeedsConfirm } from '../../mm/ScorePills';
import { decideApproval } from '../../../data/useEngine';

// Placeholder art: one emoji per kind of worker until real characters land.
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
export default function BoardScreen({ initialTab }: { initialTab?: 'office' | 'classroom' } = {}) {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const [tab, setTab] = useState<'office' | 'classroom'>(() => { if (initialTab) return initialTab; try { return (localStorage.getItem('board_tab') as 'office' | 'classroom') || 'office'; } catch { return 'office'; } });
  const [board, setBoard] = useState<Board | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<BoardWorker | null>(null);
  const [line, setLine] = useState<QueueEntry | null>(null);
  const [person, setPerson] = useState<{ item: BoardItem; phase: number | 'waiting' | 'top' } | null>(null);
  const [topOpen, setTopOpen] = useState<TopTask | null>(null);
  const tops = useTopTasks();
  const load = useCallback(async () => {
    const r = await api<Board>('/api/orchestrator/board', { method: 'GET' });
    if (r.error) setErr(r.error); else { setErr(''); setBoard(r); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { try { localStorage.setItem('board_tab', tab); } catch { /* fine */ } }, [tab]);

  const waitingTotal = board ? (board.queue ?? []).reduce((s, x) => s + x.items.length, 0) : 0;
  void phone;
  return (
    <Page title="Office & Classroom" sub="Who's working, and where everything stands." back="Orchestrator" backTo="orchestrator">
      <style>{CSS}</style>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'office' as const, label: 'Office' }, { id: 'classroom' as const, label: 'Classroom', badge: waitingTotal || undefined }]} />
      {err && <span style={{ fontSize: 14, color: 'var(--danger)' }}>{err}</span>}
      {!board && !err && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</span>}
      {board && tab === 'office' && <IsoOffice workers={board.workers} onOpen={setOpen} />}
      {board && tab === 'classroom' && <ClassroomLine queue={board.queue ?? []} workers={board.workers} onOpen={setLine} />}
      {board && tab === 'classroom' && board.streams.map((s) => s.key === 'madeby' ? (
        <section key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <strong style={{ fontSize: 16 }}>Made by · the building</strong>
          <School stream={s} top={board.top ?? []} onOpen={(item, phase) => setPerson({ item, phase })} onOpenTop={setTopOpen} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>When someone moves to the next phase they walk down the hall to their new room. Tap anyone.</span>
        </section>
      ) : <Room key={s.key} s={s} onChanged={load} onWaiting={() => setTab('classroom')} />)}
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <WorkerDetail w={open} onApprovals={() => { setOpen(null); nav('today'); }} />
        </Sheet>
      )}
      {topOpen && (
        <Sheet title={`#${topOpen.rank} in your line`} onClose={() => setTopOpen(null)}>
          <TopTaskRow t={topOpen} expanded onDone={() => { void load(); void tops.reload(); }} onNav={(to) => { setTopOpen(null); nav(to); }} />
        </Sheet>
      )}
      {person && (
        <Sheet title={person.item.title} onClose={() => setPerson(null)}>
          {person.item.kind === 'approval'
            ? <LineItem i={{ id: person.item.id, title: person.item.title, type: (person.item.sub ?? '').replace(/ /g, '_'), created_at: new Date().toISOString() }} onDone={() => void load()} onOpen={() => { setPerson(null); nav('today'); }} />
            : <PersonDetail item={person.item} phase={person.phase} phaseName={board?.streams.find((x) => x.key === 'madeby')?.columns.find((c) => c.phase === person.phase)?.name ?? ''} onNav={(to) => { setPerson(null); nav(to); }} />}
        </Sheet>
      )}
      {line && (
        <Sheet title={`${line.name} · ${line.items.length} waiting`} onClose={() => setLine(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {line.items.map((i) => <LineItem key={i.id} i={i} onDone={() => void load()} onOpen={() => { setLine(null); nav(i.type.startsWith('product') || i.type.includes('purchase') || i.type.startsWith('supplier') ? 'ecom-approvals' : 'today'); }} />)}
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function WorkerDetail({ w, onApprovals }: { w: BoardWorker; onApprovals: () => void }) {
  const b = band(overallOf(w.trust));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: b ? BAND_COLOR[b] : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{w.trust ?? '—'}</span>
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

// Cards that move money or need you to buy something open in Approvals instead.
const OPEN_ONLY = new Set(['sample_purchase', 'domain_purchase', 'supplier_order', 'buy_domain', 'product_pitch']);
function LineItem({ i, onDone, onOpen }: { i: QueueItem; onDone: () => void; onOpen: () => void }) {
  const { red } = useNeedsConfirm('approval', i.id);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const go = async (status: 'approved' | 'sent_back') => {
    if (status === 'approved' && red && !window.confirm('This card scores red. Approve anyway?')) return;
    setBusy(true);
    const r = await decideApproval(i.id, status, status === 'sent_back' ? 'Sent back from the Classroom.' : null);
    setBusy(false);
    if (r.error || r.ok === false) { setDone(r.error ?? 'Could not save.'); return; }
    setDone(status === 'approved' ? 'Approved.' : 'Sent back.'); onDone();
  };
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14.5, fontWeight: 500 }}>{i.title}</span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{i.type.replace(/_/g, ' ')} · waiting {ago(i.created_at)}</span>
      <ScorePills type="approval" id={i.id} compact />
      {done ? <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{done}</span> : OPEN_ONLY.has(i.type) ? (
        <button className="mm-btn mm-btn--primary" style={{ height: 34, alignSelf: 'flex-start' }} onClick={onOpen}>Open to decide</button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mm-btn mm-btn--primary" style={{ height: 34 }} disabled={busy} onClick={() => void go('approved')}>{busy ? 'Saving…' : 'Approve'}</button>
          <button className="mm-btn" style={{ height: 34 }} disabled={busy} onClick={() => void go('sent_back')}>Send back</button>
          <button className="mm-btn" style={{ height: 34 }} onClick={onOpen}>Open</button>
        </div>
      )}
    </div>
  );
}

type Detail = { rows: [string, string][]; steps: Step[]; phone: string | null; stage: string; problems: string[] };
/** One Made by person: where they are and what's next. */
function PersonDetail({ item, phase, phaseName, onNav }: { item: BoardItem; phase: number | 'waiting' | 'top'; phaseName: string; onNav: (screen: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    void (async () => {
      if (item.kind === 'client') {
        const [{ data: c }, { data: items }] = await Promise.all([
          supabase.from('crm_clients').select('business_name,stage,delivery_phase,contact_name,contact_email,contact_phone').eq('id', item.id).maybeSingle(),
          supabase.from('client_checklist').select('title,owner,due,done,phase').eq('client_id', item.id).order('sort'),
        ]);
        const p = (c?.delivery_phase as number | null) ?? null;
        const dp = DELIVERY_PHASES.find((x) => x.n === p);
        const mine = ((items ?? []) as { title: string; owner: string; due: string | null; done: boolean; phase: number }[]).filter((x) => p == null || x.phase === p);
        setD({ stage: dp ? `Client · delivery phase ${p}: ${dp.label}` : `Client · ${String(c?.stage ?? '').replace(/_/g, ' ')} (delivery not started)`,
          rows: [['Contact', String(c?.contact_name ?? '—')], ['Email', String(c?.contact_email ?? '—')]],
          steps: mine.length ? mine.map((x) => ({ text: x.title, when: x.due ? `due ${x.due}` : null, done: x.done, owner: x.owner })) : [{ text: p == null ? 'Start delivery: move them into phase 1 in the client CRM' : 'No checklist for this phase yet' }],
          phone: (c?.contact_phone as string | null) ?? null, problems: [] });
        return;
      }
      if (item.kind === 'outreach') {
        const { data: o } = await supabase.from('lead_outreach').select('*').eq('id', item.id).maybeSingle();
        const row = (o ?? {}) as Record<string, unknown>;
        setD({ stage: `${phase === 'top' ? 'Outreach' : `Phase ${phase} · ${phaseName}`} (${String(row.status ?? '').replace('_', ' ')})`,
          rows: [['Email', String(row.to_email ?? '—')], ['Subject', String(row.subject ?? '—')], ['Sent', row.sent_at ? String(row.sent_at).slice(0, 10) : 'Not yet']],
          steps: nextSteps('outreach', row), phone: (row.phone as string | null) ?? null, problems: row.finding_summary ? [String(row.finding_summary)] : [] });
        return;
      }
      const [{ data: l }, { data: f }] = await Promise.all([
        supabase.from('leads').select('*').eq('id', item.id).maybeSingle(),
        supabase.from('lead_findings').select('summary').eq('lead_id', item.id).is('archived_at', null).neq('kind', 'checked').limit(5),
      ]);
      const row = (l ?? {}) as Record<string, unknown>;
      setD({ stage: phase === 'top' ? 'Phase 1 · Found' : `Phase ${phase} · ${phaseName}`,
        rows: [['Where', [row.city, row.state].filter(Boolean).join(', ') || '—'], ['Type', String(row.industry ?? row.category ?? '—')], ['Website', String(row.website ?? 'None')], ['Owner', String(row.owner_name ?? 'Unknown')]],
        steps: nextSteps('lead', row), phone: (row.owner_phone as string | null) ?? (row.phone as string | null) ?? null,
        problems: ((f ?? []) as { summary: string | null }[]).map((x) => x.summary ?? '').filter(Boolean) });
    })();
  }, [item, phase, phaseName]);
  if (!d) return <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5 }}>
      <Chip k="accent">{d.stage}</Chip>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
        {d.rows.map(([k, v]) => [<span key={`${k}k`} style={{ color: 'var(--text-tertiary)' }}>{k}</span>, <span key={`${k}v`} style={{ overflowWrap: 'anywhere' }}>{v}</span>])}
      </div>
      {d.problems.length > 0 && (
        <div><div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Website problems found</div>{d.problems.map((p, i) => <div key={i} style={{ fontSize: 14 }}>• {p}</div>)}</div>
      )}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Tasks</div>
        {d.steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0' }}>
            <span style={{ color: s.done ? 'var(--success)' : 'var(--text-tertiary)' }}>{s.done ? '✓' : '○'}</span>
            <span style={{ flex: 1, textDecoration: s.done ? 'line-through' : undefined, color: s.done ? 'var(--text-tertiary)' : 'var(--text)' }}>{s.text}{s.owner && s.owner !== 'marq' ? <span style={{ color: 'var(--text-tertiary)' }}> · {s.owner}</span> : null}</span>
            {s.when && <span style={{ fontSize: 12.5, color: s.when.includes('now') ? 'var(--danger)' : 'var(--text-tertiary)' }}>{s.when}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {d.phone && <a className="mm-btn mm-btn--primary" style={{ height: 38, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`tel:${d.phone}`}>Call</a>}
        <button className="mm-btn" style={{ height: 38 }} onClick={() => onNav(item.kind === 'client' ? 'client-crm' : item.kind === 'outreach' ? 'lead-engines' : 'leadflow')}>{item.kind === 'client' ? 'Open in client CRM' : item.kind === 'outreach' ? 'Open in Engines' : 'Open in LeadFlow'}</button>
      </div>
    </div>
  );
}
