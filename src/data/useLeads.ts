import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateClientAnalysis } from './clientAnalysis';
import type { AnswerConfidence, AuditQuestion } from './types';

export interface LeadItem {
  id: string;
  businessName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: string;
  createdAt: string;
  auditId: string | null;
  hasAnalysis: boolean;
}

interface LeadRow {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: string;
  created_at: string;
  client_audits: { id: string; analysis_text: string | null }[];
}

/** Public /audit questionnaire submissions — crm_clients rows with
 *  source='public'. Kept as its own light query (not the full
 *  useClientCRM load, which also pulls pricing/invoices/service catalog)
 *  since this only backs the sidebar's green Leads widget and its "all
 *  leads" list. A lead counts as new/unreviewed while it's still sitting
 *  in stage 'new_lead' — the same stage the worker's publicAuditSubmit
 *  handler puts it in — and "Transfer to Client CRM" (transferLead below)
 *  is what advances it out of that stage. */
export function useLeads() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('crm_clients')
      .select('id, business_name, contact_name, contact_email, contact_phone, stage, created_at, client_audits(id, analysis_text)')
      .eq('source', 'public')
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as LeadRow[];
    setLeads(
      rows.map((r) => {
        const audit = [...(r.client_audits ?? [])][0] ?? null;
        return {
          id: r.id,
          businessName: r.business_name,
          contactName: r.contact_name,
          contactEmail: r.contact_email,
          contactPhone: r.contact_phone,
          stage: r.stage,
          createdAt: r.created_at,
          auditId: audit?.id ?? null,
          hasAnalysis: !!audit?.analysis_text,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const newLeads = leads.filter((l) => l.stage === 'new_lead');

  /** The green button's core action: takes the questionnaire answers this
   *  lead already submitted, generates the same Where Things Stand
   *  Today/What Sets Them Apart/The Plan/Investment/Next Steps analysis
   *  Client CRM produces for an internally-created client, saves it onto
   *  their audit, and (if they're still sitting in new_lead) advances the
   *  stage to discovery_complete — mirroring exactly what useClientCRM's
   *  completeAudit does, without needing that hook's full heavier load. */
  const transferLead = async (lead: LeadItem) => {
    if (!lead.auditId) return;
    const [auditRes, questionsRes] = await Promise.all([
      supabase.from('client_audits').select('answers, answer_confidence').eq('id', lead.auditId).single(),
      supabase.from('audit_questions').select('*').eq('active', true).order('sort_order'),
    ]);
    const answers = (auditRes.data?.answers ?? {}) as Record<string, string>;
    const confidence = (auditRes.data?.answer_confidence ?? {}) as Record<string, AnswerConfidence>;
    const questions = (questionsRes.data ?? []) as AuditQuestion[];

    const text = await generateClientAnalysis(lead.businessName, questions, answers, confidence);
    await supabase.from('client_audits').update({ analysis_text: text, updated_at: new Date().toISOString() }).eq('id', lead.auditId);
    if (lead.stage === 'new_lead') {
      await supabase.from('crm_clients').update({ stage: 'discovery_complete', last_activity_at: new Date().toISOString() }).eq('id', lead.id);
    }
    await load();
  };

  return { leads, newLeads, loading, reload: load, transferLead };
}
