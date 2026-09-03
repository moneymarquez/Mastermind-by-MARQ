import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type TicketStatus = 'open' | 'options_sent' | 'resolved';

/** One row in the owner's tickets feed — split out of the old merged
 *  Inbox (useOwnerInbox) into its own widget so "a business filed a
 *  ticket" isn't mixed in with mail. */
export interface OwnerTicket {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
}

interface TicketRow {
  id: string;
  title: string;
  status: TicketStatus;
  created_at: string;
  client_id: string;
  crm_clients: { business_name: string } | null;
}

export function useOwnerTickets() {
  const [tickets, setTickets] = useState<OwnerTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_tickets')
      .select('id, title, status, created_at, client_id, crm_clients(business_name)')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as TicketRow[];
    setTickets(
      rows.map((t) => ({
        id: t.id,
        clientId: t.client_id,
        clientName: t.crm_clients?.business_name ?? 'Client',
        title: t.title,
        status: t.status,
        createdAt: t.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = tickets.filter((t) => t.status === 'open').length;

  return { tickets, openCount, loading, reload: load };
}
