import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ClientChangelogEntry,
  ClientDeliverable,
  ClientMessage,
  ClientModuleAssignment,
  ClientPortalSettings,
  ClientReport,
  ClientTicket,
  ClientTicketOption,
  CrmClient,
  DeliverableKind,
  PortalModule,
  SpineState,
  SpineStationKey,
} from './types';
import { buildSpine } from './clientSpine';
import type { SpineAuditInput, SpineBriefInput, SpineStation } from './clientSpine';
import type { TicketWithOptions } from './useClientPortalData';

/** The slice of a Brand Lab brief the portal admin needs to pre-fill a
 *  deliverable's "what / why" from work already written there, plus the
 *  five milestone fields the spine reads (same five the client gets
 *  through client_brief_summary(), so both sides feed buildSpine() the
 *  same thing). */
export interface BriefForPortal {
  id: string;
  business: string | null;
  direction: string;
  functional_spec: { summary: string; pages: { name: string; purpose: string; enabled: boolean }[] } | null;
  bottleneck_verbatim: string | null;
  rounds_to_approval: number | null;
  spec_approved_at: string | null;
  design_locked_at: string | null;
  created_at: string;
}

/** Owner side of the Client Delivery Portal (schema_054 + 057), scoped to
 *  one client. Everything a client sees is authored, assigned, or
 *  answered here; the client's own hook (useClientPortalData) reads the
 *  same rows through RLS with no filters, and the operator's read-only
 *  preview mounts that hook pinned to this client — one record, two
 *  views. */
