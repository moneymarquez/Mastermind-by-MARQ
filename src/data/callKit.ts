// The cold-call kit (Masterminds Growth Blueprint, phase 1, Oct 30 2026).
// Combines the pieces that already exist (the website-gap checker's
// lead_findings, the fizzle review score on every lead, the Complaint
// Scanner's clusters and the call list) into one thing per lead:
//   - an ESTIMATED monthly $ leak, always shown with the inputs behind it
//   - a one-line call opener
//   - the best person to ask for, when the lead says who that is
// and ranks them into one call list. Pure: no network, no env, no sends.
// Used by the Worker (8 AM snapshot, /api/leadflow/call-kit) and the app
// (LeadFlow → Call list). Tested in tests/call-kit.test.ts.

export interface CallKitLead {
  id: string;
  business_name: string;
  phone: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_is_agent_only?: boolean | null;
  registry_legal_name?: string | null;
  category?: string | null;
  search_category?: string | null;
  industry?: string | null;
  city?: string | null;
  rating?: number | null;
  review_count?: number | null;
  days_since_last_review?: number | null;
  fizzle_score?: number | null;
  tier?: string | null;
  fizzle_reasons?: string[] | null;
  website?: string | null;
  status?: string | null;
  last_called_at?: string | null;
  call_count?: number | null;
  next_followup_at?: string | null;
  dialing_queued?: boolean | null;
  call_notes?: string | null;
  place_id?: string | null;
}
/** A website-gap finding (lead_findings.kind / summary). */
export interface CallKitGap { kind: string; text: string }
/** A Complaint Scanner cluster (complaint_clusters.industry / title). */
export interface CallKitCluster { industry: string | null; title: string }

/** Rough economics per kind of business. Every number is an assumption,
 *  shown next to the estimate it feeds, never presented as their data. */
export interface Profile { key: string; label: string; ticket: number; perReview: number; bestTime: string }
const PROFILES: (Profile & { match: RegExp })[] = [
  { key: 'restaurant', label: 'Restaurant', ticket: 24, perReview: 120, bestTime: '2–4 PM, between lunch and dinner', match: /restaurant|bbq|barbecue|smokehouse|pizza|diner|mexican|taco|grill|burger|sushi|thai|chinese|italian|catering|food truck|bar\b|brew|pub|wings/ },
  { key: 'cafe', label: 'Cafe or bakery', ticket: 11, perReview: 80, bestTime: '1–3 PM, after the morning rush', match: /cafe|coffee|bakery|donut|ice cream|dessert|juice|smoothie/ },
  { key: 'medspa', label: 'Med spa', ticket: 280, perReview: 15, bestTime: '10–11 AM', match: /med ?spa|medical spa|aesthetic|botox/ },
  { key: 'salon', label: 'Salon or barber', ticket: 45, perReview: 25, bestTime: '10–11 AM, before chairs fill', match: /salon|barber|nail|lash|brow|spa\b|day spa|tanning|tattoo|massage|beauty/ },
  { key: 'fitness', label: 'Gym or studio', ticket: 70, perReview: 15, bestTime: '10 AM–2 PM, between classes', match: /gym|fitness|yoga|pilates|crossfit|martial|boxing|mma|dance|trainer|jiu/ },
  { key: 'auto', label: 'Auto shop', ticket: 380, perReview: 12, bestTime: '9–11 AM or after 3 PM', match: /auto|car |mechanic|tire|body shop|detail|tint|wrap|towing|collision|oil change/ },
  { key: 'bigjob', label: 'Roofing or remodeling', ticket: 7500, perReview: 4, bestTime: '7–8 AM or after 5 PM', match: /roof|remodel|kitchen|bath|solar|siding|concrete|foundation|addition/ },
  { key: 'home', label: 'Home services', ticket: 420, perReview: 6, bestTime: '7–8 AM or after 5 PM, before or after jobs', match: /hvac|heating|air cond|furnace|plumb|drain|electric|landscap|lawn|tree|pest|exterminat|garage door|fenc|floor|paint|pressure|window|junk|moving|mover|clean|maid|carpet|handyman|appliance|locksmith|contractor|pool/ },
  { key: 'health', label: 'Clinic', ticket: 220, perReview: 15, bestTime: '12–1 PM, at lunch', match: /dent|chiro|physical therap|optom|vet|clinic|hearing|ortho/ },
  { key: 'pets', label: 'Pet business', ticket: 75, perReview: 15, bestTime: '1–3 PM', match: /pet|groom|dog|kennel|boarding/ },
  { key: 'retail', label: 'Shop', ticket: 55, perReview: 30, bestTime: '10–11 AM, at opening', match: /boutique|retail|jewel|florist|flower|gift|thrift|vintage|sneaker|furniture|bike|liquor|smoke|vape|store|shop/ },
];
const DEFAULT_PROFILE: Profile = { key: 'default', label: 'Local business', ticket: 90, perReview: 20, bestTime: '10–11 AM or 2–4 PM' };

