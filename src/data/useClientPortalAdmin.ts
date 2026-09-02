import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ClientDeliverable,
  ClientMessage,
  ClientModuleAssignment,
  ClientPortalSettings,
  DeliverableKind,
  PortalModule,
} from './types';

/** The slice of a Brand Lab brief the portal admin needs to pre-fill a
 *  deliverable's "what / why" from work already written there. */
export interface BriefForPortal {
  id: string;
  business: string | null;
  direction: string;
  functional_spec: { summary: string; pages: { name: string; purpose: string; enabled: boolean }[] } | null;
  bottleneck_verbatim: string | null;
  rounds_to_approval: number | null;
  design_locked_at: string | null;
}

/** Owner side of the Client Delivery Portal (schema_054), scoped to one
 *  client. Everything a client sees is authored or assigned here; the
 *  client's own hook (useClientPortalData) reads the same rows through
 *  RLS with no filters. */
export function useClientPortalAdmin(clientId: string | null) {
  const [settings, setSettings] = useState<ClientPortalSettings | null>(null);
  const [deliverables, setDeliverables] = useState<ClientDeliverable[]>([]);
  const [modules, setModules] = useState<PortalModule[]>([]);
  const [assignments, setAssignments] = useState<ClientModuleAssignment[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [briefs, setBriefs] = useState<BriefForPortal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    const [s, d, m, a, msg, b] = await Promise.all([
      supabase.from('client_portal').select('*').eq('client_id', clientId).maybeSingle(),
      supabase.from('client_deliverables').select('*').eq('client_id', clientId).order('sort_order').order('created_at'),
      supabase.from('portal_modules').select('*').order('sort_order'),
      supabase.from('client_module_assignments').select('*').eq('client_id', clientId),
      supabase.from('client_messages').select('*').eq('client_id', clientId).order('created_at'),
      supabase.from('brand_lab_briefs').select('id, business, direction, functional_spec, bottleneck_verbatim, rounds_to_approval, design_locked_at').eq('client_id', clientId).order('created_at', { ascending: false }),
    ]);
    setSettings((s.data as ClientPortalSettings) ?? null);
    setDeliverables((d.data ?? []) as ClientDeliverable[]);
    setModules((m.data ?? []) as PortalModule[]);
    setAssignments((a.data ?? []) as ClientModuleAssignment[]);
    setMessages((msg.data ?? []) as ClientMessage[]);
    setBriefs((b.data ?? []) as unknown as BriefForPortal[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

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

  // ── Deliverables ───────────────────────────────────────────────────────
  const addDeliverable = async (input: { kind: DeliverableKind; title: string; what_it_is?: string | null; why_it_matters?: string | null; link_url?: string | null; brief_id?: string | null; status?: ClientDeliverable['status'] }) => {
    if (!clientId) return;
    const sort_order = deliverables.length ? Math.max(...deliverables.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('client_deliverables').insert({ client_id: clientId, sort_order, ...input });
    await load();
  };

  const updateDeliverable = async (id: string, patch: Partial<Pick<ClientDeliverable, 'kind' | 'title' | 'what_it_is' | 'why_it_matters' | 'link_url' | 'status' | 'sort_order' | 'brief_id'>>) => {
    await supabase.from('client_deliverables').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const removeDeliverable = async (id: string) => {
    await supabase.from('client_deliverables').delete().eq('id', id);
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
    await supabase.from('client_module_assignments').insert({ client_id: clientId, module_id: moduleId });
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
    const rows = relevantModules().filter((m) => !have.has(m.id)).map((m) => ({ client_id: clientId, module_id: m.id }));
    if (rows.length) await supabase.from('client_module_assignments').insert(rows);
    await load();
    return rows.length;
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
    loading, settings, deliverables, modules, assignments, messages, briefs,
    reload: load, saveSettings,
    addDeliverable, updateDeliverable, removeDeliverable,
    relevantModules, assignModule, unassignModule, autoAssign, updateModule,
    sendMessage, markClientMessagesRead, setHandoff,
  };
}
