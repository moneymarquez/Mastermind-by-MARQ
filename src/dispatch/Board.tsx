import { useMemo, useState } from 'react';
import { useDispatchCtx } from './DispatchContext';
import type { DispatchMember, DispatchTask } from './model';
import { dueLabel, isOverdue, localDate, sortTasks } from './model';
import { Avatar, AssigneePicker, DatePicker, PriorityPicker, PriorityPill, Sheet, timeLabel, haptic } from './bits';

// Board (spec 15 §2.3): who has what. Phone = person tabs, wide = columns.

export function inFilter(t: DispatchTask, f: 'week' | 'overdue' | 'all', today = localDate()): boolean {
  if (t.status !== 'open') return false;
  if (f === 'all') return true;
  if (f === 'overdue') return isOverdue(t, today);
  const wk = new Date(`${today}T12:00:00`); wk.setDate(wk.getDate() + 7);
  return !t.due_date || t.due_date <= localDate(wk);
}

export default function Board({ wide }: { wide: boolean }) {
  const { d, boardPerson, setBoardPerson, boardFilter, setBoardFilter } = useDispatchCtx();
  const [sort, setSort] = useState<'priority' | 'due'>('priority');
  const [openTask, setOpenTask] = useState<string | null>(null);
  const today = localDate();
  // Lanes: "You" first, then everyone else. A member's board is just theirs.
  const lanes = useMemo(() => {
    const you = { key: 'me', name: 'You', member: d.isLead ? null : d.me, match: (t: DispatchTask) => (d.isLead ? t.assignee_member_id === null : t.assignee_member_id === d.me?.id) };
    const others = d.canAssign ? d.members.filter((m) => m.id !== d.me?.id).map((m) => ({ key: m.id, name: m.name, member: m as DispatchMember | null, match: (t: DispatchTask) => t.assignee_member_id === m.id })) : [];
    if (d.canAssign && !d.isLead) others.unshift({ key: 'lead', name: 'Team lead', member: null, match: (t: DispatchTask) => t.assignee_member_id === null });
    return [you, ...others];
  }, [d.members, d.me, d.isLead, d.canAssign]);
  const sorter = sort === 'priority' ? sortTasks : (a: DispatchTask, b: DispatchTask) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || sortTasks(a, b);
  const selected = lanes.find((l) => l.key === (boardPerson ?? 'me')) ?? lanes[0];

  const lane = (l: (typeof lanes)[number]) => {
    const all = d.tasks.filter(l.match);
    const shown = all.filter((t) => inFilter(t, boardFilter, today)).sort(sorter);
    const doneToday = all.filter((t) => t.status === 'done' && t.done_at && localDate(new Date(t.done_at)) === today);
    return { all, shown, doneToday, open: all.filter((t) => t.status === 'open').length, overdue: all.filter((t) => isOverdue(t, today)).length };
  };
  const task = openTask ? d.tasks.find((t) => t.id === openTask) : undefined;

  return (
    <div>
      <div className="dp-bar">
        <h2>Board</h2>
        <select className="dp-select" aria-label="Show" value={boardFilter} onChange={(e) => setBoardFilter(e.target.value as typeof boardFilter)}>
          <option value="week">This week</option><option value="overdue">Overdue</option><option value="all">All open</option>
        </select>
        <select className="dp-select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="priority">By priority</option><option value="due">By due date</option>
        </select>
      </div>

      {!wide && lanes.length > 1 && (
        <div className="dp-people" role="tablist" aria-label="People">
          {lanes.map((l) => { const s = lane(l); return (
            <button key={l.key} type="button" role="tab" aria-selected={selected.key === l.key} className="dp-ptab" onClick={() => setBoardPerson(l.key)}>
              <Avatar member={l.member} name={l.name} />
              <span>{l.name.split(' ')[0]}</span>
              <span className="n">{s.open}{s.overdue > 0 && <span className="dp-overdue"> · {s.overdue}!</span>}</span>
            </button>
          ); })}
        </div>
      )}

      {wide ? (
        <div className="dp-cols">
          {lanes.map((l) => { const s = lane(l); return (
            <section key={l.key} className="dp-col" aria-label={l.name}>
              <div className="dp-col-head"><Avatar member={l.member} name={l.name} /> {l.name}<span className="dp-sub" style={{ marginLeft: 'auto' }}>{s.open} open{s.overdue ? <span className="dp-overdue"> · {s.overdue} overdue</span> : ''}</span></div>
              <LaneBody s={s} onOpen={setOpenTask} empty={l.key === 'me' ? 'Nothing open. Hold the mic and say what’s next.' : 'Nothing open.'} />
            </section>
          ); })}
        </div>
      ) : (() => { const s = lane(selected); return (
        <section aria-label={selected.name}>
          <div className="dp-summary">{selected.name} · {s.open} open{s.overdue ? <span className="dp-overdue"> · {s.overdue} overdue</span> : ''}</div>
          <LaneBody s={s} onOpen={setOpenTask} empty="Nothing open. Hold the mic and say what’s next." />
        </section>
      ); })()}

      <Activity />
      {task && <TaskSheet task={task} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function LaneBody({ s, onOpen, empty }: { s: { shown: DispatchTask[]; doneToday: DispatchTask[] }; onOpen: (id: string) => void; empty: string }) {
  const [showDone, setShowDone] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {s.shown.map((t) => <TaskCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
      {!s.shown.length && <div className="dp-empty">{empty}</div>}
      {s.doneToday.length > 0 && (
        <>
          <button type="button" className="dp-more" aria-expanded={showDone} onClick={() => setShowDone((x) => !x)}>✓ Completed today ({s.doneToday.length}) {showDone ? '▾' : '▸'}</button>
          {showDone && s.doneToday.map((t) => <TaskCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
        </>
      )}
    </div>
  );
}

export function TaskCard({ t, onOpen, compact }: { t: DispatchTask; onOpen: () => void; compact?: boolean }) {
  const { d, leadName } = useDispatchCtx();
  const [move, setMove] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const overdue = isOverdue(t);
  const comments = d.comments.filter((c) => c.task_id === t.id).length;
  // Spec 15 §2.3 reads "from James" on James's own board too.
  const from = t.created_by === t.owner_id ? leadName : d.members.find((m) => m.user_id === t.created_by)?.name ?? 'the team';
  const done = t.status === 'done';
  const markDone = async () => { setLeaving(!done); haptic(15); setTimeout(() => void d.setDone(t, !done), done ? 0 : 200); };
  return (
    <article className={`dp-card${t.needs_help ? ' help' : ''}${done ? ' done' : ''}${leaving ? ' dp-collapse' : ''}`} aria-label={t.title}>
      <div className="dp-card-top">
        <PriorityPill p={t.priority} reason={t.priority_reason} overdue={overdue} />
        {t.needs_help && <span className="dp-tag" style={{ color: 'var(--dp-q)' }}>Needs help</span>}
      </div>
      <button type="button" onClick={onOpen} className="dp-task-title" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }}>{t.title}</button>
      <div className="dp-meta">
        <span className={overdue ? 'dp-overdue' : undefined}>{t.due_date ? `Due ${dueLabel(t.due_date)}` : 'No due date'}</span>
        {!compact && <span>from {from} · {timeLabel(t.created_at)}</span>}
        {comments > 0 && <button type="button" className="dp-more" style={{ minHeight: 24 }} onClick={onOpen} aria-label={`${comments} comments`}>💬 {comments}</button>}
      </div>
      {compact && t.source_quote && <div className="dp-quote">“{t.source_quote}”</div>}
      {!compact && (
        <div className="dp-actions">
          <button type="button" className="dp-btn ok" onClick={() => void markDone()}>{done ? 'Reopen' : '✓ Done'}</button>
          {d.canAssign && t.assignee_member_id && !done && <button type="button" className="dp-btn" onClick={async () => { const r = await d.nudge(t); setMsg(r.error ?? `Nudged by ${r.via}.`); }}>Nudge</button>}
          {d.isLead && !done && <button type="button" className="dp-btn" onClick={() => setMove(true)}>Move</button>}
          {!d.isLead && !done && <button type="button" className="dp-btn" onClick={() => { void d.setHelp(t, !t.needs_help); if (!t.needs_help) onOpen(); }}>{t.needs_help ? 'Help sorted' : 'Need help'}</button>}
        </div>
      )}
      {msg && <div role="status" className="dp-sub" style={{ marginTop: 8 }}>{msg}</div>}
      {move && <MoveSheet t={t} onClose={() => setMove(false)} />}
    </article>
  );
}

function MoveSheet({ t, onClose }: { t: DispatchTask; onClose: () => void }) {
  const { d } = useDispatchCtx();
  const [step, setStep] = useState<'menu' | 'who' | 'when' | 'prio'>('menu');
  if (step === 'who') return <AssigneePicker members={d.members} value={t.assignee_member_id} onPick={(m) => { void d.moveTask(t, { assignee_member_id: m?.id ?? null }); onClose(); }} onClose={onClose} />;
  if (step === 'when') return <DatePicker value={t.due_date} onPick={(v) => { void d.moveTask(t, { due_date: v }); onClose(); }} onClose={onClose} />;
  if (step === 'prio') return <PriorityPicker value={t.priority} onPick={(p) => { void d.moveTask(t, { priority: p }); onClose(); }} onClose={onClose} />;
  return (
    <Sheet title={`Move “${t.title}”`} onClose={onClose}>
      <div className="dp-quick">
        <button type="button" className="dp-btn" onClick={() => setStep('who')}>Reassign</button>
        <button type="button" className="dp-btn" onClick={() => setStep('when')}>Re-date</button>
        <button type="button" className="dp-btn" onClick={() => setStep('prio')}>Priority</button>
        <button type="button" className="dp-btn" style={{ color: 'var(--dp-p1)' }} onClick={() => { void d.removeTask(t); onClose(); }}>Delete</button>
      </div>
    </Sheet>
  );
}

export function TaskSheet({ task: t, onClose }: { task: DispatchTask; onClose: () => void }) {
  const { d, leadName } = useDispatchCtx();
  const [body, setBody] = useState('');
  const thread = d.comments.filter((c) => c.task_id === t.id);
  const who = (id: string) => (id === d.me?.user_id || (d.isLead && id === t.owner_id) ? 'You' : id === t.owner_id ? leadName : d.members.find((m) => m.user_id === id)?.name ?? 'Someone');
  const assignee = t.assignee_member_id ? d.members.find((m) => m.id === t.assignee_member_id)?.name ?? (d.me?.id === t.assignee_member_id ? 'You' : 'Teammate') : d.isLead ? 'You' : leadName;
  return (
    <Sheet title={t.title} onClose={onClose}>
      <div className="dp-meta" style={{ marginTop: 0 }}>
        <PriorityPill p={t.priority} reason={t.priority_reason} overdue={isOverdue(t)} />
        <span>{assignee}</span><span>{t.due_date ? `Due ${dueLabel(t.due_date)}` : 'No due date'}</span>
      </div>
      {t.priority_reason && <div className="dp-sub" style={{ marginTop: 6 }}>Why {`P${t.priority}`}: {t.priority_reason}</div>}
      {t.source_quote && <div className="dp-quote">“{t.source_quote}”</div>}
      <div className="dp-label" style={{ marginTop: 18 }}>Thread</div>
      {!thread.length && <div className="dp-sub">No comments yet.</div>}
      {thread.map((c) => (
        <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--mm-line)' }}>
          <div style={{ fontSize: 12.5, color: 'var(--mm-faint)' }}>{who(c.author_id)} · {timeLabel(c.created_at)}</div>
          <div style={{ fontSize: 14.5, marginTop: 2, overflowWrap: 'anywhere' }}>{c.body}</div>
        </div>
      ))}
      <form style={{ display: 'flex', gap: 8, marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); if (await d.comment(t, body)) setBody(''); }}>
        <input className="dp-field" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.needs_help && !d.isLead ? `What do you need from ${leadName}?` : 'Add a comment'} aria-label="Comment" />
        <button type="submit" className="dp-btn primary" disabled={!body.trim()}>Send</button>
      </form>
      <div className="dp-actions">
        <button type="button" className="dp-btn ok" onClick={() => { void d.setDone(t, t.status !== 'done'); onClose(); }}>{t.status === 'done' ? 'Reopen' : '✓ Done'}</button>
        <button type="button" className="dp-btn" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  );
}

/** "What changed today" — derived from the rows, no activity table needed. */
function Activity() {
  const { d, leadName } = useDispatchCtx();
  const today = localDate();
  const name = (userId: string | null, memberId?: string | null) => {
    if (memberId) return d.members.find((m) => m.id === memberId)?.name ?? 'Someone';
    if (userId && d.me?.user_id === userId) return 'You';
    if (userId === d.tasks[0]?.owner_id) return d.isLead ? 'You' : leadName;
    return d.members.find((m) => m.user_id === userId)?.name ?? 'Someone';
  };
  const items: { at: string; text: string }[] = [];
  for (const t of d.tasks) {
    if (t.status === 'done' && t.done_at && localDate(new Date(t.done_at)) === today) items.push({ at: t.done_at, text: `${t.assignee_member_id ? name(null, t.assignee_member_id) : d.isLead ? 'You' : leadName} completed “${t.title}”` });
    if (t.needs_help && localDate(new Date(t.updated_at)) === today) items.push({ at: t.updated_at, text: `${name(null, t.assignee_member_id)} asked for help on “${t.title}”` });
  }
  for (const c of d.comments) if (localDate(new Date(c.created_at)) === today) {
    const t = d.tasks.find((x) => x.id === c.task_id);
    items.push({ at: c.created_at, text: `${name(c.author_id)} commented on “${t?.title ?? 'a task'}”` });
  }
  for (const s of d.sessions) if (localDate(new Date(s.created_at)) === today) {
    const n = d.tasks.filter((t) => t.session_id === s.id).length;
    if (n) items.push({ at: s.created_at, text: `${name(s.created_by)} dispatched ${n} task${n === 1 ? '' : 's'}` });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) return null;
  return (
    <div className="dp-activity">
      <div className="dp-label">What changed today</div>
      <ul>{items.slice(0, 8).map((i, k) => <li key={k}>• {i.text} <span style={{ color: 'var(--mm-faint)' }}>· {timeLabel(i.at)}</span></li>)}</ul>
    </div>
  );
}