export function profileFor(lead: Pick<CallKitLead, 'category' | 'search_category' | 'industry'>): Profile {
  const text = [lead.search_category, lead.category, lead.industry].filter(Boolean).join(' ').toLowerCase().replace(/_/g, ' ');
  const p = PROFILES.find((x) => x.match.test(text));
  if (!p) return DEFAULT_PROFILE;
  const { match: _m, ...rest } = p; void _m;
  return rest;
}

/** Reviews are assumed to have built up over about five years. */
export const ASSUMED_REVIEW_MONTHS = 60;
/** Share of monthly revenue each website gap is assumed to cost. */
export const GAP_SHARE: Record<string, number> = { site_down: 0.08, no_website: 0.06, no_mobile: 0.04, slow_mobile: 0.03, no_cta: 0.03, no_https: 0.02, stale_site: 0.01 };
const GAP_CAP = 0.1, TOTAL_CAP = 0.25;
/** Share of monthly revenue a review falloff is assumed to cost. */
export function falloffShare(days: number | null | undefined): number {
  if (days == null) return 0;
  return days >= 365 ? 0.15 : days >= 150 ? 0.1 : days >= 60 ? 0.05 : 0;
}

export interface LeakPart { kind: string; label: string; share: number; monthly: number }
export interface LeakEstimate {
  /** Always an estimate: the inputs below are public data plus assumptions. */
  estimate: true;
  monthly: number; low: number; high: number;
  revenue: number; customers: number;
  parts: LeakPart[];
  inputs: { label: string; value: string }[];
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const GAP_LABEL: Record<string, string> = { site_down: "Website doesn't load", no_website: 'No website of their own', no_mobile: 'No phone layout', slow_mobile: 'Slow on phones', no_cta: 'No call, order or book button', no_https: 'Not secure (no https)', stale_site: 'Website looks out of date' };

/** The estimated monthly $ leak: revenue implied by review volume × category
 *  ticket, times the share each problem is assumed to cost. Null when there
 *  isn't enough to estimate from (no review count). Pure. */
export function estimateLeak(lead: CallKitLead, gaps: CallKitGap[] = []): LeakEstimate | null {
  const n = Number(lead.review_count ?? 0);
  if (!n || n < 5) return null;
  const p = profileFor(lead);
  const customers = Math.round((n / ASSUMED_REVIEW_MONTHS) * p.perReview);
  const revenue = customers * p.ticket;
  const parts: LeakPart[] = [];
  const days = lead.days_since_last_review ?? null;
  const fs = falloffShare(days);
  if (fs) parts.push({ kind: 'falloff', label: `No new reviews in ${days} days`, share: fs, monthly: revenue * fs });
  const kinds = [...new Set(gaps.map((g) => g.kind).filter((k) => GAP_SHARE[k]))];
  if (!kinds.length && !hasOwnSite(lead.website)) kinds.push('no_website');
  let gapLeft = GAP_CAP;
  for (const k of kinds.sort((a, b) => GAP_SHARE[b] - GAP_SHARE[a])) {
    const share = Math.min(GAP_SHARE[k], gapLeft);
    if (share <= 0) break;
    gapLeft -= share;
    parts.push({ kind: k, label: GAP_LABEL[k] ?? k, share, monthly: revenue * share });
  }
  const rating = lead.rating ?? null;
  if (rating != null && rating < 4) parts.push({ kind: 'rating', label: `Rating ${rating} loses clicks to nearby competitors`, share: 0.04, monthly: revenue * 0.04 });
  if (!parts.length) return null;
  let share = parts.reduce((s, x) => s + x.share, 0);
  if (share > TOTAL_CAP) { const k = TOTAL_CAP / share; for (const x of parts) { x.share *= k; x.monthly *= k; } share = TOTAL_CAP; }
  const raw = revenue * share;
  const step = raw >= 2000 ? 100 : 50;
  const monthly = Math.max(step, roundTo(raw, step));
  for (const x of parts) x.monthly = Math.round(x.monthly);
  return {
    estimate: true, monthly, low: Math.max(step, roundTo(raw * 0.6, step)), high: roundTo(raw * 1.4, step), revenue, customers, parts,
    inputs: [
      { label: 'Google reviews', value: `${n.toLocaleString('en-US')}${rating != null ? ` at ${rating}★` : ''}` },
      { label: 'Newest review', value: days != null ? `${days} days ago` : 'unknown' },
      { label: 'Type (assumed)', value: `${p.label}: ${usd(p.ticket)} average ticket, about 1 review per ${p.perReview} customers` },
      { label: 'Customers a month (est.)', value: `${customers.toLocaleString('en-US')} (reviews ÷ ${ASSUMED_REVIEW_MONTHS} months × ${p.perReview})` },
      { label: 'Revenue a month (est.)', value: usd(revenue) },
      { label: 'Problems counted', value: parts.map((x) => `${x.label} (${Math.round(x.share * 100)}%)`).join('; ') },
    ],
  };
}

const SOCIAL_ONLY = /(facebook|instagram|yelp|linktr\.ee|tiktok|google)\.[a-z]+/i;
const hasOwnSite = (w: string | null | undefined) => !!w && w.trim().length > 3 && !SOCIAL_ONLY.test(w);

export interface BestPerson { name: string; role: string; why: string; direct: string | null }
const firstName = (s: string) => s.trim().split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '');

