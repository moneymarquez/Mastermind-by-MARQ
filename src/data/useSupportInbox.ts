import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SupportInboxEntry {
  id: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  category: string | null;
  ai_draft_reply: string | null;
  status: 'new' | 'reviewed' | 'replied' | 'ignored';
  created_at: string;
}

export function useSupportInbox() {
  const [entries, setEntries] = useState<SupportInboxEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('support_inbox').select('*').order('created_at', { ascending: false });
    setEntries((data ?? []) as SupportInboxEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: SupportInboxEntry['status']) => {
    await supabase.from('support_inbox').update({ status }).eq('id', id);
    await load();
  };

  return { entries, loading, setStatus, reload: load };
}
