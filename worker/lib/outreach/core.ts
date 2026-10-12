// Outreach rules that need no network: the cold email, warm-up caps, bounce guard, reply routing, call-list timing, DNS checks.

export interface OutreachLead { business_name: string; owner_name?: string | null; city?: string | null; category?: string | null }
export interface FindingLite { kind: string; summary: string; evidence?: Record<string, unknown> }

/** The finding as a short, specific observation and one yes/no question. Text only: no link, video, preview or payment. */
const OBSERVE: Record<string, (l: OutreachLead, f: FindingLite) => { line: string; ask: string }> = {
  no_website: (l) => ({ line: `I looked for ${l.business_name} online and couldn't find a website of your own, only listings.`, ask: 'Would a simple site where people can find your hours and call or book you be useful?' }),
  site_down: (l) => ({ line: `When I tried to open the ${l.business_name} website it didn't load.`, ask: 'Is that something you already know about?' }),
  no_https: (l) => ({ line: `The ${l.business_name} website shows a "Not secure" warning in browsers.`, ask: 'Would you like that fixed?' }),
  no_mobile: (l) => ({ line: `On a phone, the ${l.business_name} website shows up tiny because it has no mobile layout.`, ask: 'Is getting it to work on phones something you want sorted?' }),
  slow_mobile: (l, f) => ({ line: `The ${l.business_name} website scores ${(f.evidence?.pagespeed_mobile as number | undefined) ?? 'low'}/100 for speed on phones, so people may leave before it loads.`, ask: 'Would you want it faster?' }),
  stale_site: (l, f) => ({ line: `The ${l.business_name} website still says © ${(f.evidence?.copyright_year as number | undefined) ?? 'a few years ago'}, so it looks like nobody's updating it.`, ask: 'Would a refresh be useful?' }),
  no_cta: (l) => ({ line: `The ${l.business_name} website has no clear button to call, order or book.`, ask: 'Would you want one added?' }),
};
export function draftColdEmail(lead: OutreachLead, finding: FindingLite, sender = 'Marq'): { subject: string; body: string } {
  const o = (OBSERVE[finding.kind] ?? ((_l: OutreachLead, f: FindingLite) => ({ line: f.summary, ask: 'Is that something you want help with?' })))(lead, finding);
  const hi = lead.owner_name ? `Hi ${lead.owner_name.split(' ')[0]},` : 'Hi,';
  return {
    subject: `Quick question about ${lead.business_name}`,
    body: `${hi}\n\n${o.line}\n\n${o.ask} A one-word yes or no is fine.\n\n${sender}\nMade by Marq\n\nIf you'd rather not hear from me, reply "stop" and I won't write again.`,
  };
}
export const TEST_TAG = '[TEST]';
export const testSubject = (s: string) => (s.startsWith(TEST_TAG) ? s : `${TEST_TAG} ${s}`);

/** Warm-up: week 1 = 10/day, week 2 = 20/day, then 30/day. Day 1 is the start date. Pure. */
export function dailyCap(warmupStart: string | null, today: string): number {
  if (!warmupStart) return 0;
  const day = Math.floor((Date.parse(today) - Date.parse(warmupStart)) / 86400000) + 1;
  if (day < 1) return 0;
  return day <= 7 ? 10 : day <= 14 ? 20 : 30;
}
export const warmupDay = (warmupStart: string | null, today: string) => (warmupStart ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(warmupStart)) / 86400000) + 1) : 0);
/** Auto-pause: any spam complaint, or more than 5% bounced once at least 20 have gone out. Pure. */
export function shouldPause(sent: number, bounced: number, complaints: number): string | null {
  if (complaints > 0) return 'A recipient marked an email as spam.';
  if (sent >= 20 && bounced / sent > 0.05) return `${Math.round((bounced / sent) * 100)}% of emails bounced (the limit is 5%).`;
  return null;
}

// ── Replies ──────────────────────────────────────────────────────────
export type ReplyClass = 'interested' | 'question' | 'not_now' | 'not_interested' | 'stop' | 'out_of_office' | 'wrong_person' | 'unclear';
export const CLASSES: ReplyClass[] = ['interested', 'question', 'not_now', 'not_interested', 'stop', 'out_of_office', 'wrong_person', 'unclear'];
export const MIN_CONFIDENCE = 0.8;
const STOP = /\b(stop|unsubscribe|remove me|take me off|do not (contact|email)|don'?t (contact|email)|leave me alone|spam|reported|lawyer|harass\w*)\b|\bf+u+c+k\b/i;
/** Hard stop words are caught before any AI sees the message. Pure. */
export const looksLikeStop = (text: string) => STOP.test(text);

export interface Classified { classification: ReplyClass; confidence: number; return_date?: string | null; referral?: string | null; summary?: string }
export function parseClassification(raw: unknown): Classified {
  const o = (raw ?? {}) as Record<string, unknown>;
  const c = String(o.classification ?? '').toLowerCase().replace(/[\s/-]+/g, '_');
  const cls: ReplyClass = c === 'stop_hostile' ? 'stop' : (CLASSES as string[]).includes(c) ? (c as ReplyClass) : 'unclear';
  const conf = Math.min(1, Math.max(0, Number(o.confidence) || 0));
  const date = typeof o.return_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.return_date) ? o.return_date : null;
  return { classification: cls, confidence: cls === 'unclear' ? Math.min(conf, 0.5) : conf, return_date: date, referral: typeof o.referral === 'string' && o.referral.trim() ? o.referral.trim().slice(0, 300) : null, summary: typeof o.summary === 'string' ? o.summary.slice(0, 200) : undefined };
}

