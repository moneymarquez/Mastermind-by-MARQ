import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Signed rather than public (see schema_065_avatars.sql) — a week is long
// enough that a mounted Sidebar/MobileMenuSheet never sees it expire
// mid-session, short enough that a stale link isn't handed out forever.
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

/** The account's own profile photo — stored in the private `avatars`
 *  bucket under `<user_id>/avatar.<ext>`, with the path (not a URL, which
 *  would go stale) saved on the auth user as user_metadata.avatar_path.
 *  Every consumer (Sidebar, MobileMenuSheet, AccountSettingsScreen) calls
 *  this hook independently — it's cheap and keeps them from needing the
 *  photo threaded through Stage.tsx's prop chain. */
export function useAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const path = data.user?.user_metadata?.avatar_path as string | undefined;
    if (!path) {
      setAvatarUrl(null);
      setLoading(false);
      return;
    }
    const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, SIGNED_URL_TTL);
    setAvatarUrl(signed?.signedUrl ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File): Promise<boolean> => {
    setUploading(true);
    setError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError('Not signed in.');
        return false;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${uid}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadErr) {
        setError(uploadErr.message);
        return false;
      }
      const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_path: path } });
      if (metaErr) {
        setError(metaErr.message);
        return false;
      }
      await load();
      return true;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (): Promise<boolean> => {
    const { data: userData } = await supabase.auth.getUser();
    const path = userData.user?.user_metadata?.avatar_path as string | undefined;
    if (path) await supabase.storage.from('avatars').remove([path]);
    const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_path: null } });
    if (metaErr) {
      setError(metaErr.message);
      return false;
    }
    setAvatarUrl(null);
    return true;
  };

  return { avatarUrl, loading, uploading, error, upload, remove };
}
