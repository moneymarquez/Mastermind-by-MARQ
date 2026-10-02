import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

/** The redesign's unified Inbox (design handoff: MM Inbox): mail from
 *  every connected address, plus the client portal's questions and
 *  tickets, in one feed. Drafts are whatever the Support Inbox's triage
 *  wrote (ai_draft_reply); nothing sends until Send is tapped. */
export type InboxSource = string; // a domain, 'Personal', or 'Client portal'
export type SortTag = 'Lead' | 'Client' | 'Support' | 'Billing' | 'Other';
export interface UMsg {
  id: string; kind: 'mail' | 'ticket' | 'message'; rawId: string;
  sender: string; org: string | null; fromAddr: string | null; toAddr: string | null;
  subject: string; body: string; at: string; unread: boolean;
  source: InboxSource; sourceLabel: string; portal: boolean;
  sort: SortTag | null; draft: string | null; replied: boolean;
  avoid: string | null; prefer: string | null; clientId: string | null;
}

const SORT: Record<string, SortTag> = { lead: 'Lead', billing: 'Billing', support: 'Support', bug: 'Support', general: 'Other', spam: 'Other' };
const PERSONAL = /@(gmail|icloud|me|yahoo|outlook|hotmail|proton)\./i;
const domainOf = (e: string | null) => (e?.match(/@([^>\s]+)/)?.[1] ?? '').toLowerCase();
const nameFrom = (e: string) => { const m = e.match(/^\s*"?([^"<]+?)"?\s*</); return m ? m[1].trim() : e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); };

interface MailRow { id: string; from_email: string; to_email: string; subject: string | null; body_text: string | null; category: string | null; ai_draft_reply: string | null; status: string; created_at: string }
interface TicketRow { id: string; client_id: string; kind: string | null; title: string; avoid: string | null; prefer: string | null; status: string; created_at: string; crm_clients: { business_name: string; contact_name: string | null } | null }
interface MsgRow { id: string; client_id: string; body: string; read_at: string | null; created_at: string; crm_clients: { business_name: string; contact_name: string | null } | null }

export function useUnifiedInbox(enabled = true) {
  const [msgs, setMsgs] = useState<UMsg[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    const [mail, tickets, cm] = await Promise.all([
      supabase.from('support_inbox').select('id,from_email,to_email,subject,body_text,category,ai_draft_reply,status,created_at').neq('status', 'ignored').order('created_at', { ascending: false }).limit(120),
      supabase.from('client_tickets').select('id,client_id,kind,title,avoid,prefer,status,created_at,crm_clients(business_name,contact_name)').neq('status', 'resolved').order('created_at', { ascending: false }).limit(60),
      supabase.from('client_messages').select('id,client_id,body,read_at,created_at,crm_clients(business_name,contact_name)').eq('sender', 'client').order('created_at', { ascending: false }).limit(60),
    ]);
    setError(mail.error?.message ?? '');
    const out: UMsg[] = [];
    for (const m of (mail.data ?? []) as MailRow[]) {
      const d = domainOf(m.to_email);
      const personal = PERSONAL.test(m.to_email);
      out.push({ id: `mail-${m.id}`, kind: 'mail', rawId: m.id, sender: nameFrom(m.from_email), org: null, fromAddr: m.from_email, toAddr: m.to_email, subject: m.subject || '(no subject)', body: m.body_text ?? '', at: m.created_at, unread: m.status === 'new', source: personal ? 'Personal' : d || 'Other', sourceLabel: personal ? 'Personal' : d || 'Email', portal: false, sort: m.category ? SORT[m.category] ?? 'Other' : null, draft: m.ai_draft_reply, replied: m.status === 'replied', avoid: null, prefer: null, clientId: null });
    }
    for (const t of (tickets.data ?? []) as unknown as TicketRow[]) {
      out.push({ id: `ticket-${t.id}`, kind: 'ticket', rawId: t.id, sender: t.crm_clients?.contact_name || t.crm_clients?.business_name || 'Client', org: t.crm_clients?.contact_name ? t.crm_clients.business_name : null, fromAddr: null, toAddr: null, subject: t.title, body: t.title, at: t.created_at, unread: t.status === 'open', source: 'Client portal', sourceLabel: 'Portal · ticket', portal: true, sort: 'Client', draft: null, replied: false, avoid: t.avoid, prefer: t.prefer, clientId: t.client_id });
    }
    for (const c of (cm.data ?? []) as unknown as MsgRow[]) {
      out.push({ id: `msg-${c.id}`, kind: 'message', rawId: c.id, sender: c.crm_clients?.contact_name || c.crm_clients?.business_name || 'Client', org: c.crm_clients?.contact_name ? c.crm_clients.business_name : null, fromAddr: null, toAddr: null, subject: c.body.split('\n')[0].slice(0, 90), body: c.body, at: c.created_at, unread: !c.read_at, source: 'Client portal', sourceLabel: 'Portal · question', portal: true, sort: 'Client', draft: null, replied: false, avoid: null, prefer: null, clientId: c.client_id });
    }
    out.sort((a, b) => b.at.localeCompare(a.at));
    setMsgs(out);
    setLoading(false);
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);

  /** Opening marks it read: mail → reviewed, a portal question → read_at. */
  const markRead = useCallback(async (m: UMsg) => {
    if (!m.unread) return;
    setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
    if (m.kind === 'mail') await supabase.from('support_inbox').update({ status: 'reviewed' }).eq('id', m.rawId).eq('status', 'new');
    if (m.kind === 'message') await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).eq('id', m.rawId);
  }, []);
  const send = useCallback(async (m: UMsg, body: string): Promise<{ ok: boolean; error?: string }> => {
    if (m.kind === 'mail') {
      const r = await api<{ ok?: boolean }>('/api/inbox/reply', { body: { mail_id: m.rawId, body } });
      if (r.error) return { ok: false, error: r.error };
    } else {
      if (!m.clientId) return { ok: false, error: 'No client on this message.' };
      const { error: e } = await supabase.from('client_messages').insert({ client_id: m.clientId, sender: 'owner', body: body.trim().slice(0, 8000) });
      if (e) return { ok: false, error: e.message };
    }
    setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, replied: true, unread: false } : x)));
    return { ok: true };
  }, []);
  const discard = useCallback(async (m: UMsg) => {
    setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, draft: null } : x)));
    if (m.kind === 'mail') await supabase.from('support_inbox').update({ ai_draft_reply: null }).eq('id', m.rawId);
  }, []);
  return { msgs, loading, error, reload: load, markRead, send, discard };
}
