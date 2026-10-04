import { useState } from 'react';
import { useDispatchCtx } from '../../../dispatch/DispatchContext';
import MicButton from '../../../dispatch/MicButton';
import { openTyping } from '../../../dispatch/capture';
import { dueLabel, isOverdue, localDate, PRIORITY_WORD } from '../../../dispatch/model';
import type { DispatchTask } from '../../../dispatch/model';
import DispatchScreen from '../../../dispatch/DispatchScreen';
import People from '../../../dispatch/People';
import '../../../dispatch/dispatch.css';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import type { ChipKind } from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { Page, Sheet, useModule, useAi, AiOffCard } from '../../mm/Page';
import { addDays } from './util';

function chipFor(t: DispatchTask, today: string): { c: string; k: ChipKind } {
  if (t.status === 'done') return { c: 'Done', k: 'good' };
  if (t.needs_help) return { c: 'Needs help', k: 'bad' };
  if (isOverdue(t, today)) { const n = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${t.due_date}T12:00:00`).getTime()) / 86400000); return { c: `${n} day${n === 1 ? '' : 's'} overdue`, k: 'bad' }; }
  if (t.due_date === today) return { c: 'Due today', k: 'warn' };
  return { c: t.due_date ? `Due ${dueLabel(t.due_date, today)}` : PRIORITY_WORD[t.priority] ?? 'Open', k: 'neutral' };
}

export default function DispatchV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const { d } = useDispatchCtx();
  const [sel, setSel] = useState<DispatchTask | null>(null);
  const today = localDate();
  const weekAgo = addDays(today, -7);
  if (!d.loading && !d.isLead) return <DispatchScreen isMobile={phone} onBack={() => {}} dockBottom="100px" />;

  const people = [{ id: null as string | null, name: 'Me' }, ...d.members.map((m) => ({ id: m.id as string | null, name: m.name.split(' ')[0] }))];
  const open = d.tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => isOverdue(t, today));
  const doneWeek = d.tasks.filter((t) => t.status === 'done' && (t.done_at ?? '') >= weekAgo);
  const byVoice = d.tasks.length ? Math.round((d.tasks.filter((t) => t.session_id).length / d.tasks.length) * 100) : 0;
  const forP = (id: string | null) => d.tasks.filter((t) => t.assignee_member_id === id && (t.status === 'open' || (t.done_at ?? '') >= weekAgo)).sort((a, b) => (a.status === b.status ? a.priority - b.priority : a.status === 'open' ? -1 : 1));
  const leaders = people.map((p) => ({ ...p, v: doneWeek.filter((t) => t.assignee_member_id === p.id).length })).sort((a, b) => b.v - a.v);
  const top = Math.max(1, ...leaders.map((l) => l.v));
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? 'Me';

  const talk = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 18px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <MicButton size="lg" />
      <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Hold to talk</span>
      <div style={{ alignSelf: 'stretch', padding: 12, borderRadius: 10, background: 'var(--surface-3)', fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
        Say who does what by when: <span style={{ color: 'var(--text)' }}>"{d.members[0]?.name.split(' ')[0] ?? 'Jordan'}, send the invoice by Thursday."</span> You review every task before anything is assigned.
      </div>
      <button className="mm-btn" style={{ alignSelf: 'stretch', height: 42 }} onClick={() => openTyping()}>Type a task</button>
    </section>
  );
  const board = people.map((p) => {
    const ts = forP(p.id);
    if (!ts.length && p.id !== null) return null;
    return (
      <Card key={p.id ?? 'me'} title={p.name} meta={`${ts.filter((t) => t.status === 'open').length} open`} flush wide={!phone}>
        <div>
          {ts.slice(0, 6).map((t, i) => { const c = chipFor(t, today); return <Row key={t.id} first={i === 0} name={t.title} meta={t.priority <= 2 ? PRIORITY_WORD[t.priority] : undefined} chip={c.c} k={c.k} onClick={() => setSel(t)} />; })}
          {!ts.length && <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing open.</div>}
        </div>
      </Card>
    );
  });
  const lb = (
    <Card title="Done this week" meta="Leaderboard" wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {leaders.map((l, i) => (
          <div key={l.id ?? 'me'} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 14, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</span>
            <span style={{ width: 72, color: 'var(--text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${(l.v / top) * 100}%`, height: '100%', background: i === 0 ? 'var(--accent)' : 'var(--accent-soft)', borderRadius: 999 }} /></div>
            <span style={{ width: 24, textAlign: 'right', color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{l.v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
  const more = { label: 'Team', render: () => <div className="dp" style={{ maxWidth: 'none' }}><People /></div> };
  const sub = d.members.length ? `Team of ${d.members.length + 1}` : 'Just you so far';
  if (!d.loading && d.tasks.length === 0) {
    return (
      <Page title="Dispatch" sub={sub} more={more}>
        {talk}
        <Empty text="Nothing dispatched yet. Hold the button and say who does what by when." />
        {ai === false && <AiOffCard text="Voice parsing needs AI. You can still type a task and pick who and when." />}
      </Page>
    );
  }
  return (
    <Page title="Dispatch" sub={sub} more={more} menu={[{ t: 'Type a task', onClick: () => openTyping() }]}>
      {phone ? <>{talk}{board}{lb}</> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Open tasks" value={String(open.length)} pill={`Across ${new Set(open.map((t) => t.assignee_member_id)).size} ${new Set(open.map((t) => t.assignee_member_id)).size === 1 ? 'person' : 'people'}`} />
            <Stat label="Overdue" value={String(overdue.length)} pill={overdue[0] ? nameOf(overdue[0].assignee_member_id) : 'None'} k={overdue.length ? 'bad' : 'good'} />
            <Stat label="Done this week" value={String(doneWeek.length)} k="good" />
            <Stat label="Assigned by voice" value={`${byVoice}%`} pill="Of all tasks" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {board}
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{lb}</div>
            {talk}
          </div>
        </>
      )}
      {phone && ai === false && <AiOffCard text="Voice parsing needs AI. You can still type a task and pick who and when." />}
      {sel && (
        <Sheet title={sel.title} onClose={() => setSel(null)}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{nameOf(sel.assignee_member_id)} · {sel.due_date ? dueLabel(sel.due_date, today) : 'No due date'} · {PRIORITY_WORD[sel.priority]}</span>
          {sel.source_quote && <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-3)', fontSize: 14, color: 'var(--text-secondary)' }}>"{sel.source_quote}"</div>}
          <button className="mm-btn mm-btn--primary" style={{ height: 46 }} onClick={async () => { await d.setDone(sel, sel.status !== 'done'); setSel(null); }}>{sel.status === 'done' ? 'Reopen' : 'Mark done'}</button>
          {sel.assignee_member_id && sel.status === 'open' && <button className="mm-btn" style={{ height: 44 }} onClick={async () => { await d.nudge(sel); setSel(null); }}>{sel.nudged_at ? 'Nudge again' : 'Nudge'}</button>}
          <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={async () => { await d.removeTask(sel); setSel(null); }}>Delete task</button>
        </Sheet>
      )}
    </Page>
  );
}
