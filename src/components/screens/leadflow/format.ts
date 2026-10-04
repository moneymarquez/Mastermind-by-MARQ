import type { LeadflowLead } from '../../../data/useLeadflow';
import { isTouched, hasOwnerContact } from './leadLinks';
import { LEAD_OUTCOME_LABEL } from './leadOutcomes';

/** The five signals every colored mark in LeadFlow maps onto. */
export type Signal = 'go' | 'wait' | 'stop' | 'info' | 'neu';

/** "(801) 555-0142" for a 10-digit US number (or 11 with a leading 1);
 *  anything else is shown as stored rather than mangled. */
export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (n.length !== 10) return raw.trim();
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}
export const telHref = (raw: string) => `tel:${raw.replace(/[^\d+]/g, '')}`;

/** industry/category arrive as snake_case ("nail_salon"): show "Nail salon". */
export function fmtIndustry(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Keep acronyms the data already capitalises (HVAC).
  const words = s.split(' ').map((w, i) => (/^[A-Z0-9]{2,}$/.test(w) ? w : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()));
  return words.join(' ');
}
export const leadCategory = (l: Pick<LeadflowLead, 'category' | 'industry'>) => fmtIndustry(l.category || l.industry);

const TAG_SIG: Record<string, Signal> = { hot: 'go', warm: 'wait', 'not ready': 'neu', cold: 'neu' };
/** Hot = Go, Warm = Wait, Not ready = Neutral. Case-insensitive: older rows vary. */
export const tagSignal = (t: string | null | undefined): Signal => TAG_SIG[(t ?? '').trim().toLowerCase()] ?? 'neu';
export const TIER_SIGNAL: Record<string, Signal> = { A: 'go', B: 'wait', C: 'neu' };
export const OUTCOME_SIGNAL: Record<string, Signal> = {
  no_answer: 'neu', voicemail: 'neu', gatekeeper: 'wait', callback: 'info', interested: 'go', not_interested: 'stop',
};
/** "Not Ready" is the stored value; sentence case on screen. */
export const tagLabel = (t: string) => { const s = t.trim().toLowerCase(); return s === 'cold' ? 'Not ready' : s.charAt(0).toUpperCase() + s.slice(1); };

/** Go time / Recycled, with the last outcome when there is one. */
export function statusOf(l: LeadflowLead): { label: string; short: string; s: Signal } {
  if (!isTouched(l)) return { label: 'Go time', short: 'Go time', s: 'go' };
  const out = l.status && l.status !== 'new' ? LEAD_OUTCOME_LABEL[l.status] ?? l.status : '';
  return { label: out ? `Recycled · ${out}` : 'Recycled', short: 'Recycled', s: 'info' };
}

/** Whether the lead has a site, when we know either way. */
export function websiteSignal(l: Pick<LeadflowLead, 'website' | 'website_status'>): { label: string; s: Signal } | null {
  if (l.website) return { label: 'Has website', s: 'neu' };
  if (l.website_status === 'no_website') return { label: 'No website', s: 'wait' };
  if (l.website_status) return { label: 'Has website', s: 'neu' };
  return null;
}

/** Every signal tag the record header shows, in reading order. */
export function leadTags(l: LeadflowLead): { label: string; s: Signal; title?: string }[] {
  const out: { label: string; s: Signal; title?: string }[] = [];
  const st = statusOf(l);
  out.push({ label: st.label, s: st.s });
  if (hasOwnerContact(l)) out.push({ label: 'Owner on file', s: 'info', title: l.owner_phone ?? undefined });
  if (l.flagged) out.push({ label: 'Flagged', s: 'wait', title: l.flag_note ?? undefined });
  if (l.dialing_queued) out.push({ label: 'In Dialing', s: 'info' });
  if (l.is_chain) out.push({ label: l.chain_name ? `Chain · ${l.chain_name}` : 'Chain', s: 'stop', title: l.filter_note ?? undefined });
  else if (l.duplicate_of) out.push({ label: 'Duplicate', s: 'wait', title: l.filter_note ?? undefined });
  else if (l.business_size === 'multi') out.push({ label: 'Multi-location', s: 'neu', title: l.filter_note ?? undefined });
  const w = websiteSignal(l);
  if (w) out.push(w);
  return out;
}

export function cityState(l: Pick<LeadflowLead, 'city' | 'state'>): string {
  return [l.city, l.state].filter(Boolean).join(', ');
}

/** "2h ago" / "Yesterday" / "2 Oct" for table dates. */
export function fmtAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.round((now - t) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "1y ago" / "3mo ago" / "2w ago" for the Last review column. */
export function fmtReviewAge(days: number | null | undefined): string {
  if (days == null) return '';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
