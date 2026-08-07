import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Singleton-per-user pitch script (dialing_pitch table, unique on user_id). */
export function usePitch() {
  const [pitchText, setPitchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('dialing_pitch').select('pitch_text').maybeSingle();
    setPitchText(data?.pitch_text ?? '');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePitch = async (text: string) => {
    setSaving(true);
    setPitchText(text);
    await supabase.from('dialing_pitch').upsert({ pitch_text: text, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setSaving(false);
  };

  return { pitchText, loading, saving, savePitch };
}
