import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CallRecording {
  id: string;
  contact_id: string | null;
  title: string;
  file_path: string;
  duration_seconds: number | null;
  notes: string | null;
  ai_analysis: string | null;
  recorded_at: string;
  created_at: string;
}

const BUCKET = 'call-recordings';

export function useCallRecordings() {
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('call_recordings').select('*').order('recorded_at', { ascending: false });
    setRecordings((data ?? []) as CallRecording[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File, meta: { title: string; contact_id: string | null; notes: string | null }) => {
    setUploading(true);
    setUploadError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from('call_recordings').insert({
        title: meta.title, contact_id: meta.contact_id, notes: meta.notes, file_path: path,
      });
      if (insertErr) throw insertErr;
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const getPlaybackUrl = async (filePath: string): Promise<string | null> => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
    return data?.signedUrl ?? null;
  };

  const updateNotes = async (id: string, notes: string) => {
    await supabase.from('call_recordings').update({ notes }).eq('id', id);
    await load();
  };

  const remove = async (id: string, filePath: string) => {
    await supabase.storage.from(BUCKET).remove([filePath]);
    await supabase.from('call_recordings').delete().eq('id', id);
    await load();
  };

  return { recordings, loading, uploading, uploadError, upload, getPlaybackUrl, updateNotes, remove };
}
