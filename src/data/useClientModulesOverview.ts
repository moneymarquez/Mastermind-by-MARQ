import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientDeliverable, ClientModuleAssignment, ClientPortalSettings, CrmClient } from './types';
import { buildSpine } from './clientSpine';
import type { SpineAuditInput, SpineBriefInput, SpineStation } from './clientSpine';

export interface ClientOverviewRow {
  client: CrmClient;
  spine: SpineStation[];
  openTickets: number;
  awaitingChoice: number;
  unreadMessages: number;
  pendingApprovals: number;
  handoff: boolean;
  hasLogin: boolean;
  lastActivity: string | null;
}

/** Every client's portal state at a glance, for the Client Modules
 *  overview — one query per table (the owner sees all rows), grouped by
 *  client, spine computed with the same buildSpine() the client's own
 *  portal uses. lastActivity is the newest of: the CRM row's own
 *  last_activity_at, the client's latest message, latest ticket. */
export function useClientModulesOverview() {
  const [rows, setRows] = useState<ClientOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, s, d, a, t, m, r, au, br, p] = await Promise.all([
      supabase.from('crm_clients').select('*').order('business_name'),
      supabase.from('client_portal').select('*'),
      supabase.from('client_deliverables').select('*'),
      supabase.from('client_module_assignments').select('*'),
      supabase.from('client_tickets').select('id, client_id, status, created_at'),
      supabase.from('client_messages').select('id, client_id, sender, read_at, created_at'),
      supabase.from('client_reports').select('client_id, period_label, published'),
      supabase.from('client_audits').select('client_id, status, answers, updated_at').order('updated_at', { ascending: false }),
      supabase.from('brand_lab_briefs').select('client_id, business, bottleneck_verbatim, spec_approved_at, design_locked_at, created_at').not('client_id', 'is', null).order('created_at', { ascending: false }),
      supabase.from('profiles').select('client_id').eq('role', 'client'),
    ]);
    const by = <T extends { client_id: string | null }>(list: T[] | null | undefined): Map<string, T[]> => {
      const map = new Map<string, T[]>();
      for (const row of list ?? []) {
        if (!row.client_id) continue;
        const arr = map.get(row.client_id) ?? [];
        arr.push(row);
        map.set(row.client_id, arr);
      }
      return map;
    };
    const settingsBy = by((s.data ?? []) as ClientPortalSettings[]);
    const delivBy = by((d.data ?? []) as ClientDeliverable[]);
    const assignBy = by((a.data ?? []) as ClientModuleAssignment[]);
    const ticketBy = by((t.data ?? []) as { id: string; client_id: string; status: string; created_at: string }[]);
    const msgBy = by((m.data ?? []) as { id: string; client_id: string; sender: string; read_at: string | null; created_at: string }[]);
    const reportBy = by((r.data ?? []) as { client_id: string; period_label: string; published: boolean }[]);
    const auditBy = by((au.data ?? []) as ({ client_id: string } & SpineAuditInput)[]);
    const briefBy = by((br.data ?? []) as ({ client_id: string } & SpineBriefInput)[]);
    const logins = new Set(((p.data ?? []) as { client_id: string | null }[]).map((x) => x.client_id));

    const out: ClientOverviewRow[] = ((c.data ?? []) as CrmClient[]).map((client) => {
      const settings = settingsBy.get(client.id)?.[0] ?? null;
      const deliverables = delivBy.get(client.id) ?? [];
      const assignments = assignBy.get(client.id) ?? [];
      const tickets = ticketBy.get(client.id) ?? [];
      const msgs = msgBy.get(client.id) ?? [];
      const reports = (reportBy.get(client.id) ?? []).filter((x) => x.published);
      const audit = auditBy.get(client.id)?.[0] ?? null;
      const brief = briefBy.get(client.id)?.[0] ?? null;
      const stamps = [client.last_activity_at, ...tickets.map((x) => x.created_at), ...msgs.filter((x) => x.sender === 'client').map((x) => x.created_at)].filter((x): x is string => !!x);
      return {
        client,
        spine: buildSpine({ client, audit, brief, deliverables, reports, settings, assignments }),
        openTickets: tickets.filter((x) => x.status === 'open').length,
        awaitingChoice: tickets.filter((x) => x.status === 'options_sent').length,
        unreadMessages: msgs.filter((x) => x.sender === 'client' && !x.read_at).length,
        pendingApprovals: deliverables.filter((x) => x.status === 'review' && !x.approved_at).length,
        handoff: !!settings?.handoff_mode,
        hasLogin: logins.has(client.id),
        lastActivity: stamps.length ? stamps.sort().at(-1) ?? null : null,
      };
    });
    // Needs-you-first: open tickets, then unread messages, then recency.
    out.sort((x, y) => (y.openTickets - x.openTickets) || (y.unreadMessages - x.unreadMessages) || ((y.lastActivity ?? '').localeCompare(x.lastActivity ?? '')));
    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, reload: load };
}
