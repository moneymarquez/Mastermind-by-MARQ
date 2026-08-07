import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { NotificationSettings } from './types';

const DEFAULTS: NotificationSettings = {
  shifts_enabled: true,
  events_enabled: true,
  meals_enabled: true,
  opening_closing_enabled: true,
  breakfast_time: '08:00',
  lunch_time: '12:30',
  dinner_time: '18:30',
};

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notification_settings')
      .select('shifts_enabled, events_enabled, meals_enabled, opening_closing_enabled, breakfast_time, lunch_time, dinner_time')
      .maybeSingle();
    if (data) setSettings(data as NotificationSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<NotificationSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from('notification_settings').upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { settings, loading, save };
}
