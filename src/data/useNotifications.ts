import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { InboxItem } from './useOwnerInbox';
import type { FeedLead } from './useLeadFeed';
import { waitingMin, fmtWait, URGENT_WAIT_MIN } from './useLeadFeed';

/** The bell's panel (design handoff: four groups — New leads, Inbox,
 *  Bills and deadlines, Clients). Built only from real rows; "read" is a
 *  per-device list of ids, cleared by Mark all read. */
export type NotifGroup = 'New leads' | 'Inbox' | 'Bills and deadlines' | 'Clients';
export interface Notif { id: string; group: NotifGroup; title: string; sub: string; at: string; chip?: { text: string; kind: 'bad' | 'warn' | 'good' | 'neutral' | 'accent' }; target: { screen: string; ref?: string } }

const READ_KEY = 'mm-notif-read';
const readSet = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]); } catch { return new Set(); } };

interface BillRow { id: string; name: string; amount: number; next_occurrence: string | null; type: string }

export function useNotifications(inbox: InboxItem[], leads: FeedLead[], now: number, enabled = true) {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [rems, setRems] = useState<{ id: string; title: string; due_date: string; due_time: string | null }[]>([]);
  const [read, setRead] = useState<Set<string>>(readSet);
  useEffect(() => {
    if (!enabled) return;
    const soon = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
    supabase.from('budget_recurring').select('id,name,amount,next_occurrence,type').eq('active', true).neq('type', 'income').lte('next_occurrence', soon).order('next_occurrence').limit(20)
      .then(({ data }) => setBills((data ?? []) as BillRow[]));
    // Reminders due by tomorrow ride the same group (the floating
    // Reminders box is the old look; the redesign puts them here).
    const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
    supabase.from('reminders').select('id,title,due_date,due_time').eq('done', false).lte('due_date', tomorrow).order('due_date').limit(20)
      .then(({ data }) => setRems((data ?? []) as typeof rems));
    // now changes once a minute; bills only need a refresh when the day turns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, new Date(now).toDateString()]);

  const items = useMemo(() => {
    const out: Notif[] = [];
    for (const l of leads.slice(0, 12)) {
      const w = waitingMin(l, now);
      if (w == null && now - new Date(l.at).getTime() > 2 * 86400000) continue;
      out.push({ id: l.id, group: 'New leads', title: l.name, sub: [l.business, l.source].filter(Boolean).join(' · '), at: l.at, chip: w != null ? { text: `Waiting ${fmtWait(w)}`, kind: w >= URGENT_WAIT_MIN ? 'bad' : 'warn' } : undefined, target: { screen: 'leads', ref: l.id } });
    }
    for (const i of inbox.slice(0, 20)) {
      const client = i.kind !== 'mail';
      if (!i.unread && client) continue;
      out.push({ id: i.id, group: client ? 'Clients' : 'Inbox', title: client ? `${i.from}: ${i.kind === 'ticket' ? 'new ticket' : 'message'}` : i.from, sub: i.title, at: i.at, chip: i.kind === 'ticket' ? { text: 'Ticket', kind: 'accent' } : undefined, target: { screen: 'inbox', ref: i.id } });
    }
    const today = new Date(now).toISOString().slice(0, 10);
    for (const b of bills) {
      if (!b.next_occurrence) continue;
      const days = Math.round((new Date(`${b.next_occurrence}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
      out.push({ id: `bill-${b.id}-${b.next_occurrence}`, group: 'Bills and deadlines', title: b.name, sub: `$${Number(b.amount).toFixed(2)}`, at: `${b.next_occurrence}T09:00:00`, chip: { text: days < 0 ? `${-days} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`, kind: days < 0 ? 'bad' : days <= 2 ? 'warn' : 'neutral' }, target: { screen: 'budgeting' } });
    }
    for (const r of rems) {
      const days = Math.round((new Date(`${r.due_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
      out.push({ id: `rem-${r.id}`, group: 'Bills and deadlines', title: r.title, sub: `Reminder${r.due_time ? ` · ${r.due_time.slice(0, 5)}` : ''}`, at: `${r.due_date}T${r.due_time ?? '09:00:00'}`, chip: { text: days < 0 ? `${-days} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : 'Tomorrow', kind: days < 0 ? 'bad' : days === 0 ? 'warn' : 'neutral' }, target: { screen: 'home' } });
    }
    return out;
  }, [leads, inbox, bills, rems, now]);

  const unread = items.filter((n) => !read.has(n.id)).length;
  const markRead = useCallback((id: string) => setRead((r) => { const n = new Set(r); n.add(id); try { localStorage.setItem(READ_KEY, JSON.stringify([...n].slice(-400))); } catch { /* private mode */ } return n; }), []);
  const markAll = useCallback(() => setRead(() => { const n = new Set(items.map((i) => i.id)); try { localStorage.setItem(READ_KEY, JSON.stringify([...n])); } catch { /* private mode */ } return n; }), [items]);
  return { items, unread, isRead: (id: string) => read.has(id), markRead, markAll };
}
