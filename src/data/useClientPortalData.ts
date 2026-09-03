import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ClientChangelogEntry,
  ClientDeliverable,
  ClientInvoice,
  ClientMessage,
  ClientModuleAssignment,
  ClientPortalSettings,
  ClientReport,
  ClientTicket,
  ClientTicketKind,
  ClientTicketOption,
  CrmClient,
  PortalModule,
} from './types';
import { buildSpine } from './clientSpine';
import type { SpineAuditInput, SpineBriefInput, SpineStation } from './clientSpine';

export interface AssignedModule extends ClientModuleAssignment {
  module: PortalModule;
}

export interface TicketWithOptions extends ClientTicket {
  options: ClientTicketOption[];
}

const BRIEF_COLS = 'business, bottleneck_verbatim, spec_approved_at, design_locked_at, created_at';

/** Client side of the portal. Every query is unfiltered on purpose —
 *  RLS's `my_client_id()` policies (schema_045 / 054 / 057) do the
 *  scoping, so there is no client-side id to get wrong. The only writes a
 *  client can make: its own messages, its own module progress, approving
 *  its own deliverable, filing its own ticket, picking one of the options
 *  offered on it.
 *
 *  previewClientId — the owner's read-only preview in Client Modules
 *  mounts this same hook (and the same ClientPortal component) pinned to
 *  one client. Owner RLS sees every client, so here the filter IS
 *  explicit, and every write becomes a no-op: a preview must never change
 *  the client's data, and must render exactly what they'd see. */