export function useClientPortalAdmin(clientId: string | null) {
  const [client, setClient] = useState<CrmClient | null>(null);
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [modules, setModules] = useState<PortalModule[]>([]);
  const [assignments, setAssignments] = useState<ClientModuleAssignment[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [briefs, setBriefs] = useState<BriefForPortal[]>([]);
  const [tickets, setTickets] = useState<TicketWithOptions[]>([]);
  const [changelog, setChangelog] = useState<ClientChangelogEntry[]>([]);
  const [reports, setReports] = useState<Pick<ClientReport, 'period_label' | 'published'>[]>([]);
  const [audit, setAudit] = useState<SpineAuditInput | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    const [c, s, d, m, a, msg, b, t, log, rep, au] = await Promise.all([
      supabase.from('crm_clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('client_portal').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('client_deliverables').select('*').eq('client_id', clientId).order('sort_order').order('created_at'),
      supabase.from('portal_modules').select('*').order('sort_order'),
      supabase.from('client_module_assignments').select('*').eq('client_id', clientId).order('sort_order'),
      supabase.from('client_messages').select('*').eq('client_id', clientId).order('created_at'),
      supabase.from('brand_lab_briefs').select('id, business, direction, functional_spec, bottleneck_verbatim, rounds_to_approval, spec_approved_at, design_locked_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('client_tickets').select('*, client_ticket_options(*)').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('client_changelog').select('*').eq('client_id', clientId).order('happened_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('client_reports').select('period_label, published').eq('client_id', clientId).order('period_start'),
      supabase.from('client_audits').select('status, answers, updated_at').eq('client_id', clientId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setClient((c.data as CrmClient) ?? null);
    setSettings((s.data as ClientPortalSettings) ?? null);
    setDeliverables((d.data ?? []) as ClientDeliverable[]);
    setModules((m.data ?? []) as PortalModule[]);
    setAssignments((a.data ?? []) as ClientModuleAssignment[]);
    setMessages((msg.data ?? []) as ClientMessage[]);
    setBriefs((b.data ?? []) as unknown as BriefForPortal[]);
    const trows = (t.data ?? []) as unknown as (ClientTicket & { client_ticket_options: ClientTicketOption[] | null })[];
    setTickets(trows.map(({ client_ticket_options, ...rest }) => ({ ...rest, options: [...(client_ticket_options ?? [])].sort((x, y) => x.sort_order - y.sort_order) })));
    setChangelog((log.data ?? []) as ClientChangelogEntry[]);
    setReports((rep.data ?? []) as Pick<ClientReport, 'period_label' | 'published'>[]);
    setAudit((au.data as SpineAuditInput) ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // Same inputs the client's hook builds — newest brief's five milestone
  // fields, PUBLISHED reports only (the client can't see drafts, so the
  // spine mustn't count them either), sorted assignments.
  const spine: SpineStation[] = useMemo(() => {
    const newest = briefs[0];
    const brief: SpineBriefInput | null = newest
      ? { business: newest.business, bottleneck_verbatim: newest.bottleneck_verbatim, spec_approved_at: newest.spec_approved_at, design_locked_at: newest.design_locked_at, created_at: newest.created_at }
      : null;
    return buildSpine({ client, audit, brief, deliverables, reports: reports.filter((r) => r.published), settings, assignments });
  }, [client, audit, briefs, deliverables, reports, settings, assignments]);

  // ── Portal copy ────────────────────────────────────────────────────────
  const saveSettings = async (patch: Partial<Omit<ClientPortalSettings, 'id' | 'client_id' | 'created_at' | 'updated_at'>>) => {
    if (!clientId) return;
    if (settings) {
      await supabase.from('client_portal').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', settings.id);
    } else {
      await supabase.from('client_portal').insert({ client_id: clientId, ...patch });
    }
    await load();
  };

  /** Force one station's state, or clear the override (state = null) so
   *  the data decides again. */
  const setSpineOverride = async (key: SpineStationKey, state: SpineState | null) => {
    const next = { ...(settings?.spine_overrides ?? {}) };
    if (state) next[key] = state;
    else delete next[key];
    await saveSettings({ spine_overrides: next });
  };

  // ── Deliverables ───────────────────────────────────────────────────────
  const addDeliverable = async (input: { kind: DeliverableKind; title: string; what_it_is?: string | null; why_it_matters?: string | null; link_url?: string | null; brief_id?: string | null; status?: ClientDeliverable['status'] }) => {
    if (!clientId) return;
    const sort_order = deliverables.length ? Math.max(...deliverables.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('client_deliverables').insert({ client_id: clientId, sort_order, ...input });
    await load();
  };

  const updateDeliverable = async (id: string, patch: Partial<Pick<ClientDeliverable, 'kind' | 'title' | 'what_it_is' | 'why_it_matters' | 'link_url' | 'status' | 'sort_order' | 'brief_id'>>) => {
    const now = new Date().toISOString();
    const extra: Record<string, unknown> = {};
    // Moving into review is the moment it's put in front of the client;
    // leaving review clears any stale approval so a re-review is honest.
    if (patch.status === 'review') extra.approval_requested_at = now;
    if (patch.status && patch.status !== 'review') extra.approved_at = null;
    await supabase.from('client_deliverables').update({ ...patch, ...extra, updated_at: now }).eq('id', id);
    await load();
  };

  const removeDeliverable = async (id: string) => {
    await supabase.from('client_deliverables').delete().eq('id', id);
    await load();
  };

  // ── Change log ─────────────────────────────────────────────────────────
  const addChangelog = async (input: { what: string; why?: string | null; happened_on?: string; deliverable_id?: string | null; visible_to_client?: boolean }) => {
    if (!clientId || !input.what.trim()) return;
    await supabase.from('client_changelog').insert({ client_id: clientId, ...input, what: input.what.trim(), why: input.why?.trim() || null });
    await load();
  };

  const updateChangelog = async (id: string, patch: Partial<Pick<ClientChangelogEntry, 'what' | 'why' | 'happened_on' | 'visible_to_client' | 'deliverable_id'>>) => {
    await supabase.from('client_changelog').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const removeChangelog = async (id: string) => {
    await supabase.from('client_changelog').delete().eq('id', id);
    await load();
  };

  /** Flip a deliverable live AND write the change-log line in one go —
   *  the log is the proof of work, so shipping something without a line
   *  in it is the thing this exists to prevent. */
  const shipDeliverable = async (id: string, why: string | null) => {
    const d = deliverables.find((x) => x.id === id);
    if (!d) return;
    await updateDeliverable(id, { status: 'live' });
    await addChangelog({ what: `${d.title} went live`, why: why ?? d.why_it_matters ?? null, deliverable_id: id });
  };

  // ── Tickets ────────────────────────────────────────────────────────────
  /** The owner's answer is 2–3 options, never an open redo. Fewer than two
   *  is refused here so the shape of the conversation holds. */
  const answerTicket = async (ticketId: string, options: { body: string; link_url?: string | null }[], note: string | null): Promise<string | null> => {
    const clean = options.map((o) => ({ body: o.body.trim(), link_url: o.link_url?.trim() || null })).filter((o) => o.body);
    if (clean.length < 2) return 'Give them at least two options to choose between.';
    if (clean.length > 3) return 'Three options max — more than that is a redo in disguise.';
    const now = new Date().toISOString();
    const { error } = await supabase.from('client_ticket_options').insert(clean.map((o, i) => ({ ticket_id: ticketId, body: o.body, link_url: o.link_url, sort_order: i })));
    if (error) return error.message;
    await supabase.from('client_tickets').update({ status: 'options_sent', owner_note: note?.trim() || null, updated_at: now }).eq('id', ticketId);
    await load();
    return null;
  };

  const resolveTicket = async (ticketId: string) => {
    const now = new Date().toISOString();
    await supabase.from('client_tickets').update({ status: 'resolved', resolved_at: now, updated_at: now }).eq('id', ticketId);
    await load();
  };

  const reopenTicket = async (ticketId: string) => {
    await supabase.from('client_ticket_options').delete().eq('ticket_id', ticketId);
    await supabase.from('client_tickets').update({ status: 'open', resolved_at: null, updated_at: new Date().toISOString() }).eq('id', ticketId);
    await load();
  };

  // ── Modules ────────────────────────────────────────────────────────────
  /** Modules that fit what was actually delivered: applies_to empty
   *  (always) or overlapping the deliverable kinds on this client. */
  const relevantModules = (): PortalModule[] => {
    const kinds = new Set(deliverables.map((d) => d.kind));
    return modules.filter((m) => m.active && (m.applies_to.length === 0 || m.applies_to.some((k) => kinds.has(k))));
  };

  const assignModule = async (moduleId: string) => {
    if (!clientId) return;
    if (assignments.some((a) => a.module_id === moduleId)) return;
    const sort_order = assignments.length ? Math.max(...assignments.map((a) => a.sort_order)) + 1 : 0;
    await supabase.from('client_module_assignments').insert({ client_id: clientId, module_id: moduleId, sort_order });
    await load();
  };

  const unassignModule = async (moduleId: string) => {
    if (!clientId) return;
    await supabase.from('client_module_assignments').delete().eq('client_id', clientId).eq('module_id', moduleId);
    await load();
  };

  /** Assign every relevant module not yet assigned. Never unassigns —
   *  a manual assignment is a decision, not a cache. */
  const autoAssign = async () => {
    if (!clientId) return 0;
    const have = new Set(assignments.map((a) => a.module_id));
    let next = assignments.length ? Math.max(...assignments.map((a) => a.sort_order)) + 1 : 0;
    const rows = relevantModules().filter((m) => !have.has(m.id)).map((m) => ({ client_id: clientId, module_id: m.id, sort_order: next++ }));
    if (rows.length) await supabase.from('client_module_assignments').insert(rows);
    await load();
    return rows.length;
  };

  /** Per-client order — the client's Guides list follows it. */
  const reorderAssignments = async (orderedAssignmentIds: string[]) => {
    await Promise.all(orderedAssignmentIds.map((id, i) => supabase.from('client_module_assignments').update({ sort_order: i }).eq('id', id)));
    await load();
  };

  const updateModule = async (id: string, patch: Partial<Pick<PortalModule, 'title' | 'what_it_is' | 'why_it_matters' | 'steps' | 'done_when' | 'video_url' | 'applies_to' | 'active'>>) => {
    await supabase.from('portal_modules').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  // ── Messages ───────────────────────────────────────────────────────────
  const sendMessage = async (body: string) => {
    if (!clientId || !body.trim()) return;
    await supabase.from('client_messages').insert({ client_id: clientId, sender: 'owner', body: body.trim() });
    await load();
  };

  const markClientMessagesRead = async () => {
    if (!clientId) return;
    await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).eq('client_id', clientId).eq('sender', 'client').is('read_at', null);
    await load();
  };

  // ── Handoff ────────────────────────────────────────────────────────────
  /** Turning handoff on schedules a check-in as a reminder for the owner
   *  (the same reminders table the bell reads) so stepping back has a
   *  date on it, not a vibe. */
  const setHandoff = async (on: boolean, checkinOn: string | null, businessName: string) => {
    await saveSettings({
      handoff_mode: on,
      handoff_started_at: on ? (settings?.handoff_started_at ?? new Date().toISOString()) : null,
      handoff_checkin_on: on ? checkinOn : null,
    });
    if (on && checkinOn) {
      await supabase.from('reminders').insert({ title: `Handoff check-in with ${businessName} — open their portal, see which modules they've opened, message them.`, due_date: checkinOn });
    }
  };

  return {
    loading, client, settings, deliverables, modules, assignments, messages, briefs, tickets, changelog, spine,
    reload: load, saveSettings, setSpineOverride,
    addDeliverable, updateDeliverable, removeDeliverable, shipDeliverable,
    addChangelog, updateChangelog, removeChangelog,
    answerTicket, resolveTicket, reopenTicket,
    relevantModules, assignModule, unassignModule, autoAssign, reorderAssignments, updateModule,
    sendMessage, markClientMessagesRead, setHandoff,
  };
}
