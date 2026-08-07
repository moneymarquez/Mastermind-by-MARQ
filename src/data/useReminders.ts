import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Reminder } from './types';

export interface ReminderInput {
  title: string;
  due_date: string;
  due_time: string | null;
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('done', false)
      .order('due_date')
      .order('due_time', { nullsFirst: false });
    setReminders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addReminder = async (input: ReminderInput) => {
    await supabase.from('reminders').insert(input);
    await load();
  };

  const markDone = async (id: string) => {
    await supabase.from('reminders').update({ done: true }).eq('id', id);
    await load();
  };

  const deleteReminder = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
    await load();
  };

  return { reminders, loading, addReminder, markDone, deleteReminder };
}