/** Who to ask for: the owner on file (unless the registry only shows a
 *  registered agent), else a name from the call notes ("ask for Kayla").
 *  Null when nothing says who. Pure. */
export function bestPerson(lead: CallKitLead): BestPerson | null {
  const note = (lead.call_notes ?? '').match(/\b[Aa]sk for ([A-Z][a-z]+)/);
  if (note) return { name: note[1], role: 'from your notes', why: 'Your call notes say to ask for them.', direct: lead.owner_phone ?? null };
  const owner = (lead.owner_name ?? '').trim();
  if (owner && !lead.owner_is_agent_only) {
    const fn = firstName(owner);
    if (fn.length >= 2) return { name: fn, role: 'owner', why: `Owner on file: ${owner}${lead.registry_legal_name ? ` (${lead.registry_legal_name})` : ''}.`, direct: lead.owner_phone ?? null };
  }
  return null;
}

/** A complaint cluster from the same industry, as a backup talking point. */
export function clusterFor(lead: CallKitLead, clusters: CallKitCluster[]): CallKitCluster | null {
  const p = profileFor(lead);
  if (p.key === 'default') return null;
  return clusters.find((c) => c.industry && profileFor({ industry: c.industry }).key === p.key) ?? null;
}

/** Openers only say a dollar figure at or above this. */
export const OPENER_MIN_USD = 500;
const months = (d: number) => Math.max(1, Math.round(d / 30));
/** One line to open the call with. Leads with the strongest public fact
 *  (gone quiet, then the worst website gap), then the estimate. Pure. */
export function callOpener(lead: CallKitLead, leak: LeakEstimate | null, gaps: CallKitGap[] = [], person: BestPerson | null = bestPerson(lead)): string {
  const hi = person ? `Hi ${person.name}, this is Marq.` : 'Hi, is the owner in? This is Marq.';
  const n = lead.review_count ?? 0, r = lead.rating, d = lead.days_since_last_review ?? null;
  const top = leak?.parts.find((x) => x.kind !== 'falloff' && x.kind !== 'rating');
  let hook: string;
  if (d != null && d >= 150 && n) hook = `You've got ${n.toLocaleString('en-US')} reviews${r ? ` at ${r} stars` : ''}, but nothing new on Google in ${months(d)} months${top ? `, and ${lower(top.label)}` : ''}.`;
  else if (top) hook = `People find you on Google${n ? ` (${n.toLocaleString('en-US')} reviews)` : ''}, but ${lower(top.label)}.`;
  else if (gaps[0]) hook = gaps[0].text;
  else hook = `I looked you up on Google${n ? ` (${n.toLocaleString('en-US')} reviews)` : ''} and found a couple of quick fixes.`;
  // Under OPENER_MIN_USD a dollar figure weakens the pitch, so it's left to the card.
  const ask = leak && leak.monthly >= OPENER_MIN_USD ? `I think it's costing you around ${usd(leak.monthly)} a month. Can I show you on your phone in five minutes?` : 'Can I show you on your phone in five minutes?';
  return `${hi} ${hook} ${ask}`;
}
const lower = (s: string) => {
  const t = s.replace(/^Website/, 'your website').replace(/^No website/, 'there\'s no website').replace(/^No phone layout/, 'your site has no phone layout')
    .replace(/^Slow on phones/, 'your site is slow on phones').replace(/^No call, order or book button/, 'your site has no call, order or book button').replace(/^Not secure/, 'your site isn\'t secure');
  return t.charAt(0).toLowerCase() + t.slice(1);
};

