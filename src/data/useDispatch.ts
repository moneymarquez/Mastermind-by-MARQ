import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

// Dispatch (specs 14 + 15). One hook for both sides: the team lead's board
// and a member's "From <lead>" list. RLS (schema_111) already limits what
// each side can read, so the queries are the same; only the workspace id
// and what the UI offers differ.
import type { DispatchMember, DispatchTask, DispatchSession, DispatchComment, DraftTask, Extraction, Team } from '../dispatch/model';
export * from '../dispatch/model';

export function useDispatch(opts: { userId: string; ownerId: string | null }) {
  const { userId, ownerId } = opts;
  const [members, setMembers] = useState<DispatchMember[]>([]);
  const [tasks, setTasks] = useState<DispatchTask[]>([]);
  const [sessions, setSessions] = useState<DispatchSession[]>([]);
  const [comments, setComments] = useState<DispatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!ownerId) { setLoading(false); return; }
    const [m, t, s] = await Promise.all([
      supabase.from('dispatch_members').select('*').eq('owner_id', ownerId).order('name'),
      supabase.from('dispatch_tasks').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(400),
      supabase.from('dispatch_sessions').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (!alive.current) return;
    const err = m.error ?? t.error ?? s.error;
    setError(err ? err.message : null);
    const taskRows = (t.data ?? []) as DispatchTask[];
    setMembers((m.data ?? []) as DispatchMember[]);
    setTasks(taskRows);
    setSessions((s.data ?? []) as DispatchSession[]);
    if (taskRows.length) {
      const c = await supabase.from('dispatch_comments').select('*').eq('owner_id', ownerId).order('created_at');
      if (alive.current) setComments((c.data ?? []) as DispatchComment[]);
    }
    setLoading(false);
  }, [ownerId]);

  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);

  // Live board: another device marks something done, a member asks for
  // help, the lead dispatches — every open screen catches up.
  useEffect(() => {
    if (!ownerId) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => { if (t) clearTimeout(t); t = setTimeout(() => void load(), 250); };
    const ch = supabase.channel(`dispatch-${ownerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_tasks', filter: `owner_id=eq.${ownerId}` }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispatch_comments', filter: `owner_id=eq.${ownerId}` }, bump)
      .subscribe();
    return () => { if (t) clearTimeout(t); void supabase.removeChannel(ch); };
  }, [ownerId, load]);

  const me = useMemo(() => members.find((m) => m.user_id === userId) ?? null, [members, userId]);
  const isLead = ownerId === userId;
  const canAssign = isLead || me?.role === 'manager';

  const patchTask = useCallback(async (id: string, patch: Partial<DispatchTask>) => {
    const now = new Date().toISOString();
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch, updated_at: now } : t)));
    const { error: e } = await supabase.from('dispatch_tasks').update({ ...patch, updated_at: now }).eq('id', id);
    if (e) { setError(e.message); void load(); return false; }
    return true;
  }, [load]);

  const extract = useCallback(async (transcript: string) => {
    let tz: string | undefined; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* default */ }
    return api<Extraction & { owner_id: string }>('/api/dispatch/extract', { body: { transcript, tz } });
  }, []);

  const transcribe = useCallback(async (audio: Blob): Promise<{ text?: string; error?: string }> => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { error: 'Not signed in.' };
      const res = await fetch('/api/dispatch/transcribe', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': audio.type || 'audio/webm' }, body: audio });
      return (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { text?: string; error?: string };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, []);

  /** Review → board: one session row, one row per task, then tell people. */
  const dispatch = useCallback(async (draft: DraftTask[], session: { transcript: string; extraction: Extraction | null; notes: string[]; duration_s: number | null }) => {
    if (!ownerId) return { error: 'No team yet.' };
    const { data: s, error: se } = await supabase.from('dispatch_sessions').insert({
      owner_id: ownerId, created_by: userId, transcript: session.transcript, extraction: session.extraction ?? {}, notes: session.notes, duration_s: session.duration_s,
    }).select('*').single();
    if (se || !s) return { error: se?.message ?? 'Could not save.' };
    const rows = draft.map((d, i) => ({
      owner_id: ownerId, session_id: (s as DispatchSession).id, created_by: userId,
      assignee_member_id: d.assignee_member_id ?? (isLead ? null : me?.id ?? null),
      title: d.title.trim().slice(0, 200), priority: d.priority, priority_reason: d.priority_reason || null,
      due_date: d.due_date, source_quote: d.source_quote || null, sort_order: i, status: 'open' as const, needs_help: false,
    }));
    const { error: te } = rows.length ? await supabase.from('dispatch_tasks').insert(rows) : { error: null };
    if (te) return { error: te.message };
    const n = await api<{ notified: { name: string; via: string | null }[] }>('/api/dispatch/notify', { body: { session_id: (s as DispatchSession).id } });
    void load();
    return { session: s as DispatchSession, notified: n.notified ?? [], notifyError: n.error };
  }, [ownerId, userId, isLead, me, load]);

  const setDone = useCallback((t: DispatchTask, done: boolean) => patchTask(t.id, { status: done ? 'done' : 'open', done_at: done ? new Date().toISOString() : null, needs_help: done ? false : t.needs_help }), [patchTask]);
  const setHelp = useCallback((t: DispatchTask, help: boolean) => patchTask(t.id, { needs_help: help }), [patchTask]);
  const moveTask = useCallback((t: DispatchTask, patch: { assignee_member_id?: string | null; due_date?: string | null; priority?: number; title?: string }) => patchTask(t.id, patch), [patchTask]);
  const removeTask = useCallback(async (t: DispatchTask) => {
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    const { error: e } = await supabase.from('dispatch_tasks').delete().eq('id', t.id);
    if (e) { setError(e.message); void load(); }
  }, [load]);
  const nudge = useCallback((t: DispatchTask) => api<{ sent?: boolean; via?: string }>('/api/dispatch/nudge', { body: { task_id: t.id } }).then((r) => { if (!r.error) setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, nudged_at: new Date().toISOString() } : x))); return r; }), []);
  const comment = useCallback(async (t: DispatchTask, body: string) => {
    const text = body.trim(); if (!text) return false;
    const { data, error: e } = await supabase.from('dispatch_comments').insert({ task_id: t.id, owner_id: t.owner_id, author_id: userId, body: text.slice(0, 2000) }).select('*').single();
    if (e) { setError(e.message); return false; }
    setComments((cs) => [...cs, data as DispatchComment]);
    return true;
  }, [userId]);

  const addMember = useCallback(async (m: { name: string; phone?: string; email?: string; role?: 'manager' | 'member'; notify?: DispatchMember['notify'] }) => {
    if (!ownerId) return null;
    const { data, error: e } = await supabase.from('dispatch_members').insert({ owner_id: ownerId, name: m.name.trim().slice(0, 80), phone: m.phone?.trim() || null, email: m.email?.trim() || null, role: m.role ?? 'member', notify: m.notify ?? (m.phone ? 'sms' : 'push') }).select('*').single();
    if (e) { setError(e.message); return null; }
    setMembers((ms) => [...ms, data as DispatchMember].sort((a, b) => a.name.localeCompare(b.name)));
    return data as DispatchMember;
  }, [ownerId]);
  const updateMember = useCallback(async (id: string, patch: Partial<Pick<DispatchMember, 'name' | 'phone' | 'email' | 'role' | 'notify'>>) => {
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error: e } = await supabase.from('dispatch_members').update(patch).eq('id', id);
    if (e) { setError(e.message); void load(); }
  }, [load]);
  const removeMember = useCallback(async (id: string) => {
    setMembers((ms) => ms.filter((m) => m.id !== id));
    const { error: e } = await supabase.from('dispatch_members').delete().eq('id', id);
    if (e) { setError(e.message); void load(); } else void load();
  }, [load]);
  const invite = useCallback((memberId: string, sms: boolean) => api<{ link: string; sms: { sent: boolean; error?: string } | null }>('/api/dispatch/invite', { body: { member_id: memberId, sms } }).then((r) => { if (!r.error) setMembers((ms) => ms.map((m) => (m.id === memberId ? { ...m, invited_at: new Date().toISOString() } : m))); return r; }), []);

  return { loading, error, clearError: () => setError(null), members, tasks, sessions, comments, me, isLead, canAssign, reload: load, extract, transcribe, dispatch, setDone, setHelp, moveTask, removeTask, nudge, comment, addMember, updateMember, removeMember, invite };
}

/** The teams the signed-in user is a member of (not the one they lead). */
export function useMyTeams(enabled = true) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(enabled);
  const refresh = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    const { data } = await supabase.rpc('dispatch_my_teams');
    setTeams(Array.isArray(data) ? (data as Team[]) : []);
    setLoading(false);
  }, [enabled]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { teams, loading, refresh };
}
