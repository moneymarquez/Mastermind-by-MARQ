import { useEffect, useMemo, useState } from 'react';
import './dispatch.css';
import { useDispatchCtx } from './DispatchContext';
import type { DispatchView } from './DispatchContext';
import { isOverdue, localDate } from './model';
import type { DispatchSession } from './model';
import MicButton, { useElapsed } from './MicButton';
import Board, { TaskSheet } from './Board';
import People from './People';
import { useCapture, openTyping, startCapture, submitTyped } from './capture';
import { BackIcon, GearIcon, PeopleIcon, Sheet, timeLabel, WalkieIcon } from './bits';

// Dispatch (spec 15 §2): Talk · Board · People. The mic owns the screen.

export const TALK_FLAG = 'dp:talk-on-open';

export default function DispatchScreen({ isMobile, onBack, dockBottom }: { isMobile: boolean; onBack?: () => void; dockBottom?: string }) {
  const { d, view, setView } = useDispatchCtx();
  const [settings, setSettings] = useState(false);
  // Spec 15 §2.3: columns side by side on desktop and iPad.
  const wide = typeof window !== 'undefined' && window.innerWidth >= 760;

  // /dispatch?talk=1 (home-screen shortcut): straight into recording after
  // a one-second countdown (spec 15 §3B).
  useEffect(() => {
    let flag = false;
    try { flag = sessionStorage.getItem(TALK_FLAG) === '1'; sessionStorage.removeItem(TALK_FLAG); } catch { /* ok */ }
    if (flag) { setView('talk'); void startCapture({ locked: true, countdown: 1 }); }
  }, [setView]);

  const tabs: { id: DispatchView; label: string }[] = [{ id: 'talk', label: 'Talk' }, { id: 'board', label: 'Board' }];
  if (d.canAssign) tabs.push({ id: 'people', label: 'People' });
  const seg = (
    <div className={`dp-seg dp-seg-dock${isMobile ? ' docked' : ''}`} role="tablist" aria-label="Dispatch sections" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}>{t.label}</button>)}
    </div>
  );

  return (
    <div className={`dp${isMobile ? ' has-dock' : ''}`} style={dockBottom ? ({ '--dp-dock-bottom': dockBottom } as React.CSSProperties) : undefined}>
      <div className="dp-head">
        {isMobile && onBack && <button type="button" className="dp-iconbtn" aria-label="Back" onClick={onBack}><BackIcon /></button>}
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><WalkieIcon size={24} /> Dispatch</h1>
        <button type="button" className="dp-iconbtn" aria-label="Dispatch settings" onClick={() => setSettings(true)}><GearIcon /></button>
        {d.canAssign && <button type="button" className="dp-iconbtn" aria-label={`${d.members.length} people on the team`} onClick={() => setView('people')}><PeopleIcon /> {d.members.length}</button>}
      </div>
      {!isMobile && seg}
      {d.error && <div role="alert" className="dp-card" style={{ marginTop: 12, borderColor: 'var(--dp-p1)', fontSize: 14 }}>{d.error} <button type="button" className="dp-more" onClick={d.clearError}>Dismiss</button></div>}

      <div style={{ marginTop: 12 }}>
        {view === 'talk' && <Talk />}
        {view === 'board' && <Board wide={wide} />}
        {view === 'people' && d.canAssign && <People />}
      </div>
      {isMobile && seg}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  );
}

function Talk() {
  const { d, setView, setBoardFilter, setBoardPerson } = useDispatchCtx();
  const c = useCapture();
  const elapsed = useElapsed(c.startedAt);
  const [session, setSession] = useState<DispatchSession | null>(null);
  const today = localDate();
  const mine = d.isLead ? d.tasks : d.tasks.filter((t) => t.assignee_member_id === d.me?.id);
  const open = mine.filter((t) => t.status === 'open').length;
  const overdue = mine.filter((t) => isOverdue(t, today)).length;
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const rec = c.phase === 'recording';

  return (
    <div>
      <div className="dp-date">Today · {dateLine}</div>
      <div className="dp-chips">
        <button type="button" className="dp-chip" onClick={() => { setBoardFilter('all'); setBoardPerson(null); setView('board'); }}><span className="dp-dot" /> {open} open</button>
        <button type="button" className="dp-chip" onClick={() => { setBoardFilter('overdue'); setBoardPerson(null); setView('board'); }}><span className="dp-dot red" /> {overdue} overdue</button>
      </div>

      <div className="dp-talk">
        <div className="dp-timer" aria-hidden="true">{rec ? elapsed : ''}</div>
        <MicButton />
        <div className="dp-hint">{rec ? (c.locked ? 'Locked — tap to stop' : 'Release to stop') : 'Hold to talk · tap to lock'}</div>
        <button type="button" className="dp-typeit" onClick={() => openTyping()}>Or type it ▸</button>
      </div>

      {d.canAssign && !d.members.length && !d.loading && (
        <div className="dp-empty" style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--mm-text)' }}>Add your first person</div>
          <div style={{ marginTop: 4 }}>Then say their name and the task lands on their board.</div>
          <button type="button" className="dp-btn primary" style={{ marginTop: 12 }} onClick={() => setView('people')}>+ Add person</button>
        </div>
      )}

      <Recent onOpen={setSession} />
      {session && <SessionDetail s={session} onClose={() => setSession(null)} />}
    </div>
  );
}

