import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AssetType = 'copy' | 'creative' | 'brand' | 'reference';
export type CampaignStatus = 'planned' | 'running' | 'done';
export type PipelineStage = 'idea' | 'drafted' | 'scheduled' | 'published';

export interface MarketingAsset {
  id: string;
  name: string;
  asset_type: AssetType;
  content: string | null;
  external_url: string | null;
  tags: string[];
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
}

export interface PipelineItem {
  id: string;
  title: string;
  stage: PipelineStage;
  content: string | null;
  scheduled_date: string | null;
  notes: string | null;
}

// Every table here is RLS-locked to is_owner(auth.uid()) as well as
// auth.uid() = user_id (see schema_025) — a non-owner account gets zero
// rows and a rejected write from Supabase directly, regardless of
// anything this hook or its caller does. This hook has no client-side
// owner check of its own because it doesn't need one: the database
// already refuses non-owner access to every query and mutation below.
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

  const addAsset = async (input: { name: string; asset_type: AssetType; content?: string; external_url?: string; tags?: string[] }) => {
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

  const addCampaign = async (input: { name: string; status: CampaignStatus; notes?: string; start_date?: string | null; end_date?: string | null }) => {
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

  const addPipelineItem = async (title: string) => {
    await supabase.from('marketing_content_pipeline').insert({ title, stage: 'idea' });
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
