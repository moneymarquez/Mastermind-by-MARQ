import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientMedia, ClientMediaCategory } from './types';

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10MB, matches the storage bucket's own cap (schema_046)

/** Step 2 of the client-login/audit/invoice build — photo/document
 *  uploads attached to a client. Folder-per-user path
 *  (<user_id>/<client_id>/<file>), same convention as useClientReports'
 *  uploadAsset — both the storage RLS policy and the account-deletion
 *  checklist depend on that first path segment being the owner's uid. */
export function useClientMedia(clientId: string | null) {
  const [media, setMedia] = useState<ClientMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) {
      setMedia([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('client_media').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setMedia((data ?? []) as ClientMedia[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadMedia = async (file: File, category: ClientMediaCategory, auditId?: string | null, caption?: string) => {
    if (!clientId) return;
    if (file.size > MEDIA_MAX_BYTES) throw new Error(`${file.name} is over the 10MB limit.`);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error('Not signed in.');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${clientId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('client-media').upload(path, file);
    if (error) throw new Error(error.message);

    await supabase.from('client_media').insert({
      client_id: clientId,
      audit_id: auditId ?? null,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      category,
      caption: caption?.trim() || null,
    });
    await load();
  };

  const removeMedia = async (id: string, storagePath: string) => {
    await supabase.storage.from('client-media').remove([storagePath]);
    await supabase.from('client_media').delete().eq('id', id);
    await load();
  };

  const mediaUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from('client-media').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  };

  return { media, loading, uploadMedia, removeMedia, mediaUrl, reload: load };
}
