import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ClientReport,
  ClientReportAsset,
  ClientReportCampaign,
  ClientReportNote,
  ReportAssetKind,
  ReportAssetStatus,
} from './types';

type ReportRow = ClientReport & {
  client_report_assets: ClientReportAsset[];
  client_report_campaigns: ClientReportCampaign[];
  client_report_notes: ClientReportNote[];
};

export interface ReportWithChildren extends ClientReport {
  assets: ClientReportAsset[];
  campaigns: ClientReportCampaign[];
  notes: ClientReportNote[];
}

/** Part 7 — the admin side of the client dashboard. Everything here is
 *  manual entry; the client-facing read of the same data goes through the
 *  Worker's token-keyed public endpoint, not this hook. Scoped to one
 *  client so the CRM's Reports tab only loads what it's showing. */
export function useClientReports(clientId: string | null) {
  const [reports, setReports] = useState<ReportWithChildren[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      setReports([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('client_reports')
      .select('*, client_report_assets(*), client_report_campaigns(*), client_report_notes(*)')
      .eq('client_id', clientId)
      .order('period_start', { ascending: false });
    const rows = (data ?? []) as unknown as ReportRow[];
    setReports(
      rows.map((r) => ({
        ...r,
        assets: [...(r.client_report_assets ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        campaigns: [...(r.client_report_campaigns ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        notes: [...(r.client_report_notes ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      })),
    );
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Creates the period row. period_start is normalized to the 1st so the
   *  unique(client_id, period_start) constraint actually means "one report
   *  per month" rather than one per arbitrary date. */
  const createReport = async (periodStart: string, periodLabel: string) => {
    if (!clientId) return null;
    const firstOfMonth = `${periodStart.slice(0, 7)}-01`;
    const { data } = await supabase
      .from('client_reports')
      .insert({ client_id: clientId, period_start: firstOfMonth, period_label: periodLabel })
      .select()
      .single();
    await load();
    return data as ClientReport | null;
  };

  const patchReport = async (id: string, patch: Partial<Omit<ClientReport, 'id' | 'client_id' | 'created_at' | 'updated_at'>>) => {
    await supabase.from('client_reports').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const removeReport = async (id: string) => {
    await supabase.from('client_reports').delete().eq('id', id);
    await load();
  };

  // ── Assets ─────────────────────────────────────────────────────────────
  // Folder-per-user path (<user_id>/<report_id>/<file>) matching the
  // call-recordings and project-videos buckets — both the storage RLS
  // policy and the account-deletion checklist in the README depend on
  // that first path segment being the owner's uid.
  const uploadAsset = async (reportId: string, file: File, kind: ReportAssetKind, caption?: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error('Not signed in.');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${reportId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('client-reports').upload(path, file);
    if (error) throw new Error(error.message);

    const existing = reports.find((r) => r.id === reportId)?.assets ?? [];
    const sort_order = existing.length ? Math.max(...existing.map((a) => a.sort_order)) + 1 : 0;

    await supabase.from('client_report_assets').insert({
      report_id: reportId,
      kind,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      // Only proofs carry a meaningful review state; delivered content is
      // live by definition.
      status: kind === 'proof' ? 'draft' : 'live',
      caption: caption?.trim() || null,
      sort_order,
    });
    await load();
  };

  const setAssetStatus = async (id: string, status: ReportAssetStatus) => {
    await supabase.from('client_report_assets').update({ status }).eq('id', id);
    await load();
  };

  const removeAsset = async (id: string, storagePath: string) => {
    await supabase.storage.from('client-reports').remove([storagePath]);
    await supabase.from('client_report_assets').delete().eq('id', id);
    await load();
  };

  /** Signed URL for previewing an upload in the admin form. The client
   *  dashboard gets its own signed URLs from the Worker instead — this one
   *  needs a session, which a client never has. */
  const assetPreviewUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from('client-reports').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  };

  // ── Campaigns ──────────────────────────────────────────────────────────
  const addCampaign = async (reportId: string, c: { name: string; description?: string | null; launched_on?: string | null; result_notes?: string | null }) => {
    await supabase.from('client_report_campaigns').insert({ report_id: reportId, ...c });
    await load();
  };

  const updateCampaign = async (id: string, patch: Partial<Pick<ClientReportCampaign, 'name' | 'description' | 'launched_on' | 'result_notes'>>) => {
    await supabase.from('client_report_campaigns').update(patch).eq('id', id);
    await load();
  };

  const removeCampaign = async (id: string) => {
    await supabase.from('client_report_campaigns').delete().eq('id', id);
    await load();
  };

  // ── Notes ──────────────────────────────────────────────────────────────
  const addNote = async (reportId: string, body: string) => {
    if (!body.trim()) return;
    await supabase.from('client_report_notes').insert({ report_id: reportId, body: body.trim() });
    await load();
  };

  const removeNote = async (id: string) => {
    await supabase.from('client_report_notes').delete().eq('id', id);
    await load();
  };

  return {
    reports,
    loading,
    createReport,
    patchReport,
    removeReport,
    uploadAsset,
    setAssetStatus,
    removeAsset,
    assetPreviewUrl,
    addCampaign,
    updateCampaign,
    removeCampaign,
    addNote,
    removeNote,
  };
}
