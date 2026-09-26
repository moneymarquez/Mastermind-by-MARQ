import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_DAILY_CALL_GOAL } from './callGoal';

export type BlockKind = 'work' | 'dials' | 'build' | 'content' | 'health' | 'other';
export interface ScheduleBlock { id: string; day_of_week: number; start_time: string; end_time: string; label: string; kind: BlockKind; active: boolean }
export interface DigestSettings { id: string; enabled: boolean; send_time: string; timezone: string; channel: 'sms' | 'push' | 'both'; desks: Record<string, boolean>; separate_texts: boolean; last_sent_date: string | null }
export interface PlanTarget { id: string; key: string; label: string; period: 'day' | 'week' | 'month'; target: number; unit: string | null }
export interface DailyLog { id: string; date: string; dials: number | null; conversations: number | null; meetings: number | null; inbound_leads: number | null; posts: number | null; cash_in: number | null; notes: string | null; top_done: boolean }
export interface DigestLogRow { id: string; date: string; kind: string; channel: string | null; body: string; status: string; error: string | null; created_at: string }

/** The five numbers the digest measures against. Dials default to the
 *  app-wide call goal so there's one source for "35". */
export const DEFAULT_TARGETS: Omit<PlanTarget, 'id'>[] = [
  { key: 'dials', label: 'Dials', period: 'day', target: DEFAULT_DAILY_CALL_GOAL, unit: 'calls' },
  { key: 'cash', label: 'Cash in', period: 'week', target: 1750, unit: 'USD' },
  { key: 'posts', label: 'Posts', period: 'day', target: 2, unit: 'posts' },
  { key: 'inbound', label: 'Inbound leads', period: 'week', target: 3, unit: 'leads' },
  { key: 'meetings', label: 'Meetings', period: 'week', target: 2, unit: 'meetings' },
];

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDigest() {
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [targets, setTargets] = useState<PlanTarget[]>([]);
  const [log, setLog] = useState<DailyLog | null>(null);
  const [sends, setSends] = useState<DigestLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const today = localDate();
    const [s, b, t, l, g] = await Promise.all([
      supabase.from('digest_settings').select('*').maybeSingle(),
      supabase.from('schedule_blocks').select('*').order('day_of_week').order('start_time'),
      supabase.from('plan_targets').select('*').order('created_at'),
      supabase.from('daily_log').select('*').eq('date', today).maybeSingle(),
      supabase.from('digest_log').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    if (s.error) setError(s.error.message); else setError('');
    let settingsRow = s.data as DigestSettings | null;
    // First open: create the row with the spec defaults (05:30, America/Denver, SMS + push).
    if (!settingsRow && !s.error) {
      const made = await supabase.from('digest_settings').insert({}).select('*').single();
      settingsRow = (made.data as DigestSettings | null) ?? null;
    }
    let targetRows = (t.data ?? []) as PlanTarget[];
    if (!t.error && targetRows.length === 0) {
      const made = await supabase.from('plan_targets').insert(DEFAULT_TARGETS).select('*');
      targetRows = (made.data ?? []) as PlanTarget[];
    }
    setSettings(settingsRow);
    setBlocks((b.data ?? []) as ScheduleBlock[]);
    setTargets(targetRows);
    setLog((l.data as DailyLog | null) ?? null);
    setSends((g.data ?? []) as DigestLogRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async (patch: Partial<DigestSettings>) => {
    if (!settings) return;
    const { error: e } = await supabase.from('digest_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', settings.id);
    if (e) setError(e.message); else setSettings({ ...settings, ...patch });
  };
  const addBlock = async (b: Omit<ScheduleBlock, 'id' | 'active'>) => {
    const { error: e } = await supabase.from('schedule_blocks').insert(b);
    if (e) setError(e.message);
    await load();
  };
  const updateBlock = async (id: string, patch: Partial<ScheduleBlock>) => {
    const { error: e } = await supabase.from('schedule_blocks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (e) setError(e.message);
    await load();
  };
  const removeBlock = async (id: string) => { await supabase.from('schedule_blocks').delete().eq('id', id); await load(); };
  /** Copy one day's blocks onto other days, replacing what those days had. */
  const copyDay = async (from: number, to: number[]) => {
    const src = blocks.filter((b) => b.day_of_week === from);
    await supabase.from('schedule_blocks').delete().in('day_of_week', to);
    if (src.length) await supabase.from('schedule_blocks').insert(to.flatMap((d) => src.map((b) => ({ day_of_week: d, start_time: b.start_time, end_time: b.end_time, label: b.label, kind: b.kind }))));
    await load();
  };
  const saveTarget = async (id: string, target: number) => {
    const { error: e } = await supabase.from('plan_targets').update({ target, updated_at: new Date().toISOString() }).eq('id', id);
    if (e) setError(e.message);
    await load();
  };
  const saveLog = async (patch: Partial<DailyLog>) => {
    const { error: e } = await supabase.from('daily_log').upsert({ date: localDate(), ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
    if (e) setError(e.message);
    await load();
  };

  return { settings, blocks, targets, log, sends, loading, error, reload: load, saveSettings, addBlock, updateBlock, removeBlock, copyDay, saveTarget, saveLog };
}
