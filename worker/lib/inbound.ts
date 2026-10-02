// Marketing Inbound (M3) — the pure half: reading a website form post
// and tagging where a lead came from. No network; tests/inbound.test.ts.
import { extractJson } from './scout';
import { brief } from './workers';
import type { BriefCtx } from './workers';

export const SOURCES = ['website', 'ig_dm', 'tiktok', 'referral', 'google', 'other'] as const;
export type Source = (typeof SOURCES)[number];
export const WAIT_ALERT_MIN = 60;

const s = (v: unknown, max: number): string | null => { const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : ''; return t || null; };

export interface FormLead { name: string | null; phone: string | null; email: string | null; message: string | null; page_url: string | null; referrer: string | null; utm: Record<string, string>; honeypot: boolean }
/** A form post (JSON or urlencoded, already turned into a plain object).
 *  Field names are whatever a website builder sends — the common ones. */
export function parseForm(o: Record<string, unknown>, headers: { referer?: string | null } = {}): FormLead | { error: string } {
  const pick = (...keys: string[]) => { for (const k of keys) { const v = o[k] ?? o[k.toLowerCase()]; if (typeof v === 'string' && v.trim()) return v; } return null; };
  const first = s(pick('first_name', 'firstName', 'fname'), 60), last = s(pick('last_name', 'lastName', 'lname'), 60);
  const name = s(pick('name', 'full_name', 'fullName', 'your-name'), 120) ?? (([first, last].filter(Boolean).join(' ')) || null);
  const email = s(pick('email', 'Email', 'your-email', 'email_address'), 200);
  const phone = s(pick('phone', 'Phone', 'tel', 'phone_number', 'mobile'), 40);
  const message = s(pick('message', 'Message', 'comments', 'details', 'your-message', 'notes', 'project'), 4000);
  const utm: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid']) { const v = s(o[k], 200); if (v) utm[k] = v; }
  // Bots fill every field; people never see this one.
  const honeypot = !!s(pick('website_url', 'company_website', '_gotcha', 'hp'), 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address doesn\'t look right.' };
  if (phone && phone.replace(/\D/g, '').length < 7) return { error: 'That phone number looks too short.' };
  if (!email && !phone) return { error: 'Leave an email or a phone number so we can get back to you.' };
  return { name, email, phone, message, page_url: s(pick('page', 'page_url', 'url'), 500) ?? s(headers.referer, 500), referrer: s(pick('referrer', 'document_referrer'), 500), utm, honeypot };
}

/** Rules first: UTM tags and click ids, then the referring site, then the
 *  words someone typed ("my friend Sam told me"). null = rules can't say. */
export function ruleSource(l: { utm?: Record<string, string> | null; referrer?: string | null; source_detail?: string | null; message?: string | null; notes?: string | null }): { source: Source; detail: string } | null {
  const u = l.utm ?? {};
  const src = (u.utm_source ?? '').toLowerCase();
  if (u.gclid || /google/.test(src)) return { source: 'google', detail: u.gclid ? 'Google Ads click' : `utm_source=${u.utm_source}` };
  if (u.ttclid || /tiktok/.test(src)) return { source: 'tiktok', detail: u.ttclid ? 'TikTok ad click' : `utm_source=${u.utm_source}` };
  if (u.fbclid || /^(ig|instagram|facebook|fb|meta)/.test(src)) return { source: 'ig_dm', detail: `Meta: ${u.utm_source ?? 'fbclid'}` };
  if (/refer/.test(src)) return { source: 'referral', detail: `utm_source=${u.utm_source}` };
  const ref = (l.referrer ?? '').toLowerCase();
  if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(ref)) return { source: 'google', detail: `Search: ${ref.replace(/^https?:\/\//, '').split('/')[0]}` };
  if (/instagram\.|facebook\.|fb\.com|l\.instagram/.test(ref)) return { source: 'ig_dm', detail: `From ${ref.replace(/^https?:\/\//, '').split('/')[0]}` };
  if (/tiktok\./.test(ref)) return { source: 'tiktok', detail: 'From tiktok.com' };
  const text = `${l.source_detail ?? ''} ${l.message ?? ''} ${l.notes ?? ''}`.toLowerCase();
  if (/\b(referr?ed|recommended|friend|told me about|word of mouth)\b/.test(text)) return { source: 'referral', detail: 'Mentions a referral' };
  if (/\b(instagram|insta|\big\b|reel)\b/.test(text)) return { source: 'ig_dm', detail: 'Mentions Instagram' };
  if (/\btiktok\b/.test(text)) return { source: 'tiktok', detail: 'Mentions TikTok' };
  if (/\b(google|searched|search)\b/.test(text)) return { source: 'google', detail: 'Mentions searching' };
  return null;
}

/** Minutes a lead has waited for a first reply (null once answered). */
export function waitingMinutes(l: { first_touch_at: string; responded_at: string | null }, now = Date.now()): number | null {
  return l.responded_at ? null : Math.max(0, Math.floor((now - new Date(l.first_touch_at).getTime()) / 60000));
}
export function responseMinutes(l: { first_touch_at: string; responded_at: string | null }): number | null {
  return l.responded_at ? Math.max(0, Math.round((new Date(l.responded_at).getTime() - new Date(l.first_touch_at).getTime()) / 60000)) : null;
}

// ── Inbound Tracker (AI for what the rules couldn't settle) ───────────
export interface InboundLite { id: string; name: string | null; source: string; source_detail: string | null; message: string | null; notes: string | null; page_url: string | null; utm: Record<string, string> | null; first_touch_at: string }
export interface SourceTag { id: string; name: string | null; source: Source; detail: string; by: 'rule' | 'ai'; was: string }
export function trackerSystem(ctx: BriefCtx): string {
  return brief(
    'You are Inbound Tracker. Each lead below came to the business with no clear source. Decide where it most likely came from.',
    [`Sources: ${SOURCES.join(', ')}. "other" is fine when nothing points anywhere — never guess wildly.`, 'detail: the words or field that decided it, in under 12 words.'],
    ctx,
    '{"tags":[{"id":"","source":"website|ig_dm|tiktok|referral|google|other","detail":""}]}',
  );
}
export function trackerUser(rows: InboundLite[]): string {
  return rows.map((r) => `- [${r.id}] ${r.name ?? 'no name'} · page ${r.page_url ?? '—'} · utm ${JSON.stringify(r.utm ?? {})} · said: ${(r.message ?? r.notes ?? r.source_detail ?? '').slice(0, 300)}`).join('\n');
}
export function mergeTrackerTags(text: string, rows: InboundLite[]): SourceTag[] {
  const by = new Map(rows.map((r) => [r.id, r]));
  let o: { tags?: unknown[] } = {};
  try { o = extractJson(text) as typeof o; } catch { return []; }
  const out: SourceTag[] = [];
  for (const raw of Array.isArray(o.tags) ? o.tags : []) {
    const t = raw as Record<string, unknown>;
    const r = by.get(String(t.id ?? ''));
    const src = String(t.source ?? '').toLowerCase() as Source;
    if (!r || !SOURCES.includes(src) || out.some((x) => x.id === r.id)) continue;
    out.push({ id: r.id, name: r.name, source: src, detail: (typeof t.detail === 'string' ? t.detail : '').slice(0, 120), by: 'ai', was: r.source });
  }
  return out;
}