function summarize(tasks: { assignee_member_id: string | null; status: string }[], nameOf: (id: string | null) => string) {
  const counts = new Map<string, number>();
  for (const t of tasks) { const n = nameOf(t.assignee_member_id); counts.set(n, (counts.get(n) ?? 0) + 1); }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(', ');
}

function Recent({ onOpen }: { onOpen: (s: DispatchSession) => void }) {
  const { d, leadName } = useDispatchCtx();
  const nameOf = (id: string | null) => (id === null ? (d.isLead ? 'You' : leadName) : id === d.me?.id ? 'You' : d.members.find((m) => m.id === id)?.name.split(' ')[0] ?? 'Someone');
  const rows = useMemo(() => d.sessions.map((s) => ({ s, tasks: d.tasks.filter((t) => t.session_id === s.id) })).filter((r) => r.tasks.length).slice(0, 8), [d.sessions, d.tasks]);
  return (
    <section className="dp-section" aria-label="Recent dispatches">
      <div className="dp-label">Recent dispatches</div>
      {!rows.length && <div className="dp-empty">Nothing dispatched yet. Hold the mic and say what's next.</div>}
      {rows.map(({ s, tasks }) => {
        const open = tasks.filter((t) => t.status === 'open').length;
        return (
          <button key={s.id} type="button" className="dp-row" onClick={() => onOpen(s)}>
            <span className="dp-time">{timeLabel(s.created_at)}</span>
            <span className="dp-grow">{tasks.length} task{tasks.length === 1 ? '' : 's'} → {summarize(tasks, nameOf)}</span>
            <span className={open ? 'dp-sub' : 'dp-ok'}>{open ? `${open} open` : '✓ done'}</span>
          </button>
        );
      })}
    </section>
  );
}

/** Session detail (spec 15 §2.6): what was said, what it became, and a
 *  re-run if the words needed fixing. */
function SessionDetail({ s, onClose }: { s: DispatchSession; onClose: () => void }) {
  const { d, leadName } = useDispatchCtx();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(s.transcript);
  const [task, setTask] = useState<string | null>(null);
  const tasks = d.tasks.filter((t) => t.session_id === s.id);
  const notes = Array.isArray(s.notes) ? s.notes : [];
  const who = (id: string | null) => (id === null ? (d.isLead ? 'You' : leadName) : d.members.find((m) => m.id === id)?.name ?? 'You');
  const open = task ? d.tasks.find((t) => t.id === task) : undefined;
  if (open) return <TaskSheet task={open} onClose={() => setTask(null)} />;
  return (
    <Sheet title={`Dispatch · ${timeLabel(s.created_at)}${s.duration_s ? ` · ${Math.floor(s.duration_s / 60)}:${String(s.duration_s % 60).padStart(2, '0')}` : ''}`} onClose={onClose}>
      <div className="dp-label">What you said</div>
      {edit
        ? <textarea className="dp-textarea" value={text} onChange={(e) => setText(e.target.value)} aria-label="Transcript" />
        : <div style={{ fontSize: 15, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.transcript || <span className="dp-sub">No words saved.</span>}</div>}
      <div className="dp-actions">
        {edit
          ? <button type="button" className="dp-btn primary" disabled={!text.trim()} onClick={() => { onClose(); submitTyped(text); }}>Re-run extraction</button>
          : <button type="button" className="dp-btn" onClick={() => setEdit(true)}>Edit transcript</button>}
      </div>
      <div className="dp-sub" style={{ marginTop: 6 }}>Audio isn't kept — only the words.{edit ? ' Re-running makes a fresh set of tasks for Review; the ones below stay as they are.' : ''}</div>
      <div className="dp-label" style={{ marginTop: 18 }}>Tasks it made ({tasks.length})</div>
      {tasks.map((t) => (
        <button key={t.id} type="button" className="dp-row" onClick={() => setTask(t.id)}>
          <span className={`dp-pill p${t.priority}`}>P{t.priority}</span>
          <span className="dp-grow" style={{ textDecoration: t.status === 'done' ? 'line-through' : undefined }}>{t.title}</span>
          <span className="dp-sub">{who(t.assignee_member_id)}</span>
        </button>
      ))}
      {notes.length > 0 && <><div className="dp-label" style={{ marginTop: 18 }}>Notes</div><ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>{notes.map((n, i) => <li key={i}>{String(n)}</li>)}</ul></>}
    </Sheet>
  );
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Dispatch settings" onClose={onClose}>
      <div className="dp-card" style={{ fontSize: 14, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700 }}>Recordings</div>
        <div className="dp-sub" style={{ marginTop: 4 }}>Off — only the words are saved. The audio stays on this device just long enough to retry a failed transcription, then it's gone.</div>
      </div>
      <div className="dp-card" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
        <div style={{ fontWeight: 700 }}>One tap from your home screen</div>
        <div className="dp-sub" style={{ marginTop: 4 }}>Add the Dispatch widget on Overview (Edit widgets), or save <b>/dispatch?talk=1</b> to your phone's home screen — it opens straight into recording. On Android, long-press the app icon for "Talk to Dispatch".</div>
      </div>
      <div className="dp-actions"><button type="button" className="dp-btn" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}
