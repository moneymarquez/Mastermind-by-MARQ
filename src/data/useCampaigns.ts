import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Answers, AssetDraft, DialingResults, ManualResults, Occurrence, StepAnswer, StepId } from './campaignBuilder';
import { firstIncompleteStep, STEPS } from './campaignBuilder';

export type CampaignStatus = 'planned' | 'running' | 'done';
export type AssetStatus = 'needed' | 'in_progress' | 'done';

/** marketing_campaigns as of schema_095. client_id null = Made by MARQ. */
export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  notes: string | null;
  metrics: Record<string, number>;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  brief_id: string | null;
  answers: Answers;
  current_step: number;
  skip_gating: boolean;
  plan_md: string | null;
  launched_at: string | null;
  last_activity_at: string;
  results: ManualResults;
  results_source: 'manual' | 'internal_dialing' | 'external';
  target_metric: string | null;
  target_value: number | null;
  budget_amount: number | null;
  budget_period: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignAsset {
  id: string;
  campaign_id: string | null;
  client_id: string | null;
  name: string;
  asset_type: 'copy' | 'creative' | 'brand' | 'reference';
  status: AssetStatus;
  content: string | null;
  external_url: string | null;
  tags: string[];
  updated_at: string;
}

/** Campaigns + their generated assets. One hook, one load, every screen
 *  that shows a campaign (Marketing, the CRM client view) reads the same
 *  rows. Writes stamp last_activity_at so the cockpit's stalled/on-track
 *  judgement is about real activity, not row age. */
