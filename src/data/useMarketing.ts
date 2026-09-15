import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AssetType = 'copy' | 'creative' | 'brand' | 'reference';
export type CampaignStatus = 'planned' | 'running' | 'done';
export type PipelineStage = 'idea' | 'drafted' | 'filmed' | 'scheduled' | 'published';

export interface MarketingAsset {
  id: string;
  name: string;
  asset_type: AssetType;
  content: string | null;
  external_url: string | null;
  tags: string[];
  client_id: string | null;
  /** Which play this asset was built out for (schema_076) — null for
   *  anything added the old way, before a play existed to tie it to. */
  play_id: string | null;
  updated_at: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  notes: string | null;
  metrics: Record<string, number>;
  start_date: string | null;
  end_date: string | null;
  /** Which client this campaign is for, and the brief it was built from —
   *  both nullable (schema_070) since campaigns predate the client
   *  selector and could still be added unscoped from a screen with no
   *  client picked. */
  client_id: string | null;
  brief_id: string | null;
}

export interface PipelineItem {
  id: string;
  title: string;
  stage: PipelineStage;
  content: string | null;
  scheduled_date: string | null;
  notes: string | null;
  client_id: string | null;
  brief_id: string | null;
  /** Which content growth plan / idea this item came from (schema_083)
   *  — Content Creation's own linkage, parallel to Marketing's client_id/
   *  brief_id above. Null for anything added the Marketing way. */
  plan_id: string | null;
  idea_id: string | null;
}

// Per-account isolation (schema_072) — plain row ownership, no
// is_owner() gate, on every table this hook touches. No client-side
// owner check needed: the database already scopes every query and
// mutation below to auth.uid().
export function useMarketing() {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [assetsRes, campaignsRes, pipelineRes] = await Promise.all([
      supabase.from('marketing_assets').select('*').order('updated_at', { ascending: false }),
      supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('marketing_content_pipeline').select('*').order('updated_at', { ascending: false }),
    ]);
    setAssets((assetsRes.data ?? []) as MarketingAsset[]);
    setCampaigns((campaignsRes.data ?? []) as MarketingCampaign[]);
    setPipeline((pipelineRes.data ?? []) as PipelineItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAsset = async (input: { name: string; asset_type: AssetType; content?: string; external_url?: string; tags?: string[]; client_id?: string | null; play_id?: string | null }) => {
    await supabase.from('marketing_assets').insert({ ...input, updated_at: new Date().toISOString() });
    await load();
  };
  const updateAsset = async (id: string, patch: Partial<Pick<MarketingAsset, 'content' | 'name' | 'tags'>>) => {
    await supabase.from('marketing_assets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  const removeAsset = async (id: string) => {
    await supabase.from('marketing_assets').delete().eq('id', id);
    await load();
  };

  const addCampaign = async (input: { name: string; status: CampaignStatus; notes?: string; start_date?: string | null; end_date?: string | null; client_id?: string | null; brief_id?: string | null }) => {
    await supabase.from('marketing_campaigns').insert(input);
    await load();
  };
  const updateCampaign = async (id: string, patch: Partial<Pick<MarketingCampaign, 'status' | 'notes' | 'metrics'>>) => {
    await supabase.from('marketing_campaigns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  const removeCampaign = async (id: string) => {
    await supabase.from('marketing_campaigns').delete().eq('id', id);
    await load();
  };

  const addPipelineItem = async (title: string, clientId?: string | null, planId?: string | null, ideaId?: string | null) => {
    await supabase.from('marketing_content_pipeline').insert({ title, stage: 'idea', client_id: clientId ?? null, plan_id: planId ?? null, idea_id: ideaId ?? null });
    await load();
  };
  const updatePipelineItem = async (id: string, patch: Partial<Pick<PipelineItem, 'stage' | 'content' | 'notes' | 'scheduled_date'>>) => {
    await supabase.from('marketing_content_pipeline').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  const removePipelineItem = async (id: string) => {
    await supabase.from('marketing_content_pipeline').delete().eq('id', id);
    await load();
  };

  return {
    loading, assets, campaigns, pipeline,
    addAsset, updateAsset, removeAsset,
    addCampaign, updateCampaign, removeCampaign,
    addPipelineItem, updatePipelineItem, removePipelineItem,
  };
}
