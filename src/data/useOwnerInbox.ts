import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { inboxBucket } from './inboxAddresses';
import type { InboxBucket } from './inboxAddresses';

export type InboxItemKind = 'mail' | 'ticket' | 'message';

/** One row in the owner's unified inbox — the thing pinned above every
 *  nav category. Mail from either domain (support_inbox), a client's
 *  ticket, or a client's unread message all land here in one list, newest
 *  first, so "client stuff" has one place regardless of how it arrived.
 *  Tickets briefly had their own separate sidebar widget, but that ate
 *  into the vertical room the nav list needs — merged back in here, with
 *  a "Tickets" filter chip in SupportInboxScreen for browsing them on
 *  their own when that's what's wanted. */
export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  /** Who it's from — the sender's handle for mail, the business name for
   *  anything from the portal. */
  from: string;
  title: string;
  at: string;
  unread: boolean;
  /** Set for ticket/message so opening it can land on that client. */
  clientId: string | null;
  /** Mail only: which address (and domain) it came in on. */
  bucket: InboxBucket | null;
}

interface TicketRow { id: string; title: string; status: string; created_at: string; client_id: string; crm_clients: { business_name: string } | null }
interface MessageRow { id: string; body: string; created_at: string; client_id: string; crm_clients: { business_name: string } | null }
interface MailRow { id: string; from_email: string; to_email: string; subject: string | null; status: string; created_at: string }

export function useOwnerInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [mail, tickets, msgs] = await Promise.all([
      supabase.from('support_inbox').select('id, from_email, to_email, subject, status, created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('client_tickets').select('id, title, status, created_at, client_id, crm_clients(business_name)').neq('status', 'resolved').order('created_at', { ascending: false }),
      supabase.from('client_messages').select('id, body, created_at, client_id, crm_clients(business_name)').eq('sender', 'client').is('read_at', null).order('created_at', { ascending: false }),
    ]);
    const out: InboxItem[] = [];
    for (const m of (mail.data ?? []) as MailRow[]) {
      out.push({ id: `mail-${m.id}`, kind: 'mail', from: m.from_email.split('@')[0] || m.from_email, title: m.subject || '(no subject)', at: m.created_at, unread: m.status === 'new', clientId: null, bucket: inboxBucket(m.to_email) });
    }
    for (const t of (tickets.data ?? []) as unknown as TicketRow[]) {
      out.push({ id: `ticket-${t.id}`, kind: 'ticket', from: t.crm_clients?.business_name ?? 'Client', title: t.title, at: t.created_at, unread: t.status === 'open', clientId: t.client_id, bucket: null });
    }
    for (const m of (msgs.data ?? []) as unknown as MessageRow[]) {
      out.push({ id: `msg-${m.id}`, kind: 'message', from: m.crm_clients?.business_name ?? 'Client', title: m.body, at: m.created_at, unread: true, clientId: m.client_id, bucket: null });
    }
    out.sort((a, b) => b.at.localeCompare(a.at));
    setItems(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, reload: load };
}
