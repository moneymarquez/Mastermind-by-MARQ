import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ClientDeliverable,
  ClientInvoice,
  ClientMessage,
  ClientModuleAssignment,
  ClientPortalSettings,
  ClientReport,
  CrmClient,
  PortalModule,
} from './types';

export interface AssignedModule extends ClientModuleAssignment {
  module: PortalModule;
}

/** Client side of the portal. Every query is unfiltered on purpose —
 *  RLS's `my_client_id()` policies (schema_045 / schema_054) do the
 *  scoping, so there is no client-side id to get wrong. The only writes a
 *  client can make are its own messages and its own module progress. */
export function useClientPortalData() {
  const [client, setClient] = useState<CrmClient | null>(null);
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [modules, setModules] = useState<AssignedModule[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, s, d, a, msg, inv, rep] = await Promise.all([
      supabase.from('crm_clients').select('*').maybeSingle(),
      supabase.from('client_portal').select('*').maybeSingle(),
      supabase.from('client_deliverables').select('*').order('sort_order').order('created_at'),
      supabase.from('client_module_assignments').select('*, portal_modules(*)'),
      supabase.from('client_messages').select('*').order('created_at'),
      // Drafts are internal — a not-yet-sent invoice never shows here.
      supabase.from('client_invoices').select('*').neq('status', 'draft').order('created_at'),
      supabase.from('client_reports').select('*').order('period_start'),
    ]);
    setClient((c.data as CrmClient) ?? null);
    setSettings((s.data as ClientPortalSettings) ?? null);
    setDeliverables((d.data ?? []) as ClientDeliverable[]);
    const rows = (a.data ?? []) as unknown as (ClientModuleAssignment & { portal_modules: PortalModule | null })[];
    setModules(
      rows
        .filter((r) => r.portal_modules && r.portal_modules.active)
        .map(({ portal_modules, ...rest }) => ({ ...rest, module: portal_modules as PortalModule }))
        .sort((x, y) => x.module.sort_order - y.module.sort_order),
    );
    setMessages((msg.data ?? []) as ClientMessage[]);
    setInvoices((inv.data ?? []) as ClientInvoice[]);
    setReports((rep.data ?? []) as ClientReport[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markOpened = async (assignmentId: string) => {
    const a = modules.find((m) => m.id === assignmentId);
    if (!a || a.opened_at) return;
    await supabase.from('client_module_assignments').update({ opened_at: new Date().toISOString() }).eq('id', assignmentId);
    await load();
  };

  const setCompleted = async (assignmentId: string, done: boolean) => {
    await supabase.from('client_module_assignments').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', assignmentId);
    await load();
  };

  const sendMessage = async (body: string) => {
    if (!client || !body.trim()) return;
    await supabase.from('client_messages').insert({ client_id: client.id, sender: 'client', body: body.trim() });
    await load();
  };

  const markOwnerMessagesRead = async () => {
    if (!client) return;
    const unread = messages.filter((m) => m.sender === 'owner' && !m.read_at);
    if (unread.length === 0) return;
    await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unread.map((m) => m.id));
    await load();
  };

  return { loading, client, settings, deliverables, modules, messages, invoices, reports, reload: load, markOpened, setCompleted, sendMessage, markOwnerMessagesRead };
}
