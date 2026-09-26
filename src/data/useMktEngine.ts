import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Script, Touch, TouchChannel, TouchOutcome, ScriptSeed } from './mktEngine';
import { STARTER_SCRIPTS, leadStatusToOutcome, getActiveScript } from './mktEngine';

/** Scripts, with versions kept: editing the body writes a new row and
 *  retires the old one, so a win rate always belongs to the exact words
 *  that earned it. */
export function useScripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('mkt_scripts').select('*').order('created_at', { ascending: true });
    if (err) setError(err.message); else setError('');
    setScripts((data ?? []) as Script[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (input: ScriptSeed | (Omit<ScriptSeed, 'principle'> & { principle: string | null })): Promise<Script | null> => {
    const { data, error: err } = await supabase.from('mkt_scripts').insert(input).select('*').single();
    if (err) { setError(err.message); return null; }
    await load();
    return data as Script;
  };
  /** Metadata-only changes (title, tone, principle…) edit in place. */
  const update = async (id: string, patch: Partial<Script>) => {
    const { error: err } = await supabase.from('mkt_scripts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };
  /** A body change = a new version. The old one stays for its history. */
  const newVersion = async (s: Script, body: string, patch: Partial<Pick<Script, 'title' | 'principle' | 'tone' | 'audience' | 'channel'>> = {}): Promise<Script | null> => {
    const { data, error: err } = await supabase.from('mkt_scripts')
      .insert({ venture: s.venture, audience: s.audience, tone: s.tone, channel: s.channel, title: s.title, principle: s.principle, ...patch, body, version: s.version + 1, parent_id: s.id })
      .select('*').single();
    if (err) { setError(err.message); return null; }
    await supabase.from('mkt_scripts').update({ active: false, updated_at: new Date().toISOString() }).eq('id', s.id);
    await load();
    return data as Script;
  };
  const remove = async (id: string) => { await supabase.from('mkt_scripts').delete().eq('id', id); await load(); };
  const seedStarters = async () => {
    const { error: err } = await supabase.from('mkt_scripts').insert(STARTER_SCRIPTS);
    if (err) setError(err.message);
    await load();
  };

  return { scripts, loading, error, reload: load, create, update, newVersion, remove, seedStarters };
}

export interface LogTouchInput {
  contact_id?: string | null; contact_name?: string | null; contact_phone?: string | null;
  channel?: TouchChannel; outcome: TouchOutcome; script_id?: string | null; campaign_id?: string | null; source_status?: string | null; notes?: string | null;
}

/** Every touch in the window, newest first. */
export function useTouches(days = 90) {
  const [touches, setTouches] = useState<Touch[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase.from('mkt_touches').select('*').gte('at', since).order('at', { ascending: false }).limit(2000);
    setTouches((data ?? []) as Touch[]);
    setLoading(false);
  }, [days]);
  useEffect(() => { load(); }, [load]);
  const logTouch = async (input: LogTouchInput) => {
    await supabase.from('mkt_touches').insert({ channel: 'call', ...input });
    await load();
  };
  return { touches, loading, reload: load, logTouch };
}

/** The 2-tap path: LeadFlow's own outcome buttons (tap the lead, tap the
 *  outcome) also write a marketing touch, stamped with whatever script
 *  is open in dialer mode. Best-effort by design — the lead's status is
 *  the record of truth and must never fail because this table did. */
export async function recordLeadTouch(
  lead: { id: string; business_name?: string | null; owner_name?: string | null; phone?: string | null; owner_phone?: string | null },
  status: string,
  opts: { script_id?: string | null; notes?: string | null; channel?: TouchChannel } = {},
): Promise<void> {
  const outcome = leadStatusToOutcome(status);
  if (!outcome) return;
  try {
    await supabase.from('mkt_touches').insert({
      contact_id: lead.id,
      contact_name: [lead.business_name, lead.owner_name].filter(Boolean).join(' — ') || null,
      contact_phone: lead.owner_phone || lead.phone || null,
      channel: opts.channel ?? 'call',
      outcome,
      source_status: status,
      script_id: opts.script_id === undefined ? getActiveScript() : opts.script_id,
      notes: opts.notes ?? null,
    });
  } catch { /* see above */ }
}
