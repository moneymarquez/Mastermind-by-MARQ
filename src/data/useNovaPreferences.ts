import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type NovaTone = 'direct' | 'encouraging' | 'neutral';

export function useNovaPreferences() {
  const [tone, setTone] = useState<NovaTone>('direct');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('nova_preferences').select('tone').maybeSingle();
    if (data) setTone(data.tone as NovaTone);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next: NovaTone) => {
    setTone(next);
    await supabase.from('nova_preferences').upsert({ tone: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { tone, loading, save };
}
