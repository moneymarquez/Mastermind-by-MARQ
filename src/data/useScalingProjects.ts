import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const VIDEO_BUCKET = 'project-videos';

export interface ScalingProject {
  id: string;
  name: string;
  idea_session_id: string | null;
  brand_lab_brief_id: string | null;
  website_url: string | null;
  scaling_plan_id: string | null;
  invoice_document_id: string | null;
  status: 'in_progress' | 'ready_to_deliver' | 'delivered';
  client_name: string | null;
  client_email: string | null;
  video_path: string | null;
  delivered_at: string | null;
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

  const uploadVideo = async (id: string, file: File): Promise<boolean> => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return false;
    const ext = file.name.split('.').pop() ?? 'mp4';
    const path = `${userId}/${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file);
    if (error) return false;
    await patch(id, { video_path: path });
    return true;
  };

  const videoSignedUrl = async (path: string, expiresIn = 3600): Promise<string | null> => {
    const { data } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  };

  const removeVideo = async (id: string, path: string) => {
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
    await patch(id, { video_path: null });
  };

  return { projects, loading, create, patch, remove, uploadVideo, videoSignedUrl, removeVideo };
}

export interface DeliveryLogEntry {
  id: string;
  project_id: string;
  event: string;
  note: string | null;
  created_at: string;
}

export function useDeliveryLog(projectId: string | null) {
  const [entries, setEntries] = useState<DeliveryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setEntries([]); setLoading(false); return; }
    const { data } = await supabase.from('delivery_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setEntries((data ?? []) as DeliveryLogEntry[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const addEntry = async (event: string, note?: string) => {
    if (!projectId) return;
    await supabase.from('delivery_log').insert({ project_id: projectId, event, note: note ?? null });
    await load();
  };

  return { entries, loading, addEntry, reload: load };
}
