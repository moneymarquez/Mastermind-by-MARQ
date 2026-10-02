import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/** The redesign's Leads feed: every inbound lead in one list, from every
 *  place one can arrive — the website form and hand-logged DMs
 *  (mkt_inbound), the public audit form (crm_clients source='public'), and
 *  mail the Support Inbox sorted as a lead. Nothing here is AI-scored:
 *  temperature is a plain rule on how fresh and how unanswered a lead is,
 *  and the screen says so. */
export type LeadSource = 'Website form' | 'Audit form' | 'Inbound email' | 'Instagram' | 'TikTok' | 'Referral' | 'Google' | 'Other';
export type Temperature = 'hot' | 'warm' | 'cold';
export interface FeedLead {
  id: string; kind: 'inbound' | 'audit' | 'mail'; rawId: string;
  name: string; business: string | null; source: LeadSource; detail: string | null;
  email: string | null; phone: string | null; message: string | null;
  at: string; repliedAt: string | null; inCrm: boolean; status: string;
}

const INBOUND_SRC: Record<string, LeadSource> = { website: 'Website form', ig_dm: 'Instagram', tiktok: 'TikTok', referral: 'Referral', google: 'Google', other: 'Other' };
export const HOT_MIN = 120;
export const URGENT_WAIT_MIN = 60;

/** Waiting = no reply yet and not closed out. Minutes, or null. */
export function waitingMin(l: Pick<FeedLead, 'repliedAt' | 'at' | 'status'>, now = Date.now()): number | null {
  if (l.repliedAt || ['client', 'lost', 'dismissed', 'replied', 'conversation', 'meeting'].includes(l.status)) return null;
  return Math.max(0, Math.floor((now - new Date(l.at).getTime()) / 60000));
}
/** Hot: in the last 2 hours and still waiting. Warm: this week. Cold: older. */
export function temperature(l: Pick<FeedLead, 'repliedAt' | 'at' | 'status'>, now = Date.now()): Temperature {
  const age = (now - new Date(l.at).getTime()) / 60000;
  if (age <= HOT_MIN && waitingMin(l, now) != null) return 'hot';
  return age <= 7 * 1440 ? 'warm' : 'cold';
}
export function fmtAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}
export function fmtWait(m: number): string { return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${Math.floor(m / 1440)} d`; }

interface InboundRow { id: string; name: string | null; email: string | null; phone: string | null; source: string; source_detail: string | null; message: string | null; notes: string | null; first_touch_at: string; responded_at: string | null; status: string; contact_id: string | null }
interface AuditRow { id: string; business_name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; stage: string; created_at: string }
interface MailRow { id: string; from_email: string; subject: string | null; body_text: string | null; status: string; created_at: string }

export function useLeadFeed(enabled = true) {
  const [leads, setLeads] = useState<FeedLead[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    const since = new Date(Date.now() - 60 * 86400000).toISOString();
    const [inb, aud, mail] = await Promise.all([
      supabase.from('mkt_inbound').select('id,name,email,phone,source,source_detail,message,notes,first_touch_at,responded_at,status,contact_id').gte('first_touch_at', since).order('first_touch_at', { ascending: false }).limit(200),
      supabase.from('crm_clients').select('id,business_name,contact_name,contact_email,contact_phone,stage,created_at').eq('source', 'public').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      supabase.from('support_inbox').select('id,from_email,subject,body_text,status,created_at').eq('category', 'lead').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
    ]);
    const out: FeedLead[] = [];
    for (const r of (inb.data ?? []) as InboundRow[]) out.push({ id: `in-${r.id}`, kind: 'inbound', rawId: r.id, name: r.name || r.email || r.phone || 'Lead', business: null, source: INBOUND_SRC[r.source] ?? 'Other', detail: r.source_detail, email: r.email, phone: r.phone, message: r.message ?? r.notes, at: r.first_touch_at, repliedAt: r.responded_at, inCrm: !!r.contact_id, status: r.status });
    for (const r of (aud.data ?? []) as AuditRow[]) out.push({ id: `au-${r.id}`, kind: 'audit', rawId: r.id, name: r.contact_name || r.business_name, business: r.contact_name ? r.business_name : null, source: 'Audit form', detail: null, email: r.contact_email, phone: r.contact_phone, message: null, at: r.created_at, repliedAt: null, inCrm: r.stage !== 'new_lead', status: r.stage === 'new_lead' ? 'new' : 'client' });
    for (const r of (mail.data ?? []) as MailRow[]) out.push({ id: `ml-${r.id}`, kind: 'mail', rawId: r.id, name: r.from_email.split('@')[0], business: r.from_email.split('@')[1] ?? null, source: 'Inbound email', detail: r.subject, email: r.from_email, phone: null, message: r.body_text, at: r.created_at, repliedAt: null, inCrm: false, status: r.status === 'new' ? 'new' : r.status === 'archived' ? 'dismissed' : 'replied' });
    out.sort((a, b) => b.at.localeCompare(a.at));
    setLeads(out);
    setLoading(false);
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel(`leadfeed-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mkt_inbound' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [enabled, load]);

  const stats = useMemo(() => {
    const waiting = leads.filter((l) => waitingMin(l, now) != null);
    return { waiting: waiting.length, urgent: waiting.filter((l) => (waitingMin(l, now) ?? 0) >= URGENT_WAIT_MIN && (now - new Date(l.at).getTime()) < 3 * 86400000).length };
  }, [leads, now]);
  return { leads, loading, now, reload: load, ...stats };
}
