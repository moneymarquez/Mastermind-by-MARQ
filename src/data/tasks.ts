// Tasks (brief §4.3): the master list, separate from the Daily Plan. Pure
// helpers; the app reads/writes the `tasks` table directly under RLS.

export type Priority = 'high' | 'med' | 'low';
export type TaskSource = 'manual' | 'brain_dump' | 'voice' | 'onboarding' | 'weekly_checkin' | 'money_move' | 'follow_up' | 'goal_path';
export interface Task { id: string; title: string; project: string | null; due: string | null; priority: Priority; goal_id: string | null; goal_step_id?: string | null; source: TaskSource; notes: string | null; done: boolean; done_at?: string | null; created_at: string }

export const DEFAULT_PROJECTS = ['APHS', 'Masterminds', 'Made by Marq', 'E-commerce', 'Content', 'Personal'];
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Monday-to-Sunday week containing `today`. */
export function weekOf(today: string): { start: string; end: string } {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(today, -dow);
  return { start, end: addDays(start, 6) };
}

/** Open tasks sorted: overdue, then due date, then priority, then goal-linked, then newest. */
export function sortTasks<T extends Pick<Task, 'due' | 'priority' | 'goal_id' | 'created_at'>>(tasks: T[], today: string): T[] {
  const k = (t: T) => [t.due == null ? 2 : t.due < today ? 0 : 1, t.due ?? '9999-12-31', PRIORITY_RANK[t.priority], t.goal_id ? 0 : 1] as const;
  return [...tasks].sort((a, b) => {
    const x = k(a), y = k(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** Today's picks for the Daily Plan: everything overdue or due today, then
 *  high-priority or goal-linked tasks due this week, capped. Pure. */
export function pickToday<T extends Pick<Task, 'done' | 'due' | 'priority' | 'goal_id' | 'created_at'>>(tasks: T[], today: string, max = 5): T[] {
  const open = tasks.filter((t) => !t.done);
  const { end } = weekOf(today);
  const must = open.filter((t) => t.due != null && t.due <= today);
  const soon = open.filter((t) => !must.includes(t) && (t.priority === 'high' || t.goal_id) && (t.due == null || t.due <= end));
  return [...sortTasks(must, today), ...sortTasks(soon, today)].slice(0, max);
}

export type TaskView = 'project' | 'due' | 'week';
export function groupTasks<T extends Pick<Task, 'project' | 'due' | 'done' | 'priority' | 'goal_id' | 'created_at'>>(tasks: T[], view: TaskView, today: string): { key: string; label: string; items: T[] }[] {
  const open = sortTasks(tasks.filter((t) => !t.done), today);
  if (view === 'project') {
    const keys = [...new Set(open.map((t) => t.project || 'No project'))];
    return keys.map((k) => ({ key: k, label: k, items: open.filter((t) => (t.project || 'No project') === k) }));
  }
  if (view === 'week') {
    const { end } = weekOf(today);
    return [{ key: 'week', label: 'This week', items: open.filter((t) => t.due != null && t.due <= end) }];
  }
  const { end } = weekOf(today);
  const buckets: { key: string; label: string; test: (t: T) => boolean }[] = [
    { key: 'overdue', label: 'Overdue', test: (t) => t.due != null && t.due < today },
    { key: 'today', label: 'Today', test: (t) => t.due === today },
    { key: 'week', label: 'This week', test: (t) => t.due != null && t.due > today && t.due <= end },
    { key: 'later', label: 'Later', test: (t) => t.due != null && t.due > end },
    { key: 'none', label: 'No date', test: (t) => t.due == null },
  ];
  return buckets.map((b) => ({ key: b.key, label: b.label, items: open.filter(b.test) })).filter((b) => b.items.length);
}

/** A goal's pace from its linked tasks (finishing tasks moves the bar). */
export function goalTaskProgress(tasks: Pick<Task, 'goal_id' | 'done'>[], goalId: string): { done: number; total: number; pct: number } {
  const mine = tasks.filter((t) => t.goal_id === goalId);
  const done = mine.filter((t) => t.done).length;
  return { done, total: mine.length, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
}
