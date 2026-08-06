import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CalendarEvent, EventType } from './types';

export interface EventInput {
  type: EventType;
  event_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string | null;
  linked_contact_id: string | null;
  details: Record<string, unknown>;
}

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').order('event_date').order('start_time');
    setEvents((data ?? []) as CalendarEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addEvent = async (input: EventInput) => {
    const { data } = await supabase.from('events').insert(input).select().single();
    await load();
    return data as CalendarEvent;
  };

  /** HOLIDAY creates one row per selected day, sharing the same time range/note. */
  const addHolidayEvents = async (dates: string[], start_time: string, end_time: string, notes: string | null) => {
    const rows = dates.map((event_date) => ({
      type: 'holiday' as const,
      event_date,
      start_time,
      end_time,
      notes,
      status: null,
      linked_contact_id: null,
      details: {},
    }));
    await supabase.from('events').insert(rows);
    await load();
  };

  const updateEvent = async (id: string, patch: Partial<EventInput>) => {
    await supabase.from('events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    await load();
  };

  return { events, loading, addEvent, addHolidayEvents, updateEvent, deleteEvent };
}
