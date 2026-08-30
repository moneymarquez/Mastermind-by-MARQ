import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateClientAnalysis, matchServices } from './clientAnalysis';
import type {
  AnswerConfidence,
  AuditQuestion,
  ClientAudit,
  ClientInvoice,
  ClientPricingItem,
  ClientStage,
  CrmClient,
  PricingCadence,
  PricingTemplateItem,
  Service,
} from './types';

type ClientRow = CrmClient & {
  client_audits: ClientAudit[];
  client_pricing_items: ClientPricingItem[];
  client_invoices: ClientInvoice[];
};

export interface CrmClientWithChildren extends CrmClient {
  audit: ClientAudit | null;
  pricingItems: ClientPricingItem[];
  invoices: ClientInvoice[];
}

/** Client Audit, Analysis & Invoicing System — the full pipeline hook
 *  (Parts 1-5 of the build prompt). One nested query pulls each client
 *  with its audit, pricing plan, and invoices at once (same pattern as
 *  useGoals' goals/goal_steps/goal_checkins/goal_paths embed) rather than
 *  four separate round trips. */
export function useClientCRM() {
  const [clients, setClients] = useState<CrmClientWithChildren[]>([]);
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [template, setTemplate] = useState<PricingTemplateItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [clientsRes, questionsRes, templateRes, servicesRes] = await Promise.all([
      supabase
        .from('crm_clients')
        .select('*, client_audits(*), client_pricing_items(*), client_invoices(*)')
        .order('last_activity_at', { ascending: false }),
      supabase.from('audit_questions').select('*').order('sort_order'),
      supabase.from('pricing_template_items').select('*').order('sort_order'),
      supabase.from('services').select('*').order('sort_order'),
    ]);
    const rows = (clientsRes.data ?? []) as unknown as ClientRow[];
    setClients(
      rows.map((c) => ({
        ...c,
        audit: [...(c.client_audits ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
        pricingItems: [...(c.client_pricing_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        invoices: [...(c.client_invoices ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })),
    );
    setQuestions((questionsRes.data ?? []) as AuditQuestion[]);
    setTemplate((templateRes.data ?? []) as PricingTemplateItem[]);
    setServices((servicesRes.data ?? []) as Service[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const touch = () => ({ last_activity_at: new Date().toISOString() });

  // ── Clients ──────────────────────────────────────────────────────────
  const createClient = async (input: {
    business_name: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  }) => {
    const { data } = await supabase.from('crm_clients').insert({ ...input, source: 'internal' }).select().single();
    await load();
    return data as CrmClient | null;
  };

  const updateClient = async (
    id: string,
    patch: Partial<Pick<CrmClient, 'business_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'notes' | 'reveal_full_schedule'>>,
  ) => {
    await supabase.from('crm_clients').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const setStage = async (id: string, stage: ClientStage) => {
    await supabase.from('crm_clients').update({ stage, ...touch() }).eq('id', id);
    await load();
  };

  const removeClient = async (id: string) => {
    await supabase.from('crm_clients').delete().eq('id', id);
    await load();
  };

  // ── Audit question bank (admin-editable, not hardcoded) ────────────────
  const addQuestion = async (q: { category: string; key: string; prompt: string; helper_text?: string | null }) => {
    const sort_order = questions.length ? Math.max(...questions.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('audit_questions').insert({ ...q, sort_order });
    await load();
  };

  const updateQuestion = async (
    id: string,
    patch: Partial<Pick<AuditQuestion, 'category' | 'prompt' | 'helper_text' | 'active'>>,
  ) => {
    await supabase.from('audit_questions').update(patch).eq('id', id);
    await load();
  };

  const removeQuestion = async (id: string) => {
    await supabase.from('audit_questions').delete().eq('id', id);
    await load();
  };

  const reorderQuestions = async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, i) => supabase.from('audit_questions').update({ sort_order: i }).eq('id', id)));
    await load();
  };

  // ── Audit answers + analysis (Parts 1a/2) ───────────────────────────────
  const ensureAudit = async (clientId: string): Promise<ClientAudit | null> => {
    const client = clients.find((c) => c.id === clientId);
    if (client?.audit) return client.audit;
    const { data } = await supabase.from('client_audits').insert({ client_id: clientId, answers: {} }).select().single();
    await load();
    return data as ClientAudit | null;
  };

  const saveAnswer = async (auditId: string, key: string, value: string, currentAnswers: Record<string, string>) => {
    const answers = { ...currentAnswers, [key]: value };
    await supabase.from('client_audits').update({ answers, updated_at: new Date().toISOString() }).eq('id', auditId);
    await load();
  };

  /** Live-capture writes straight through without a reload — the whole
   *  point is that a dropped call never loses a partial answer, and
   *  re-fetching the whole CRM on every keystroke-debounce would fight
   *  the input. The caller refreshes when it leaves the flow. */
  const saveAnswerQuiet = async (auditId: string, answers: Record<string, string>) => {
    await supabase.from('client_audits').update({ answers, updated_at: new Date().toISOString() }).eq('id', auditId);
  };

  const setAnswerConfidence = async (auditId: string, confidence: Record<string, AnswerConfidence>, quiet = false) => {
    await supabase.from('client_audits').update({ answer_confidence: confidence, updated_at: new Date().toISOString() }).eq('id', auditId);
    if (!quiet) await load();
  };

  const completeAudit = async (
    clientId: string,
    auditId: string,
    businessName: string,
    answers: Record<string, string>,
    confidence: Record<string, AnswerConfidence> = {},
  ) => {
    const active = questions.filter((q) => q.active);
    const text = await generateClientAnalysis(businessName, active, answers, confidence);
    await supabase.from('client_audits').update({ status: 'complete', analysis_text: text, updated_at: new Date().toISOString() }).eq('id', auditId);
    const client = clients.find((c) => c.id === clientId);
    if (client && client.stage === 'new_lead') {
      await supabase.from('crm_clients').update({ stage: 'discovery_complete', ...touch() }).eq('id', clientId);
    }
    await load();
  };

  const regenerateAnalysis = async (
    auditId: string,
    businessName: string,
    answers: Record<string, string>,
    confidence: Record<string, AnswerConfidence> = {},
  ) => {
    const active = questions.filter((q) => q.active);
    const text = await generateClientAnalysis(businessName, active, answers, confidence);
    await supabase.from('client_audits').update({ analysis_text: text, updated_at: new Date().toISOString() }).eq('id', auditId);
    await load();
  };

  /** Service Matcher — the branch running alongside the written analysis.
   *  Flags which catalog services this client actually needs, stored so
   *  the flags survive between sessions. */
  const runServiceMatch = async (
    auditId: string,
    businessName: string,
    answers: Record<string, string>,
    confidence: Record<string, AnswerConfidence> = {},
  ) => {
    const active = questions.filter((q) => q.active);
    const suggestions = await matchServices(businessName, active, answers, confidence, services);
    await supabase.from('client_audits').update({ suggested_services: suggestions, updated_at: new Date().toISOString() }).eq('id', auditId);
    await load();
    return suggestions;
  };

  const dismissSuggestion = async (auditId: string, name: string, current: { name: string; category: string; reason: string }[]) => {
    await supabase
      .from('client_audits')
      .update({ suggested_services: current.filter((s) => s.name !== name), updated_at: new Date().toISOString() })
      .eq('id', auditId);
    await load();
  };

  const editAnalysisText = async (auditId: string, text: string) => {
    await supabase.from('client_audits').update({ analysis_text: text, updated_at: new Date().toISOString() }).eq('id', auditId);
    await load();
  };

  const markAnalysisSent = async (clientId: string) => {
    await supabase.from('crm_clients').update({ stage: 'analysis_sent', ...touch() }).eq('id', clientId);
    await load();
  };

  // ── Service catalog (Part 6) ────────────────────────────────────────────
  const addService = async (s: { category: string; name: string; price_type: PricingCadence; default_price: number; notes?: string | null }) => {
    const sort_order = services.length ? Math.max(...services.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('services').insert({ ...s, sort_order });
    await load();
  };

  const updateService = async (
    id: string,
    patch: Partial<Pick<Service, 'category' | 'name' | 'price_type' | 'default_price' | 'notes' | 'active'>>,
  ) => {
    await supabase.from('services').update(patch).eq('id', id);
    await load();
  };

  const removeService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    await load();
  };

  // ── Pricing template — the editable default package (Part 3) ───────────
  const addTemplateItem = async (item: { label: string; amount: number | null; cadence: PricingCadence; repeat_count: number; is_upfront?: boolean }) => {
    const sort_order = template.length ? Math.max(...template.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('pricing_template_items').insert({ ...item, sort_order });
    await load();
  };

  const updateTemplateItem = async (id: string, patch: Partial<Pick<PricingTemplateItem, 'label' | 'amount' | 'cadence' | 'repeat_count' | 'is_upfront'>>) => {
    await supabase.from('pricing_template_items').update(patch).eq('id', id);
    await load();
  };

  const removeTemplateItem = async (id: string) => {
    await supabase.from('pricing_template_items').delete().eq('id', id);
    await load();
  };

  // ── A client's own finalized pricing plan ───────────────────────────────
  const applyTemplateToClient = async (clientId: string) => {
    if (!template.length) return;
    const rows = template.map((t) => ({
      client_id: clientId,
      label: t.label,
      amount: t.amount,
      cadence: t.cadence,
      repeat_count: t.repeat_count,
      is_upfront: t.is_upfront,
      sort_order: t.sort_order,
    }));
    await supabase.from('client_pricing_items').insert(rows);
    await load();
  };

  const addPricingItem = async (
    clientId: string,
    item: { label: string; amount: number | null; cadence: PricingCadence; repeat_count: number; is_upfront?: boolean; service_id?: string | null },
  ) => {
    const client = clients.find((c) => c.id === clientId);
    const existing = client?.pricingItems ?? [];
    const sort_order = existing.length ? Math.max(...existing.map((x) => x.sort_order)) + 1 : 0;
    await supabase.from('client_pricing_items').insert({ client_id: clientId, ...item, sort_order });
    await load();
  };

  /** Adds a catalog service to a client's plan, carrying its price over as
   *  the starting amount — still fully editable per client from there. */
  const addServiceToClient = async (clientId: string, service: Service) => {
    await addPricingItem(clientId, {
      label: service.notes ? `${service.name} (${service.notes})` : service.name,
      amount: service.default_price,
      cadence: service.price_type,
      repeat_count: 1,
      service_id: service.id,
    });
  };

  const updatePricingItem = async (
    id: string,
    patch: Partial<Pick<ClientPricingItem, 'label' | 'amount' | 'cadence' | 'repeat_count' | 'is_upfront'>>,
  ) => {
    await supabase.from('client_pricing_items').update(patch).eq('id', id);
    await load();
  };

  /** TBD ⇄ real amount. Passing null marks the month undecided — nothing
   *  is shown to the client and it can't be invoiced until a number is
   *  set here. */
  const setItemAmount = async (id: string, amount: number | null) => {
    await supabase.from('client_pricing_items').update({ amount }).eq('id', id);
    await load();
  };

  const removePricingItem = async (id: string) => {
    await supabase.from('client_pricing_items').delete().eq('id', id);
    await load();
  };

  const setRevealSchedule = async (clientId: string, reveal: boolean) => {
    await supabase.from('crm_clients').update({ reveal_full_schedule: reveal, ...touch() }).eq('id', clientId);
    await load();
  };

  // ── Invoices (Part 4 — manual trigger only, worker owns the Stripe call) ─
  const createInvoice = async (input: {
    clientId: string;
    pricingItemId?: string | null;
    sequenceIndex?: number;
    description: string;
    amount: number;
    dueDate?: string | null;
  }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Not signed in.');

    const res = await fetch('/api/client-crm/create-invoice', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        clientId: input.clientId,
        pricingItemId: input.pricingItemId ?? null,
        sequenceIndex: input.sequenceIndex ?? 1,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate ?? null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Could not create the invoice (${res.status}).`);
    }
    await load();
    return (await res.json()) as ClientInvoice;
  };

  // ── Client login (Step 1) ───────────────────────────────────────────────
  const createClientLogin = async (clientId: string, email: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Not signed in.');

    const res = await fetch('/api/client-crm/create-client-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId, email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Could not create the login (${res.status}).`);
    }
    return (await res.json()) as { email: string; password: string };
  };

  return {
    clients,
    questions,
    template,
    services,
    loading,
    createClient,
    updateClient,
    setStage,
    removeClient,
    addQuestion,
    updateQuestion,
    removeQuestion,
    reorderQuestions,
    ensureAudit,
    saveAnswer,
    saveAnswerQuiet,
    setAnswerConfidence,
    completeAudit,
    regenerateAnalysis,
    runServiceMatch,
    dismissSuggestion,
    reload: load,
    editAnalysisText,
    markAnalysisSent,
    addService,
    updateService,
    removeService,
    addTemplateItem,
    updateTemplateItem,
    removeTemplateItem,
    applyTemplateToClient,
    addPricingItem,
    addServiceToClient,
    updatePricingItem,
    setItemAmount,
    removePricingItem,
    setRevealSchedule,
    createInvoice,
    createClientLogin,
  };
}
