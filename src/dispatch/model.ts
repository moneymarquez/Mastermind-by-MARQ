// Dispatch types and pure helpers — no Supabase, so tests and the demo can
// import them freely. useDispatch.ts re-exports everything here.

export interface DispatchMember {
  id: string; owner_id: string; user_id: string | null; name: string; role: 'manager' | 'member';
  phone: string | null; email: string | null; notify: 'push' | 'sms' | 'email'; color: string | null;
  invited_at: string | null; joined_at: string | null; last_active_at: string | null; created_at: string;
}
export interface DispatchTask {
  id: string; owner_id: string; session_id: string | null; created_by: string; assignee_member_id: string | null;
  title: string; priority: number; priority_reason: string | null; due_date: string | null; source_quote: string | null;
  status: 'open' | 'done'; needs_help: boolean; done_at: string | null; nudged_at: string | null; sort_order: number;
  created_at: string; updated_at: string;
}
export interface DispatchSession {
  id: string; owner_id: string; created_by: string; transcript: string; extraction: Extraction | Record<string, never>;
  notes: string[]; duration_s: number | null; created_at: string;
}
export interface DispatchComment { id: string; task_id: string; owner_id: string; author_id: string; body: string; created_at: string }

/** What /api/dispatch/extract returns, and what Review edits. */
export interface DraftTask {
  key: string; title: string; assignee_member_id: string | null; assignee_name: string; confidence: 'high' | 'low';
  priority: number; priority_reason: string; due_date: string | null; source_quote: string;
}
export interface Extraction {
  tasks: Omit<DraftTask, 'key'>[];
  questions: { task_index: number; text: string; options: string[] }[];
  notes: string[];
}
export interface Team { member_id: string; owner_id: string; owner_name: string; role: 'manager' | 'member' }

export const PRIORITY_LABEL: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5' };
export const PRIORITY_WORD: Record<number, string> = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Someday' };
const PALETTE = ['#4f7cff', '#e0703a', '#2fa37a', '#b05ce0', '#d64b6a', '#2f9fbf', '#c9a227'];
export function memberColor(m: Pick<DispatchMember, 'color' | 'id'> | null): string {
  if (!m) return 'var(--mm-ink)';
  if (m.color) return m.color;
  let h = 0; for (const c of m.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isOverdue(t: Pick<DispatchTask, 'status' | 'due_date'>, today = localDate()): boolean {
  return t.status === 'open' && !!t.due_date && t.due_date < today;
}
/** "Thu Oct 1", "Today", "Tomorrow" — short enough for a chip. */
export function dueLabel(iso: string | null, today = localDate()): string {
  if (!iso) return '—';
  if (iso === today) return 'Today';
  const t = new Date(`${today}T12:00:00`); t.setDate(t.getDate() + 1);
  if (iso === localDate(t)) return 'Tomorrow';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}
export function sortTasks(a: DispatchTask, b: DispatchTask): number {
  return a.priority - b.priority || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}

