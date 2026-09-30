import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './dispatch.css';
import { useDispatchCtx } from './DispatchContext';
import { useCapture, configureCapture, stopCapture, resetCapture, retryTranscription, submitTyped, openTyping, setCapturePhase, captureError, getCapture, transcriptOf, startCapture } from './capture';
import type { DraftTask, DispatchMember, Extraction } from './model';
import { dueLabel } from './model';
import { Avatar, AssigneePicker, DatePicker, PriorityPicker, PriorityPill, Highlighted, CheckMark, Grip, StopIcon, haptic, prefersReducedMotion } from './bits';
import { useElapsed } from './MicButton';

// Everything that floats over the app during a Dispatch: the live
// transcript sheet while recording, the recovery sheet when something
// failed, the "type it" sheet, Review, and the toast after sending.
// Mounted once in Stage so the home widget's mic works from anywhere.

const STASH = 'dp:last-words';
function stash(text: string) { try { if (text) localStorage.setItem(STASH, text); } catch { /* private mode */ } }
export function stashedWords(): string { try { return localStorage.getItem(STASH) ?? ''; } catch { return ''; } }
function clearStash() { try { localStorage.removeItem(STASH); } catch { /* ok */ } }

type Question = { key: string; text: string; options: string[] };
let keySeq = 0;
const nextKey = () => `t${++keySeq}`;

export default function DispatchLayer() {
  const { d, openDispatch } = useDispatchCtx();
  const c = useCapture();
  const [draft, setDraft] = useState<DraftTask[] | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const names = useMemo(() => d.members.map((m) => m.name), [d.members]);

  const runExtract = useCallback(async (text: string) => {
    stash(text);
    setCapturePhase('extracting', { finalText: text });
    setDraft(null);
    const started = Date.now();
    const res = await d.extract(text);
    // Hold the shimmer long enough to read as "working", never a blank flash.
    const wait = 400 - (Date.now() - started); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (getCapture().phase !== 'extracting') return; // cancelled meanwhile
    if (res.error) { captureError('extract', res.error); return; }
    const tasks = (res.tasks ?? []).map((t) => ({ ...t, key: nextKey() }));
    setExtraction({ tasks: res.tasks ?? [], questions: res.questions ?? [], notes: res.notes ?? [] });
    // Questions point at tasks by index — carry them across the priority sort.
    const qs = (res.questions ?? []).flatMap((q) => (tasks[q.task_index] ? [{ key: tasks[q.task_index].key, text: q.text, options: q.options ?? [] }] : []));
    setDraft([...tasks].sort((a, b) => a.priority - b.priority));
    setQuestions(qs);
    setNotes(res.notes ?? []);
    setCapturePhase('review');
  }, [d]);

  useEffect(() => { configureCapture({ onStopped: (t) => void runExtract(t), transcribe: d.transcribe }); }, [runExtract, d.transcribe]);

  const showToast = (msg: string) => { setToast(msg); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 5000); };
  const close = () => { stash(transcriptOf(c)); resetCapture(); setDraft(null); };

  return (
    <>
      {(c.phase === 'recording' || c.phase === 'countdown' || c.phase === 'transcribing') && <TranscriptSheet names={names} />}
      {c.phase === 'error' && <ErrorSheet onClose={close} />}
      {c.phase === 'typing' && <TypeSheet onClose={() => resetCapture()} />}
      {(c.phase === 'extracting' || c.phase === 'review') && (
        <Review
          loading={c.phase === 'extracting'} draft={draft ?? []} setDraft={(fn) => setDraft((x) => fn(x ?? []))}
          questions={questions} notes={notes} members={d.members} canAssign={d.canAssign} isLead={d.isLead}
          onAddMember={d.isLead ? (name) => d.addMember({ name }) : undefined}
          onClose={close}
          onEditWords={() => openTyping(transcriptOf(c))}
          onDispatch={async (tasks) => {
            const r = await d.dispatch(tasks, { transcript: transcriptOf(getCapture()), extraction, notes, duration_s: getCapture().durationS });
            if ('error' in r && r.error && !('session' in r)) return { error: r.error };
            const notified = ('notified' in r ? r.notified : []) ?? [];
            const reached = notified.filter((n) => n.via).map((n) => n.name.split(' ')[0]);
            return { message: `${tasks.length} task${tasks.length === 1 ? '' : 's'} dispatched${reached.length ? ` · ${reached.join(', ')} notified` : ''}.` };
          }}
          onDone={(message) => { clearStash(); resetCapture(); setDraft(null); showToast(message); }}
        />
      )}
      {toast && <button type="button" className="dp-toast" onClick={() => { setToast(null); openDispatch('board'); }} role="status">{toast} <span aria-hidden="true">›</span></button>}
    </>
  );
}

