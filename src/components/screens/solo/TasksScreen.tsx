import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, Tabs, Sheet, Field, field, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { DEFAULT_PROJECTS, groupTasks, weekOf } from '../../../data/tasks';
import type { Task, TaskView, Priority } from '../../../data/tasks';
import { dateStr } from '../../../data/time';

const VIEWS: { id: TaskView; label: string }[] = [{ id: 'due', label: 'By due date' }, { id: 'project', label: 'By project' }, { id: 'week', label: 'This week' }];
const PRI: Record<Priority, 'bad' | 'neutral' | 'good'> = { high: 'bad', med: 'neutral', low: 'good' };
const SOURCE_LABEL: Record<string, string> = { brain_dump: 'Brain Dump', voice: 'Voice', onboarding: 'Setup', weekly_checkin: 'Check-in', money_move: 'Money Move', follow_up: 'Follow-up', goal_path: 'Goal' };

interface Goal { id: string; title: string }

/** Tasks (brief §4.3): the master list. The Daily Plan pulls today's picks
 *  from here; goal paths write their one-off steps here. */
export default function TasksScreen() {
  const phone = useModule().device === 'phone';
  const today = dateStr(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<string[]>(DEFAULT_PROJECTS);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [view, setView] = useState<TaskView>('due');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [quick, setQuick] = useState('');
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [t, p, g] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('task_projects').select('name').order('sort'),
      supabase.from('goals').select('id,title').order('created_at', { ascending: false }),
    ]);
    setMissing(!!t.error);
    setTasks((t.data ?? []) as Task[]);
    const names = ((p.data ?? []) as { name: string }[]).map((x) => x.name);
    setProjects(names.length ? names : DEFAULT_PROJECTS);
    setGoals((g.data ?? []) as Goal[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => groupTasks(tasks, view, today), [tasks, view, today]);
  const done = tasks.filter((t) => t.done).slice(0, 30);
  const wk = weekOf(today);
  const weekDone = tasks.filter((t) => t.done && t.done_at && t.done_at.slice(0, 10) >= wk.start).length;
  const overdue = tasks.filter((t) => !t.done && t.due && t.due < today).length;

  const toggle = async (t: Task) => {
    setTasks((x) => x.map((y) => (y.id === t.id ? { ...y, done: !t.done, done_at: !t.done ? new Date().toISOString() : null } : y)));
    await supabase.from('tasks').update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', t.id);
  };
  const addQuick = async () => {
    const title = quick.trim(); if (!title) return;
    setQuick('');
    await supabase.from('tasks').insert({ title, source: 'manual', priority: 'med' });
    await load();
  };
  const save = async () => {
    if (!editing?.title?.trim()) return;
    const row = { title: editing.title.trim(), project: editing.project || null, due: editing.due || null, priority: editing.priority ?? 'med', goal_id: editing.goal_id || null, notes: editing.notes || null, updated_at: new Date().toISOString() };
    if (editing.id) await supabase.from('tasks').update(row).eq('id', editing.id);
    else await supabase.from('tasks').insert({ ...row, source: 'manual' });
    if (row.project && !projects.includes(row.project)) await supabase.from('task_projects').insert({ name: row.project, sort: projects.length });
    setEditing(null); await load();
  };
  const remove = async (id: string) => { await supabase.from('tasks').delete().eq('id', id); setEditing(null); await load(); };

  if (missing) return <Page title="Tasks"><Empty text="Tasks needs the October migration (schema_124) applied." /></Page>;
  return (
    <Page title="Tasks" sub="Everything you have to do, by project. Today's picks land on your Daily Plan." fab={{ t: 'Task', onClick: () => setEditing({ priority: 'med', project: 'Personal' }) }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Chip k={overdue ? 'bad' : 'good'}>{overdue ? `${overdue} overdue` : 'Nothing overdue'}</Chip>
        <Chip k="neutral">{weekDone} done this week</Chip>
        <Chip k="neutral">{tasks.filter((t) => !t.done).length} open</Chip>
      </div>
      <Tabs tabs={VIEWS} value={view} onChange={setView} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...field, flex: 1 }} value={quick} placeholder="Add a task and press Enter" onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addQuick(); }} />
      </div>
      {groups.length === 0 && <Empty text={view === 'week' ? 'Nothing due this week.' : 'No open tasks. Add one, or drop a file in Brain → Brain Dump.'} />}
      <div style={{ display: 'grid', gridTemplateColumns: phone || view !== 'project' ? '1fr' : 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {groups.map((g) => (
          <Card key={g.key} title={g.label} meta={`${g.items.length}`}>
            {g.items.map((t, i) => <Row key={t.id} t={t} first={i === 0} today={today} goal={goals.find((x) => x.id === t.goal_id)?.title} onToggle={() => void toggle(t)} onOpen={() => setEditing(t)} />)}
          </Card>
        ))}
      </div>
      <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowDone((x) => !x)}>{showDone ? 'Hide done' : `Show done (${tasks.filter((t) => t.done).length})`}</button>
      {showDone && <Card title="Done">{done.map((t, i) => <Row key={t.id} t={t} first={i === 0} today={today} onToggle={() => void toggle(t)} onOpen={() => setEditing(t)} />)}</Card>}

      {editing && (
        <Sheet title={editing.id ? 'Edit task' : 'New task'} onClose={() => setEditing(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Task"><input style={field} autoFocus value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field l="Project">
              <input style={field} list="task-projects" value={editing.project ?? ''} onChange={(e) => setEditing({ ...editing, project: e.target.value })} />
              <datalist id="task-projects">{projects.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Due"><input type="date" style={field} value={editing.due ?? ''} onChange={(e) => setEditing({ ...editing, due: e.target.value || null })} /></Field>
              <Field l="Priority"><select style={field} value={editing.priority ?? 'med'} onChange={(e) => setEditing({ ...editing, priority: e.target.value as Priority })}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select></Field>
            </div>
            <Field l="Linked goal"><select style={field} value={editing.goal_id ?? ''} onChange={(e) => setEditing({ ...editing, goal_id: e.target.value || null })}><option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field>
            <Field l="Notes"><textarea style={{ ...field, height: 90, padding: 10 }} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="mm-btn mm-btn--primary" style={{ flex: 1, height: 44 }} disabled={!editing.title?.trim()} onClick={() => void save()}>Save</button>
              {editing.id && <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={() => void remove(editing.id!)}>Delete</button>}
            </div>
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function Row({ t, first, today, goal, onToggle, onOpen }: { t: Task; first: boolean; today: string; goal?: string; onToggle: () => void; onOpen: () => void }) {
  const late = !t.done && t.due && t.due < today;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <input type="checkbox" checked={t.done} onChange={onToggle} aria-label={`Done: ${t.title}`} style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }} />
      <button onClick={onOpen} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 15, color: t.done ? 'var(--text-tertiary)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{t.title}</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
          {t.due && <span style={{ color: late ? 'var(--danger)' : undefined }}>{t.due === today ? 'Today' : new Date(`${t.due}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>}
          {t.project && <span>· {t.project}</span>}
          {goal && <span>· 🎯 {goal}</span>}
          {SOURCE_LABEL[t.source] && <span>· from {SOURCE_LABEL[t.source]}</span>}
        </span>
      </button>
      {t.priority !== 'med' && <Chip k={PRI[t.priority]}>{t.priority}</Chip>}
    </div>
  );
}