/** Statuses that never go on the call list: done, dead or do-not-contact. */
export const CALL_LIST_EXCLUDED = new Set(['interested', 'not_interested', 'client', 'dead', 'do_not_contact', 'wrong_number', 'converted']);

export interface CallKit {
  leadId: string; business: string; phone: string | null; city: string | null;
  leak: LeakEstimate | null; opener: string; person: BestPerson | null;
  backup: string | null; bestTime: string; fizzle: number | null; tier: string | null;
  score: number; why: string[]; status: string | null; lastCalledAt: string | null; callCount: number;
}

/** 0–100: fit (fizzle score, else the gap checker's rank) × size of the leak,
 *  plus callbacks due and leads you queued yourself. Pure. */
export function rankScore(lead: CallKitLead, leak: LeakEstimate | null, gapScore: number | null, today: string): { score: number; why: string[] } {
  const why: string[] = [];
  const fit = lead.fizzle_score ?? gapScore ?? 35;
  why.push(lead.fizzle_score != null ? `fizzle ${lead.fizzle_score}` : gapScore != null ? `gap rank ${gapScore}` : 'no fit score yet');
  const size = leak ? Math.min(100, Math.max(0, (Math.log10(Math.max(1, leak.monthly)) - 2) * 40)) : 0;
  if (leak) why.push(`~${usd(leak.monthly)}/mo leak`);
  let s = fit * 0.6 + size * 0.4;
  if (lead.status === 'callback' || (lead.next_followup_at && lead.next_followup_at.slice(0, 10) <= today)) { s += 15; why.push('callback due'); }
  if (lead.dialing_queued) { s += 8; why.push('you queued it'); }
  if (lead.call_count && lead.call_count >= 4) { s -= 15; why.push(`${lead.call_count} tries already`); }
  return { score: Math.max(0, Math.min(100, Math.round(s))), why };
}

/** Everything for one lead. Pure. */
export function callKitFor(lead: CallKitLead, gaps: CallKitGap[] = [], clusters: CallKitCluster[] = [], today = new Date().toISOString().slice(0, 10), gapScore: number | null = null): CallKit {
  const leak = estimateLeak(lead, gaps);
  const person = bestPerson(lead);
  const c = clusterFor(lead, clusters);
  const { score, why } = rankScore(lead, leak, gapScore, today);
  return {
    leadId: lead.id, business: lead.business_name, phone: lead.phone, city: lead.city ?? null,
    leak, opener: callOpener(lead, leak, gaps, person), person,
    backup: c ? `Others in their trade keep complaining about: ${c.title}.` : (gaps[1]?.text ?? null),
    bestTime: profileFor(lead).bestTime, fizzle: lead.fizzle_score ?? null, tier: lead.tier ?? null,
    score, why, status: lead.status ?? null, lastCalledAt: lead.last_called_at ?? null, callCount: lead.call_count ?? 0,
  };
}

/** The ranked call list: callable leads only (a phone, not done or DNC, not
 *  called in the last `restDays`), best first. Pure. */
export function buildCallList(leads: CallKitLead[], gapsByLead: Map<string, CallKitGap[]>, clusters: CallKitCluster[], opts: { today: string; now?: number; limit?: number; restDays?: number; gapScoreByLead?: Map<string, number> }): CallKit[] {
  const now = opts.now ?? Date.now(), rest = (opts.restDays ?? 2) * 86_400_000;
  const seen = new Set<string>();
  const out: CallKit[] = [];
  for (const l of leads) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    if (!l.phone || CALL_LIST_EXCLUDED.has(l.status ?? '')) continue;
    if (l.last_called_at && now - Date.parse(l.last_called_at) < rest && l.status !== 'callback') continue;
    out.push(callKitFor(l, gapsByLead.get(l.id) ?? [], clusters, opts.today, opts.gapScoreByLead?.get(l.id) ?? null));
  }
  return out.sort((a, b) => b.score - a.score || (b.leak?.monthly ?? 0) - (a.leak?.monthly ?? 0)).slice(0, opts.limit ?? 60);
}

/** Columns the call list reads from `leads`. */
export const CALL_KIT_COLUMNS = 'id,place_id,business_name,phone,owner_name,owner_phone,owner_is_agent_only,registry_legal_name,category,search_category,industry,city,rating,review_count,days_since_last_review,fizzle_score,tier,website,status,last_called_at,call_count,next_followup_at,dialing_queued,call_notes';
