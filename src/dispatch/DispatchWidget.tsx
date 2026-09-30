import './dispatch.css';
import type { HomeWidgetProps } from '../components/homeWidgets/types';
import { cardShell } from '../components/homeWidgets/types';
import { useOptionalDispatchCtx } from './DispatchContext';
import { isOverdue, localDate, sortTasks } from './model';
import MicButton from './MicButton';
import { PriorityPill, WalkieIcon } from './bits';

// Dispatch on Overview (spec 15 §3A). Holding the mic here starts a session
// without leaving home — the transcript sheet rises over the dashboard and
// release goes straight to Review (DispatchLayer, mounted in Stage).
//   S: mic only · M: counts + mic + per-person · L: M + top 3 by person

export default function DispatchWidget({ size = 'M' }: HomeWidgetProps) {
  const ctx = useOptionalDispatchCtx();
  if (!ctx) return null;
  const { d, openDispatch, setBoardPerson } = ctx;
  const today = localDate();
  const open = d.tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => isOverdue(t, today)).length;
  const people = [
    { key: 'me', name: 'You', n: open.filter((t) => t.assignee_member_id === null).length },
    ...d.members.map((m) => ({ key: m.id, name: m.name.split(' ')[0], n: open.filter((t) => t.assignee_member_id === m.id).length })),
  ];
  const ordered = [...people.slice(1).sort((a, b) => b.n - a.n), people[0]];

  if (size === 'S') {
    return (
      <div style={{ ...cardShell, padding: 14, alignItems: 'center', gap: 8 }} className="dp-widget">
        <div className="dp-widget-top" style={{ width: '100%' }}><span className="dp-widget-title">Dispatch</span><span className="dp-sub">{open.length} open</span></div>
        <MicButton size="sm" />
      </div>
    );
  }

  return (
    <div style={cardShell} className="dp-widget">
      <div className="dp-widget-top">
        <span style={{ color: 'var(--mm-dim)', display: 'inline-flex' }}><WalkieIcon size={16} /></span>
        <span className="dp-widget-title">Dispatch</span>
        <button type="button" className="dp-more" style={{ minHeight: 32 }} onClick={() => openDispatch('board')}>Board ›</button>
      </div>
      <button type="button" className="dp-more" style={{ minHeight: 28, justifyContent: 'flex-start' }} onClick={() => openDispatch('board')}>
        <span className="dp-dot" /> {open.length} open{overdue ? <> · <span className="dp-overdue">{overdue} overdue</span></> : ''}
      </button>
      <div className="dp-widget-mic"><MicButton variant="pill" /></div>
      <div className="dp-widget-counts">
        {ordered.map((p) => <span key={p.key}>{p.name} {p.n}</span>)}
      </div>
      {size === 'L' && (
        <div className="dp-widget-list">
          {ordered.filter((p) => p.n > 0).slice(0, 3).map((p) => {
            const top = open.filter((t) => (p.key === 'me' ? t.assignee_member_id === null : t.assignee_member_id === p.key)).sort(sortTasks)[0];
            return top ? (
              <button key={p.key} type="button" className="dp-row" onClick={() => { setBoardPerson(p.key); openDispatch('board'); }}>
                <PriorityPill p={top.priority} overdue={isOverdue(top, today)} />
                <span className="dp-grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.title}</span>
                <span className="dp-sub">{p.name}</span>
              </button>
            ) : null;
          })}
          {!open.length && <div className="dp-sub" style={{ textAlign: 'center' }}>Nothing open. Hold the mic and say what's next.</div>}
        </div>
      )}
    </div>
  );
}