export function useClientPortalData(previewClientId: string | null = null) {
  const readOnly = !!previewClientId;
  const [client, setClient] = useState<CrmClient | null>(null);
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [modules, setModules] = useState<AssignedModule[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [tickets, setTickets] = useState<TicketWithOptions[]>([]);
  const [changelog, setChangelog] = useState<ClientChangelogEntry[]>([]);
  const [audit, setAudit] = useState<SpineAuditInput | null>(null);
  const [brief, setBrief] = useState<SpineBriefInput | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // .match({}) is a no-op filter — RLS scopes the real client; the
    // owner's preview pins one client explicitly.
    const scope = previewClientId ? { client_id: previewClientId } : {};
    const [c, s, d, a, msg, inv, rep, t, log, au, br] = await Promise.all([
      supabase.from('crm_clients').select('*').match(previewClientId ? { id: previewClientId } : {}).maybeSingle(),
      supabase.from('client_portal').select('*').match(scope).maybeSingle(),
      supabase.from('client_deliverables').select('*').match(scope).order('sort_order').order('created_at'),
      supabase.from('client_module_assignments').select('*, portal_modules(*)').match(scope),
      supabase.from('client_messages').select('*').match(scope).order('created_at'),
      // Drafts are internal — a not-yet-sent invoice never shows here.
      supabase.from('client_invoices').select('*').match(scope).neq('status', 'draft').order('created_at'),
      // The client policy already limits to published; the preview must match it.
      supabase.from('client_reports').select('*').match(scope).eq('published', true).order('period_start'),
      supabase.from('client_tickets').select('*, client_ticket_options(*)').match(scope).order('created_at', { ascending: false }),
      supabase.from('client_changelog').select('*').match(scope).eq('visible_to_client', true).order('happened_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('client_audits').select('status, answers, updated_at').match(scope).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      previewClientId
        ? supabase.from('brand_lab_briefs').select(BRIEF_COLS).eq('client_id', previewClientId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : supabase.rpc('client_brief_summary').maybeSingle(),
    ]);
    setClient((c.data as CrmClient) ?? null);
    setSettings((s.data as ClientPortalSettings) ?? null);
    setDeliverables((d.data ?? []) as ClientDeliverable[]);
    const rows = (a.data ?? []) as unknown as (ClientModuleAssignment & { portal_modules: PortalModule | null })[];
    setModules(
      rows
        .filter((r) => r.portal_modules && r.portal_modules.active)
        .map(({ portal_modules, ...rest }) => ({ ...rest, module: portal_modules as PortalModule }))
        .sort((x, y) => (x.sort_order - y.sort_order) || (x.module.sort_order - y.module.sort_order)),
    );
    setMessages((msg.data ?? []) as ClientMessage[]);
    setInvoices((inv.data ?? []) as ClientInvoice[]);
    setReports((rep.data ?? []) as ClientReport[]);
    const trows = (t.data ?? []) as unknown as (ClientTicket & { client_ticket_options: ClientTicketOption[] | null })[];
    setTickets(trows.map(({ client_ticket_options, ...rest }) => ({ ...rest, options: [...(client_ticket_options ?? [])].sort((x, y) => x.sort_order - y.sort_order) })));
    setChangelog((log.data ?? []) as ClientChangelogEntry[]);
    setAudit((au.data as SpineAuditInput) ?? null);
    setBrief((br.data as SpineBriefInput) ?? null);
    setLoading(false);
  }, [previewClientId]);

  useEffect(() => {
    load();
  }, [load]);

  const spine: SpineStation[] = useMemo(
    () => buildSpine({ client, audit, brief, deliverables, reports, settings, assignments: modules }),
    [client, audit, brief, deliverables, reports, settings, modules],
  );

  const markOpened = async (assignmentId: string) => {
    if (readOnly) return;
    const a = modules.find((m) => m.id === assignmentId);
    if (!a || a.opened_at) return;
    await supabase.from('client_module_assignments').update({ opened_at: new Date().toISOString() }).eq('id', assignmentId);
    await load();
  };

  const setCompleted = async (assignmentId: string, done: boolean) => {
    if (readOnly) return;
    await supabase.from('client_module_assignments').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', assignmentId);
    await load();
  };

  const sendMessage = async (body: string) => {
    if (readOnly || !client || !body.trim()) return;
    await supabase.from('client_messages').insert({ client_id: client.id, sender: 'client', body: body.trim() });
    await load();
  };

  const markOwnerMessagesRead = async () => {
    if (readOnly || !client) return;
    const unread = messages.filter((m) => m.sender === 'owner' && !m.read_at);
    if (unread.length === 0) return;
    await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).in('id', unread.map((m) => m.id));
    await load();
  };

  /** The client's one write on deliverables. */
  const approveDeliverable = async (deliverableId: string) => {
    if (readOnly) return;
    await supabase.from('client_deliverables').update({ approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', deliverableId);
    await load();
  };

  /** Both fields are required here AND at the database (schema_057's
   *  CHECK). Returns an error string rather than throwing so the form can
   *  show it inline. */
  const fileTicket = async (input: { kind: ClientTicketKind; title: string; avoid: string; prefer: string; deliverable_id?: string | null }): Promise<string | null> => {
    if (readOnly || !client) return 'Preview only.';
    const title = input.title.trim();
    const avoid = input.avoid.trim();
    const prefer = input.prefer.trim();
    if (!title) return 'Give it a short title.';
    if (!avoid) return 'Say what to avoid — that field is required.';
    if (!prefer) return "Say what you'd prefer instead — that field is required.";
    const { error } = await supabase.from('client_tickets').insert({ client_id: client.id, kind: input.kind, title, avoid, prefer, deliverable_id: input.deliverable_id ?? null });
    if (error) return error.message;
    await load();
    return null;
  };

  /** Picking one of the offered options is what resolves a ticket. */
  const chooseOption = async (ticketId: string, optionId: string) => {
    if (readOnly) return;
    const now = new Date().toISOString();
    await supabase.from('client_ticket_options').update({ chosen_at: now }).eq('id', optionId);
    await supabase.from('client_tickets').update({ status: 'resolved', resolved_at: now, updated_at: now }).eq('id', ticketId);
    await load();
  };

  return {
    loading, readOnly, client, settings, deliverables, modules, messages, invoices, reports, tickets, changelog, spine,
    reload: load, markOpened, setCompleted, sendMessage, markOwnerMessagesRead, approveDeliverable, fileTicket, chooseOption,
  };
}
