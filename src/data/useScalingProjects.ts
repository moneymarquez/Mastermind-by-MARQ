import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ScalingProject {
  id: string;
  name: string;
  idea_session_id: string | null;
  brand_lab_brief_id: string | null;
  website_url: string | null;
  scaling_plan_id: string | null;
  invoice_document_id: string | null;
  status: 'in_progress' | 'ready_to_deliver' | 'delivered';
  created_at: string;
  updated_at: string;
}

export function useScalingProjects() {
  const [projects, setProjects] = useState<ScalingProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('scaling_projects').select('*').order('created_at', { ascending: false });
    setProjects((data ?? []) as ScalingProject[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (name: string): Promise<ScalingProject | null> => {
    const { data } = await supabase.from('scaling_projects').insert({ name: name.trim() }).select().single();
    await load();
    return (data as ScalingProject) ?? null;
  };

  const patch = async (id: string, fields: Partial<ScalingProject>) => {
    await supabase.from('scaling_projects').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const remove = async (id: string) => {
    await supabase.from('scaling_projects').delete().eq('id', id);
    await load();
  };

  return { projects, loading, create, patch, remove };
}