export type ReplyAction = 'send_booking_link' | 'draft_answer' | 'check_in' | 'thank_and_close' | 'do_not_contact' | 'wait_for_return' | 'save_referral' | 'needs_read';
export interface Routed { action: ReplyAction; state: 'pending' | 'done' | 'needs_read' | 'draft_ready'; closes: boolean; sendsAutomatically: boolean; nextDate: string | null; note: string }
const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

/** What happens after a reply. Only "interested" sends anything by itself (the booking link); everything else drafts for one tap, waits, or closes. Under 80% confidence nothing happens and it lands in "Needs your read". Pure. */
export function routeReply(c: Classified, today: string, warm = false): Routed {
  const unsure: Routed = { action: 'needs_read', state: 'needs_read', closes: false, sendsAutomatically: false, nextDate: null, note: 'Not sure enough to act. Needs your read.' };
  // A hard stop is honoured at any confidence.
  if (c.classification === 'stop') return { action: 'do_not_contact', state: 'done', closes: true, sendsAutomatically: false, nextDate: null, note: 'Added to do-not-contact. No reply sent.' };
  if (c.confidence < MIN_CONFIDENCE || c.classification === 'unclear') return unsure;
  switch (c.classification) {
    case 'interested': return { action: 'send_booking_link', state: 'done', closes: false, sendsAutomatically: true, nextDate: null, note: 'Booking link sent.' };
    case 'question': return { action: 'draft_answer', state: 'draft_ready', closes: false, sendsAutomatically: false, nextDate: null, note: warm ? 'Answer drafted with the booking link. One tap to send.' : 'Answer drafted. One tap to send.' };
    case 'not_now': { const d = c.return_date && c.return_date > today ? c.return_date : addDays(today, 60); return { action: 'check_in', state: 'pending', closes: false, sendsAutomatically: false, nextDate: d, note: `Check-in set for ${d}.` }; }
    case 'not_interested': return { action: 'thank_and_close', state: 'draft_ready', closes: true, sendsAutomatically: false, nextDate: null, note: 'Polite thank-you drafted for your approval, then closed.' };
    case 'out_of_office': { const d = c.return_date && c.return_date >= today ? addDays(c.return_date, 1) : addDays(today, 7); return { action: 'wait_for_return', state: 'pending', closes: false, sendsAutomatically: false, nextDate: d, note: `Will try again ${d}.` }; }
    case 'wrong_person': return { action: 'save_referral', state: 'done', closes: false, sendsAutomatically: false, nextDate: null, note: c.referral ? `Referral saved: ${c.referral}` : 'They pointed us to someone else.' };
    default: return unsure;
  }
}

// ── Call list timing ────────────────────────────────────────────────
/** One business day after the send (Mon–Fri; a Friday email is due Monday). Returns the YYYY-MM-DD it becomes due. Pure. */
export function callDueDate(sentDate: string): string {
  let d = Date.parse(sentDate);
  do { d += 86400000; } while ([0, 6].includes(new Date(d).getUTCDay()));
  return new Date(d).toISOString().slice(0, 10);
}
export function callScript(l: { business_name: string; owner_name?: string | null }, finding: string): string {
  return `"Hi, is this ${l.owner_name ?? 'the owner'}? It's Marq with Made by Marq. I sent you a quick note about ${l.business_name}: ${finding} Is that something you'd want help with? If it's easier I can text you a link to grab a 15-minute slot."`;
}
export const AFTER_CALL_TEXT = (business: string, link: string) => `Hi, it's Marq from Made by Marq. Great talking about ${business}. Quick recap of what we covered is above; if you want to pick it up, you can grab a 15-minute slot here: ${link} Reply STOP to opt out.`;

// ── DNS (SPF / DKIM / DMARC) ────────────────────────────────────────
export const dkimSelectors = (provider: string | null) => (provider === 'zoho' ? ['zmail', 'zoho'] : ['google', 'default', 'selector1', 'selector2']);
export function checkSpf(txt: string[], provider: string | null): { ok: boolean; detail: string } {
  const spf = txt.map((t) => t.replace(/"/g, '')).find((t) => /^v=spf1\b/i.test(t));
  if (!spf) return { ok: false, detail: 'No SPF record found.' };
  const want = provider === 'zoho' ? 'zoho' : 'google';
  return /(~all|-all)/.test(spf) && (provider ? spf.includes(want) : true) ? { ok: true, detail: spf } : { ok: false, detail: `SPF exists but ${/(~all|-all)/.test(spf) ? `doesn't include ${want}` : 'has no ~all/-all ending'}: ${spf}` };
}
export function checkDmarc(txt: string[]): { ok: boolean; detail: string } {
  const d = txt.map((t) => t.replace(/"/g, '')).find((t) => /^v=DMARC1/i.test(t));
  if (!d) return { ok: false, detail: 'No DMARC record found.' };
  return /p=(none|quarantine|reject)/i.test(d) ? { ok: true, detail: d } : { ok: false, detail: `DMARC has no policy: ${d}` };
}
export const checkDkim = (txt: string[]) => { const d = txt.map((t) => t.replace(/"/g, '')).find((t) => /v=DKIM1|k=rsa|p=[A-Za-z0-9+/]{20,}/i.test(t)); return d ? { ok: true, detail: 'DKIM key found.' } : { ok: false, detail: 'No DKIM key found.' }; };
