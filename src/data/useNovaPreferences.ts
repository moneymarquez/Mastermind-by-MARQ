import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type NovaTone = 'direct' | 'encouraging' | 'neutral';

export const DEFAULT_ASSISTANT_NAME = 'Nova';

export function useNovaPreferences() {
  const [tone, setTone] = useState<NovaTone>('direct');
  const [assistantName, setAssistantName] = useState(DEFAULT_ASSISTANT_NAME);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nova_preferences').select('tone, assistant_name').maybeSingle();
    if (data) {
      setTone(data.tone as NovaTone);
      setAssistantName(data.assistant_name || DEFAULT_ASSISTANT_NAME);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next: NovaTone) => {
    setTone(next);
    await supabase.from('nova_preferences').upsert({ tone: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  const saveAssistantName = async (next: string) => {
    const trimmed = next.trim() || DEFAULT_ASSISTANT_NAME;
    setAssistantName(trimmed);
    await supabase.from('nova_preferences').upsert({ assistant_name: trimmed, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { tone, assistantName, loading, save, saveAssistantName };
}