// ── live transcript ───────────────────────────────────────────────────
function TranscriptSheet({ names }: { names: string[] }) {
  const c = useCapture();
  const elapsed = useElapsed(c.startedAt);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [c.finalText, c.interim]);
  // Last sentence highlighted: split the settled text at its last sentence end.
  const text = c.finalText;
  const cut = Math.max(text.lastIndexOf('. '), text.lastIndexOf('? '), text.lastIndexOf('! '));
  const settled = cut > 0 ? text.slice(0, cut + 1) : '';
  const last = cut > 0 ? text.slice(cut + 2) : text;
  const bars = [0.5, 0.9, 0.65, 1, 0.7];
  return (
    <div className="dp-layer">
      <div className="dp-sheet" role="region" aria-label="Live transcript">
        <div className="dp-grab" />
        <div ref={box} className="dp-transcript" aria-live="polite" aria-atomic="false">
          {c.phase === 'countdown' && <span className="dim">Starting in {c.countdown}…</span>}
          {c.phase === 'transcribing' && <span className="dim">Turning the recording into words…</span>}
          {c.phase === 'recording' && !text && !c.interim && <span className="dim">Listening — say what needs doing and who's on it.</span>}
          {settled && <Highlighted text={`${settled} `} names={names} className="dim" />}
          {last && <span className="dp-w last"><Highlighted text={last} names={names} /></span>}
          {c.interim && <span className="dp-w"> <Highlighted text={c.interim} names={names} className="dim" /></span>}
        </div>
        <div className="dp-sheet-foot">
          <span className="dp-listening">
            {c.phase === 'recording' && <span className="dp-bars" aria-hidden="true">{bars.map((b, i) => <i key={i} style={{ height: `${4 + Math.min(14, c.level * 22 * b)}px` }} />)}</span>}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{elapsed}</span>
            {c.phase === 'recording' && <span>{c.locked ? 'Locked — hands free' : 'Release to stop'}</span>}
          </span>
          {c.phase === 'recording' && <button type="button" className="dp-stop" onClick={() => void stopCapture()}><StopIcon /> Stop</button>}
          {c.phase === 'countdown' && <button type="button" className="dp-btn" onClick={() => void stopCapture()}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}

// ── recovery ──────────────────────────────────────────────────────────
function ErrorSheet({ onClose }: { onClose: () => void }) {
  const c = useCapture();
  const heard = c.finalText;
  const title = c.errorKind === 'denied' ? 'The microphone is off' : c.errorKind === 'extract' ? "Couldn't sort that into tasks" : c.errorKind === 'transcribe' ? "Couldn't turn that into words" : c.errorKind === 'no-speech' ? "Didn't catch anything" : 'Something went wrong';
  const body = c.errorKind === 'denied'
    ? 'Mastermind needs the microphone to hear you. Turn it on in your browser or phone settings for this site — or type it instead.'
    : c.errorKind === 'extract' ? `${c.error ?? ''} Nothing you said is lost.` : c.error ?? '';
  return (
    <div className="dp-layer">
      <div className="dp-scrim" onClick={onClose} />
      <div className="dp-sheet" role="alertdialog" aria-label={title}>
        <div className="dp-grab" />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14.5, color: 'var(--mm-dim)', marginTop: 6, lineHeight: 1.5 }}>{body}</div>
        {heard && <div className="dp-quote" style={{ maxHeight: 120, overflowY: 'auto' }}>“{heard}”</div>}
        <div className="dp-actions">
          {c.errorKind === 'extract' && <button type="button" className="dp-btn primary" onClick={() => submitTyped(heard)}>Try again</button>}
          {c.errorKind === 'transcribe' && c.hasAudio && <button type="button" className="dp-btn primary" onClick={() => void retryTranscription()}>Retry</button>}
          {c.errorKind === 'transcribe' && heard && <button type="button" className="dp-btn" onClick={() => submitTyped(heard)}>Use what was heard</button>}
          {c.errorKind === 'no-speech' && <button type="button" className="dp-btn primary" onClick={() => void startCapture({ locked: true })}>Talk again</button>}
          <button type="button" className="dp-btn" onClick={() => openTyping(heard)}>{heard ? 'Edit the words' : 'Type it instead'}</button>
          <button type="button" className="dp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function TypeSheet({ onClose }: { onClose: () => void }) {
  const c = useCapture();
  const [text, setText] = useState(c.finalText || '');
  return (
    <div className="dp-layer">
      <div className="dp-scrim" onClick={onClose} />
      <form className="dp-sheet" role="dialog" aria-label="Type it" onSubmit={(e) => { e.preventDefault(); submitTyped(text); }}>
        <div className="dp-grab" />
        <label htmlFor="dp-type" style={{ fontSize: 16, fontWeight: 700 }}>Type it</label>
        <div className="dp-sub" style={{ margin: '4px 0 10px' }}>Write it the way you'd say it — names, what, and when.</div>
        <textarea id="dp-type" className="dp-textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Mikhail — get the Johnson bid out by Thursday, that's the big one. I'll sign the lease Friday." />
        <div className="dp-actions">
          <button type="submit" className="dp-btn primary" disabled={!text.trim()}>Review tasks</button>
          {!text && stashedWords() && <button type="button" className="dp-btn" onClick={() => setText(stashedWords())}>Bring back last words</button>}
          <button type="button" className="dp-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

// ── review ────────────────────────────────────────────────────────────
type Picker = { kind: 'who' | 'when' | 'prio'; key: string } | null;

function Review({ loading, draft, setDraft, questions, notes, members, canAssign, isLead, onAddMember, onClose, onEditWords, onDispatch, onDone }: {
  loading: boolean; draft: DraftTask[]; setDraft: (fn: (d: DraftTask[]) => DraftTask[]) => void;
  questions: Question[]; notes: string[];
  members: DispatchMember[]; canAssign: boolean; isLead: boolean; onAddMember?: (name: string) => Promise<DispatchMember | null>;
  onClose: () => void; onEditWords: () => void; onDispatch: (tasks: DraftTask[]) => Promise<{ error?: string; message?: string }>; onDone: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [sending, setSending] = useState(false);
  const [landed, setLanded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const open = draft.filter((t) => t.confidence === 'low').length;
  const byKey = (k: string) => draft.find((t) => t.key === k);
  const patch = (key: string, p: Partial<DraftTask>) => setDraft((ds) => ds.map((t) => (t.key === key ? { ...t, ...p } : t)));
  const remove = (key: string) => { setDraft((ds) => ds.filter((t) => t.key !== key)); haptic(8); };
  const assign = (key: string, m: DispatchMember | null) => { patch(key, { assignee_member_id: m?.id ?? null, assignee_name: m?.name ?? 'You', confidence: 'high' }); setPicker(null); };

  // Reorder = reprioritise: a card takes the priority of where it lands.
  const move = (key: string, to: number) => setDraft((ds) => {
    const from = ds.findIndex((t) => t.key === key); if (from < 0 || to === from || to < 0 || to >= ds.length) return ds;
    const next = [...ds]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    const neighbour = next[to + 1] ?? next[to - 1];
    const priority = neighbour ? neighbour.priority : item.priority;
    next[to] = { ...item, priority };
    return next;
  });
  const onHandleDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragKey(key);
  };
  const onHandleMove = (e: React.PointerEvent, key: string) => {
    if (dragKey !== key || !list.current) return;
    const cards = [...list.current.querySelectorAll<HTMLElement>('[data-key]')];
    const from = cards.findIndex((el) => el.dataset.key === key);
    // Where it would sit among the others: how many of them are above the finger.
    const target = cards.filter((el) => el.dataset.key !== key).filter((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 < e.clientY; }).length;
    if (target !== from) move(key, target);
  };
  const onHandleKey = (e: React.KeyboardEvent, key: string, i: number) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(key, i - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(key, i + 1); }
  };

  const send = async () => {
    if (open || !draft.length || sending) return;
    setSending(true); setErr(null);
    const reduced = prefersReducedMotion();
    const cards = [...(list.current?.querySelectorAll<HTMLElement>('[data-key]') ?? [])];
    cards.forEach((el, i) => { el.style.animationDelay = `${reduced ? 0 : i * 60}ms`; el.classList.add('dp-fly'); });
    const fly = new Promise((r) => setTimeout(r, reduced ? 200 : 420 + cards.length * 60));
    const [res] = await Promise.all([onDispatch(draft), fly]);
    if (res.error) {
      cards.forEach((el) => { el.classList.remove('dp-fly'); el.style.animationDelay = ''; });
      setSending(false); setErr(res.error);
      return;
    }
    // Cards are gone; the check lands, then back to where they were.
    setLanded(true); haptic(20);
    await new Promise((r) => setTimeout(r, reduced ? 350 : 650));
    onDone(res.message ?? 'Dispatched.');
  };

  const asked = new Set(questions.map((q) => q.key));
  const openQs = [...questions, ...draft.filter((t) => !asked.has(t.key)).map((t) => ({ key: t.key, text: `Who should do "${t.title}"?`, options: [] as string[] }))]
    .filter((q) => byKey(q.key)?.confidence === 'low');
  const nameFor = (o: string) => (/^me$/i.test(o) ? null : members.find((m) => m.name.toLowerCase() === o.toLowerCase() || m.name.split(' ')[0].toLowerCase() === o.toLowerCase()) ?? undefined);
  const pickerTask = picker ? byKey(picker.key) : undefined;

  return (
    <div className="dp-layer">
      <div className="dp-review" role="dialog" aria-modal="true" aria-label="Review tasks">
        <div className="dp-review-inner">
          <div className="dp-review-head">
            <button type="button" className="dp-iconbtn" aria-label="Close review — your words are kept" onClick={onClose}>✕</button>
            <h2>{loading ? 'Reading your tasks…' : `Review ${draft.length} task${draft.length === 1 ? '' : 's'}`}</h2>
            <button type="button" className="dp-iconbtn" disabled={loading} aria-pressed={editing} onClick={() => setEditing((x) => !x)}>{editing ? 'Done' : 'Edit'}</button>
          </div>

          <div className="dp-cards" ref={list} aria-busy={loading}>
            {loading && [0, 1, 2].map((i) => <div key={i} className="dp-shimmer" style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true" />)}
            {!loading && draft.map((t, i) => (
              <SwipeCard key={t.key} k={t.key} enterDelay={i * 70} onDelete={() => remove(t.key)} dragging={dragKey === t.key} low={t.confidence === 'low'}>
                <div className="dp-card-top">
                  <PriorityPill p={t.priority} reason={t.priority_reason} onTap={() => setPicker({ kind: 'prio', key: t.key })} />
                  {editing && <button type="button" className="dp-btn" style={{ minHeight: 32, color: 'var(--dp-p1)' }} onClick={() => remove(t.key)} aria-label={`Delete ${t.title}`}>Delete</button>}
                  <button type="button" className="dp-handle" aria-label={`Reorder ${t.title}. Use arrow keys.`}
                    onPointerDown={(e) => onHandleDown(e, t.key)} onPointerMove={(e) => onHandleMove(e, t.key)} onPointerUp={() => setDragKey(null)} onPointerCancel={() => setDragKey(null)}
                    onKeyDown={(e) => onHandleKey(e, t.key, i)}><Grip /></button>
                </div>
                <TitleEdit value={t.title} forceEdit={editing} onChange={(v) => patch(t.key, { title: v })} />
                <div className="dp-meta">
                  <button type="button" className={`dp-person${t.confidence === 'low' ? ' low' : ''}`} disabled={!canAssign}
                    aria-label={`Assigned to ${t.assignee_name}${t.confidence === 'low' ? ', not sure — tap to fix' : ''}`}
                    onClick={() => canAssign && setPicker({ kind: 'who', key: t.key })}>
                    <Avatar member={members.find((m) => m.id === t.assignee_member_id) ?? null} name={t.assignee_name} />
                    {t.assignee_member_id === null && isLead ? 'You' : t.assignee_name}{t.confidence === 'low' ? '?' : ''}
                  </button>
                  <button type="button" className="dp-datechip" aria-label={`Due ${dueLabel(t.due_date)} — tap to change`} onClick={() => setPicker({ kind: 'when', key: t.key })}>
                    <span aria-hidden="true">📅</span>{dueLabel(t.due_date)}
                  </button>
                </div>
                {t.source_quote && <div className="dp-quote">“{t.source_quote}”</div>}
              </SwipeCard>
            ))}
            {!loading && !draft.length && (
              <div className="dp-empty">No tasks came out of that. <button type="button" className="dp-typeit" onClick={onEditWords}>Edit the words</button></div>
            )}
          </div>

          {!loading && openQs.length > 0 && (
            <div className="dp-questions" role="group" aria-label="Questions">
              {openQs.map((q) => {
                const t = byKey(q.key)!;
                const opts = (q.options.length ? q.options : [...members.slice(0, 3).map((m) => m.name), 'me']).filter((o, i, a) => a.indexOf(o) === i);
                return (
                  <div key={t.key} style={{ marginBottom: 12 }}>
                    <div className="q"><span aria-hidden="true">❓ </span>{q.text}</div>
                    <div className="dp-opts opts">
                      {opts.map((o) => { const m = nameFor(o); if (m === undefined) return null; return <button key={o} type="button" className="dp-btn" onClick={() => assign(t.key, m)}>{m ? m.name : 'Me'}</button>; })}
                      <button type="button" className="dp-btn" onClick={() => setPicker({ kind: 'who', key: t.key })}>Someone else…</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && notes.length > 0 && (
            <div className="dp-notes">
              <button type="button" className="dp-more" aria-expanded={showNotes} onClick={() => setShowNotes((x) => !x)}><span aria-hidden="true">📝</span> {notes.length} note{notes.length === 1 ? '' : 's'} saved {showNotes ? '▾' : '▸'}</button>
              {showNotes && <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{notes.map((n, i) => <li key={i} style={{ marginTop: 4 }}>{n}</li>)}</ul>}
            </div>
          )}
          {!loading && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <button type="button" className="dp-more" onClick={() => setDraft((ds) => [...ds, { key: nextKey(), title: 'New task', assignee_member_id: null, assignee_name: 'You', confidence: 'high', priority: 3, priority_reason: '', due_date: null, source_quote: '' }])}>+ Add a task</button>
              <button type="button" className="dp-more" onClick={onEditWords}>Edit the words</button>
            </div>
          )}
          {err && <div role="alert" style={{ marginTop: 12, color: 'var(--dp-p1)', fontSize: 14 }}>{err}</div>}
        </div>

        {!loading && draft.length > 0 && (
          <div className="dp-cta-bar">
            <button type="button" className="dp-cta" disabled={!!open || sending} onClick={() => void send()}>
              {open ? `Answer ${open} question${open === 1 ? '' : 's'} first` : sending ? 'Dispatching…' : <>Dispatch {draft.length} task{draft.length === 1 ? '' : 's'} <span aria-hidden="true">➤</span></>}
            </button>
          </div>
        )}
        {landed && <div className="dp-check" aria-hidden="true"><CheckMark /></div>}
      </div>

      {picker?.kind === 'who' && pickerTask && <AssigneePicker members={members} value={pickerTask.assignee_member_id} onPick={(m) => assign(pickerTask.key, m)} onClose={() => setPicker(null)} allowAdd={!!onAddMember} onAdd={onAddMember} />}
      {picker?.kind === 'when' && pickerTask && <DatePicker value={pickerTask.due_date} onPick={(v) => { patch(pickerTask.key, { due_date: v }); setPicker(null); }} onClose={() => setPicker(null)} />}
      {picker?.kind === 'prio' && pickerTask && <PriorityPicker value={pickerTask.priority} onPick={(p) => { patch(pickerTask.key, { priority: p }); setDraft((ds) => [...ds].sort((a, b) => a.priority - b.priority)); setPicker(null); }} onClose={() => setPicker(null)} />}
    </div>
  );
}

function TitleEdit({ value, forceEdit, onChange }: { value: string; forceEdit: boolean; onChange: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  if (edit || forceEdit) {
    return <input className="dp-title-input" autoFocus={edit} value={value} maxLength={200} aria-label="Task title"
      onChange={(e) => onChange(e.target.value)} onBlur={() => { setEdit(false); if (!value.trim()) onChange('Untitled task'); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
  }
  return <button type="button" className="dp-task-title" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'text', display: 'block', width: '100%' }} onClick={() => setEdit(true)} aria-label={`${value} — tap to edit`}>{value}</button>;
}

/** Swipe left to delete (spec 15 §2.2); the Edit mode offers a button too. */
function SwipeCard({ k, children, onDelete, enterDelay, dragging, low }: { k: string; children: React.ReactNode; onDelete: () => void; enterDelay: number; dragging: boolean; low: boolean }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('button, input, textarea, select')) return;
    start.current = { x: e.clientX, y: e.clientY, on: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current; if (!s) return;
    const x = e.clientX - s.x; const y = e.clientY - s.y;
    if (!s.on && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.4) { s.on = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    if (s.on) setDx(Math.min(0, x));
  };
  const onUp = () => { const s = start.current; start.current = null; if (s?.on && dx < -110) { setDx(-600); setTimeout(onDelete, 180); } else setDx(0); };
  return (
    <div data-key={k} className="dp-enter" style={{ position: 'relative', animationDelay: `${enterDelay}ms` }}>
      {dx < 0 && <div className="dp-swipe-bg" aria-hidden="true">Delete</div>}
      <div className={`dp-card dp-swipe${low ? ' low' : ''}${dragging ? ' dragging' : ''}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current?.on ? 'none' : undefined }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {children}
      </div>
    </div>
  );
}