export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from('marketing_campaigns').select('*').order('last_activity_at', { ascending: false }),
      supabase.from('marketing_assets').select('id, campaign_id, client_id, name, asset_type, status, content, external_url, tags, updated_at').not('campaign_id', 'is', null).order('created_at'),
    ]);
    if (c.error) setError(c.error.message);
    else { setError(''); setCampaigns((c.data ?? []) as Campaign[]); }
    setAssets((a.data ?? []) as CampaignAsset[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const touch = () => ({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() });

  const create = async (input: { name: string; client_id: string | null; brief_id?: string | null }): Promise<Campaign | null> => {
    const { data, error: err } = await supabase
      .from('marketing_campaigns')
      .insert({ name: input.name, client_id: input.client_id, brief_id: input.brief_id ?? null, status: 'planned', results_source: input.client_id ? 'manual' : 'internal_dialing' })
      .select('*')
      .single();
    if (err) { setError(err.message); return null; }
    await load();
    return data as Campaign;
  };

  const update = async (id: string, patch: Partial<Campaign>) => {
    const { error: err } = await supabase.from('marketing_campaigns').update({ ...patch, ...touch() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  /** Saves one step's answer and moves current_step to the first gap. */
  const saveAnswer = async (campaign: Campaign, step: StepId, answer: StepAnswer, extra: Partial<Campaign> = {}) => {
    const answers: Answers = { ...campaign.answers, [step]: answer };
    const next = Math.min(STEPS.length, firstIncompleteStep(answers));
    await update(campaign.id, { answers, current_step: next, ...extra });
  };

  /** Attaches the AI's reading of a free-text answer after the fact.
   *  Re-reads the row first so a step saved in the meantime isn't
   *  clobbered by this later, slower write. Doesn't count as activity. */
  const annotateAnswer = async (id: string, step: StepId, ai_summary: string) => {
    const { data } = await supabase.from('marketing_campaigns').select('answers').eq('id', id).maybeSingle();
    const current = ((data?.answers ?? {}) as Answers)[step];
    if (!current) return;
    const answers: Answers = { ...((data?.answers ?? {}) as Answers), [step]: { ...current, ai_summary } };
    await supabase.from('marketing_campaigns').update({ answers }).eq('id', id);
    await load();
  };

  const launch = async (campaign: Campaign, startDate: string | null, endDate: string | null) => {
    await update(campaign.id, { status: 'running', launched_at: new Date().toISOString(), start_date: startDate, end_date: endDate });
  };

  const remove = async (id: string) => {
    await supabase.from('events').delete().contains('details', { campaign_id: id });
    await supabase.from('marketing_campaigns').delete().eq('id', id);
    await load();
  };

  /** Replaces a campaign's generated checklist. Items the user already
   *  marked done or attached a link to are kept when their name recurs. */
  const replaceAssets = async (campaign: Campaign, drafts: AssetDraft[]) => {
    const existing = assets.filter((a) => a.campaign_id === campaign.id);
    const keep = new Map(existing.map((a) => [a.name, a]));
    const toDelete = existing.filter((a) => !drafts.some((d) => d.name === a.name)).map((a) => a.id);
    if (toDelete.length) await supabase.from('marketing_assets').delete().in('id', toDelete);
    const toInsert = drafts.filter((d) => !keep.has(d.name)).map((d) => ({
      name: d.name, asset_type: d.asset_type, content: d.content, tags: d.tags, status: 'needed',
      campaign_id: campaign.id, client_id: campaign.client_id, updated_at: new Date().toISOString(),
    }));
    if (toInsert.length) {
      const { error: err } = await supabase.from('marketing_assets').insert(toInsert);
      if (err) setError(err.message);
    }
    await supabase.from('marketing_campaigns').update(touch()).eq('id', campaign.id);
    await load();
  };

  const updateAsset = async (id: string, patch: Partial<Pick<CampaignAsset, 'status' | 'content' | 'external_url' | 'name'>>) => {
    const { error: err } = await supabase.from('marketing_assets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    const asset = assets.find((a) => a.id === id);
    if (asset?.campaign_id) await supabase.from('marketing_campaigns').update(touch()).eq('id', asset.campaign_id);
    await load();
  };

  const addAsset = async (campaign: Campaign, name: string) => {
    await supabase.from('marketing_assets').insert({ name, asset_type: 'reference', tags: ['campaign', 'custom'], status: 'needed', campaign_id: campaign.id, client_id: campaign.client_id, updated_at: new Date().toISOString() });
    await load();
  };
  const removeAsset = async (id: string) => {
    await supabase.from('marketing_assets').delete().eq('id', id);
    await load();
  };

  /** Writes the schedule step into the real calendar. Cold-calling
   *  campaigns become 'dialing' events (the Daily Plan files them under
   *  dialing); anything else a 'scalez' block labelled with the campaign.
   *  Re-running replaces this campaign's earlier events, never anyone
   *  else's — they're tagged in details.campaign_id. */
  const writeSchedule = async (campaign: Campaign, occurrences: Occurrence[], coldCalling: boolean, note: string | null) => {
    await supabase.from('events').delete().contains('details', { campaign_id: campaign.id });
    if (occurrences.length === 0) return;
    const rows = occurrences.map((o) => ({
      type: coldCalling ? 'dialing' : 'scalez',
      event_date: o.date, start_time: o.start_time, end_time: o.end_time,
      notes: note || `Campaign: ${campaign.name}`,
      status: 'campaign',
      linked_contact_id: null,
      details: coldCalling
        ? { first_name: 'Campaign:', last_name: campaign.name, phone: '', email: '', business_name: campaign.name, campaign_id: campaign.id }
        : { business_name: `Campaign: ${campaign.name}`, contact_name: '', phone: '', email: '', campaign_id: campaign.id },
    }));
    const { error: err } = await supabase.from('events').insert(rows);
    if (err) setError(err.message);
  };

  const saveResults = async (campaign: Campaign, results: ManualResults) => {
    await update(campaign.id, { results });
  };

  return {
    campaigns, assets, loading, error, reload: load,
    create, update, saveAnswer, annotateAnswer, launch, remove,
    replaceAssets, updateAsset, addAsset, removeAsset,
    writeSchedule, saveResults,
  };
}

/** Phase 2 — results for the internal cold-calling campaign, read
 *  straight from the data Masterminds already has: outcomes logged on the
 *  Dialing screen since the start date, and clients created in the CRM
 *  since then (a lead sent to the CRM is the close). No integration. */
export async function fetchDialingResults(startDate: string, endDate: string | null): Promise<DialingResults> {
  const end = endDate ?? '2999-12-31';
  const [outcomes, clients] = await Promise.all([
    supabase.from('call_outcomes').select('outcome, call_date').gte('call_date', startDate).lte('call_date', end),
    supabase.from('crm_clients').select('id, created_at, client_type').gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${end}T23:59:59`),
  ]);
  const rows = (outcomes.data ?? []) as { outcome: string; call_date: string }[];
  const dials = rows.length;
  const conversations = rows.filter((r) => !['no_answer', 'voicemail'].includes(r.outcome)).length;
  const appointments = rows.filter((r) => r.outcome === 'appointment_set').length;
  const closes = ((clients.data ?? []) as { client_type: string }[]).filter((c) => c.client_type !== 'self').length;
  const days = new Set(rows.map((r) => r.call_date)).size;
  return { dials, conversations, appointments, closes, days };
}
