import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import Chip from '../mm/Chip';
import { field } from '../mm/Page';
import { DEFAULT_LISTS, followUpTaskTitle } from '../../data/peopleLists';

export interface ContactList { id: string; name: string; automation: string | null }
interface Member { list_id: string; contact_id: string }

/** People lists (brief §4.9): user-created lists; a contact can be on several. */
export function useContactLists() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const [l, m] = await Promise.all([supabase.from('contact_lists').select('id,name,automation').order('sort'), supabase.from('contact_list_members').select('list_id,contact_id')]);
    if (l.error) { setReady(false); return; }
    let rows = (l.data ?? []) as ContactList[];
    if (!rows.length) {
      const ins = await supabase.from('contact_lists').insert(DEFAULT_LISTS.map((name, sort) => ({ name, sort }))).select('id,name,automation');
      rows = (ins.data ?? []) as ContactList[];
    }
    setLists(rows); setMembers((m.data ?? []) as Member[]); setReady(true);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (listId: string, contactId: string) => {
    const on = members.some((m) => m.list_id === listId && m.contact_id === contactId);
    setMembers((x) => (on ? x.filter((m) => !(m.list_id === listId && m.contact_id === contactId)) : [...x, { list_id: listId, contact_id: contactId }]));
    if (on) await supabase.from('contact_list_members').delete().eq('list_id', listId).eq('contact_id', contactId);
    else {
      await supabase.from('contact_list_members').insert({ list_id: listId, contact_id: contactId });
      // Owner automations (Comms hub): the list's sequence starts. The server ignores this for solo users.
      const name = lists.find((l) => l.id === listId)?.name;
      if (name) void api('/api/comms/start-sequence', { body: { contact_id: contactId, list_name: name } });
    }
  };
  const create = async (name: string) => { const n = name.trim(); if (!n) return; await supabase.from('contact_lists').insert({ name: n, sort: lists.length }); await load(); };
  const listsOf = (contactId: string) => lists.filter((l) => members.some((m) => m.list_id === l.id && m.contact_id === contactId));
  const inList = (listId: string) => new Set(members.filter((m) => m.list_id === listId).map((m) => m.contact_id));
  return { lists, members, ready, toggle, create, listsOf, inList, reload: load };
}

/** Filter chips above the contact list. */
export function ListFilter({ api, value, onChange }: { api: ReturnType<typeof useContactLists>; value: string | null; onChange: (id: string | null) => void }) {
  if (!api.ready) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button className={`mm-btn ${value == null ? 'mm-btn--primary' : ''}`} style={{ height: 30, padding: '0 10px', fontSize: 12.5 }} onClick={() => onChange(null)}>Everyone</button>
      {api.lists.map((l) => <button key={l.id} className={`mm-btn ${value === l.id ? 'mm-btn--primary' : ''}`} style={{ height: 30, padding: '0 10px', fontSize: 12.5 }} onClick={() => onChange(l.id)}>{l.name} {api.inList(l.id).size || ''}</button>)}
    </div>
  );
}

/** On a contact: which lists, last contact, next follow-up (→ a Task). */
export function ContactPeople({ api, contact }: { api: ReturnType<typeof useContactLists>; contact: { id: string; name: string; last_contact_at?: string | null; next_follow_up?: string | null; follow_up_task_id?: string | null } }) {
  const [newList, setNewList] = useState('');
  const [follow, setFollow] = useState(contact.next_follow_up ?? '');
  const [msg, setMsg] = useState('');
  useEffect(() => { setFollow(contact.next_follow_up ?? ''); setMsg(''); }, [contact.id, contact.next_follow_up]);
  if (!api.ready) return null;
  const mine = new Set(api.listsOf(contact.id).map((l) => l.id));
  const saveFollow = async () => {
    const due = follow || null;
    let taskId = contact.follow_up_task_id ?? null;
    if (due) {
      if (taskId) await supabase.from('tasks').update({ due, done: false, updated_at: new Date().toISOString() }).eq('id', taskId);
      else { const { data } = await supabase.from('tasks').insert({ title: followUpTaskTitle(contact.name, api.listsOf(contact.id).map((l) => l.name)), due, source: 'follow_up', source_ref: contact.id, priority: 'med' }).select('id').single(); taskId = (data as { id: string } | null)?.id ?? null; }
    }
    const { error } = await supabase.from('contacts').update({ next_follow_up: due, follow_up_task_id: taskId, updated_at: new Date().toISOString() }).eq('id', contact.id);
    setMsg(error ? error.message : due ? 'Follow-up saved and added to Tasks.' : 'Follow-up cleared.');
  };
  const touched = async () => { await supabase.from('contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', contact.id); setMsg('Logged: talked today.'); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Lists</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {api.lists.map((l) => <button key={l.id} onClick={() => void api.toggle(l.id, contact.id)} style={{ all: 'unset', cursor: 'pointer' }}><Chip k={mine.has(l.id) ? 'accent' : 'neutral'}>{mine.has(l.id) ? '✓ ' : '+ '}{l.name}</Chip></button>)}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...field, height: 36, flex: 1 }} placeholder="New list" value={newList} onChange={(e) => setNewList(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { void api.create(newList); setNewList(''); } }} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13.5 }}>
        <span style={{ color: 'var(--text-secondary)' }}>Last contact: {contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'never logged'}</span>
        <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => void touched()}>Talked today</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Next follow-up</span>
        <input type="date" style={{ ...field, height: 36, width: 'auto' }} value={follow} onChange={(e) => setFollow(e.target.value)} />
        <button className="mm-btn" style={{ height: 36 }} onClick={() => void saveFollow()}>Save</button>
      </div>
      {msg && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{msg}</span>}
    </div>
  );
}
