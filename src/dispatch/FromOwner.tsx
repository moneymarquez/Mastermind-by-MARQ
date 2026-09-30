import { useState } from 'react';
import './dispatch.css';
import { DispatchProvider, useDispatchCtx } from './DispatchContext';
import type { Team } from './model';
import { dueLabel, isOverdue, sortTasks } from './model';
import { PriorityPill, timeLabel, haptic } from './bits';
import { TaskSheet } from './Board';

// The member side (spec 15 §2.4): "From James" — what the lead handed you.
// Done collapses the card and the lead's board updates live; Need help
// flags it amber on their board and opens a note to them.

export function FromOwnerSection({ team, userId }: { team: Team; userId: string }) {
  return (
    <DispatchProvider userId={userId} ownerId={team.owner_id} leadName={team.owner_name} onOpen={() => {}}>
      <FromOwnerList />
    </DispatchProvider>
  );
}

export function FromOwnerList({ limit }: { limit?: number }) {
  const { d, leadName } = useDispatchCtx();
  const [thread, setThread] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const mine = d.tasks.filter((t) => t.assignee_member_id === d.me?.id && t.status === 'open').sort(sortTasks);
  const shown = limit ? mine.slice(0, limit) : mine;
  const task = thread ? d.tasks.find((t) => t.id === thread) : undefined;
  if (d.loading) return null;
  return (
    <section className="dp" aria-label={`From ${leadName}`} style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <div className="dp-label" style={{ flex: 1, marginBottom: 10 }}>From {leadName}</div>
        <div className="dp-sub">{mine.length} open</div>
      </div>
      {!mine.length && <div className="dp-empty">You're all caught up with {leadName}.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((t) => (
          <article key={t.id} className={`dp-card${t.needs_help ? ' help' : ''}${leaving.has(t.id) ? ' dp-collapse' : ''}`} aria-label={t.title}>
            <div className="dp-card-top"><PriorityPill p={t.priority} reason={t.priority_reason} overdue={isOverdue(t)} />{t.needs_help && <span className="dp-tag" style={{ color: 'var(--dp-q)' }}>Asked for help</span>}</div>
            <div className="dp-task-title">{t.title}</div>
            <div className="dp-meta"><span className={isOverdue(t) ? 'dp-overdue' : undefined}>{t.due_date ? `Due ${dueLabel(t.due_date)}` : 'No due date'}</span><span>assigned {timeLabel(t.created_at)}</span></div>
            {t.source_quote && <div className="dp-quote">“{t.source_quote}”</div>}
            <div className="dp-actions">
              <button type="button" className="dp-btn ok" onClick={() => { haptic(15); setLeaving((s) => new Set(s).add(t.id)); setTimeout(() => void d.setDone(t, true), 200); }}>✓ Done</button>
              <button type="button" className="dp-btn" onClick={() => { if (!t.needs_help) void d.setHelp(t, true); setThread(t.id); }}>{t.needs_help ? 'Help asked' : 'Need help'}</button>
              <button type="button" className="dp-btn" aria-label={`Comments on ${t.title}`} onClick={() => setThread(t.id)}>💬 {d.comments.filter((c) => c.task_id === t.id).length || ''}</button>
            </div>
          </article>
        ))}
      </div>
      {limit && mine.length > limit && <div className="dp-sub" style={{ marginTop: 8 }}>+{mine.length - limit} more on Dispatch</div>}
      {task && <TaskSheet task={task} onClose={() => setThread(null)} />}
    </section>
  );
}
