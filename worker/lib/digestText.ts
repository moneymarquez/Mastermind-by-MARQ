// Morning Digest — the pure parts: formatting, ranking the #1 priority,
// the length rule, reply parsing, and Twilio's webhook signature. No
// network, so it's unit-tested in isolation.

export type Desk = 'ecom' | 'mbm' | 'mm' | 'content' | 'marketing';
export const DESKS: { id: Desk; code: string; label: string }[] = [
  { id: 'mbm', code: 'MBM', label: 'Made by Marq' },
  { id: 'mm', code: 'MM', label: 'Mastermind' },
  { id: 'ecom', code: 'ECOM', label: 'E-Com' },
  { id: 'content', code: 'CONT', label: 'Content' },
  { id: 'marketing', code: 'MKT', label: 'Marketing' },
];
export const MAX_SMS = 600;

export interface DeskReport {
  desk: Desk;
  /** One line for the master text: numbers, not activity. */
  line: string;
  /** The full report a reply of the desk code returns. */
  full: string;
  setUp: boolean;
  /** Candidates for today's #1, highest weight wins. */
  urgent?: { weight: number; text: string }[];
}
export interface ScheduleItem { start: string; end: string | null; label: string }
export interface DigestInput {
  dateLabel: string;
  schedule: ScheduleItem[];
  yesterday: { dials: number; dialTarget: number | null; inbound: number; posts: number; grades: number[] };
  desks: DeskReport[];
  cash: { week: number; target: number | null };
  name?: string;
}

/** "16:00" → "4:00"; minutes dropped only when the reader can't lose anything. */
export function clock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m ?? 0).padStart(2, '0')}`;
}
export function scheduleLines(items: ScheduleItem[]): string[] {
  return [...items].sort((a, b) => a.start.localeCompare(b.start)).map((b) => `${clock(b.start)}${b.end ? `–${clock(b.end)}` : ''}  ${b.label}`);
}
export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** The #1 priority: the single heaviest urgent item across all desks.
 *  Money and people waiting outrank everything (build rule: "money and
 *  approvals waiting go first"). */
export function topPriority(desks: DeskReport[], y: DigestInput['yesterday']): string | null {
  const all = desks.flatMap((d) => d.urgent ?? []);
  if (y.dialTarget && y.dials < y.dialTarget * 0.6) all.push({ weight: 40, text: `Hit ${y.dialTarget} dials today — yesterday was ${y.dials}` });
  all.sort((a, b) => b.weight - a.weight);
  return all[0]?.text ?? null;
}

/** The deterministic master text. It is complete on its own — the model
 *  pass only reorders and tightens it — so a failed Claude call still
 *  sends a correct digest. */
export function composeDraft(d: DigestInput): string {
  const lines: string[] = [];
  lines.push(`MORNING${d.name ? `, ${d.name.toUpperCase()}` : ''} — ${d.dateLabel}`);
  const sched = scheduleLines(d.schedule);
  lines.push(...(sched.length ? sched : ['No schedule set — add blocks in Settings']));
  const y = d.yesterday;
  const yParts = [`${y.dials}${y.dialTarget ? `/${y.dialTarget}` : ''} dials`, `${y.inbound} inbound`, `${y.posts} post${y.posts === 1 ? '' : 's'}${y.grades.length ? ` (grades ${y.grades.join(', ')})` : ''}`];
  lines.push('', `YESTERDAY ${yParts.join(' · ')}`);
  const top = topPriority(d.desks, y);
  if (top) lines.push(`#1 ${top}`);
  lines.push('');
  for (const desk of DESKS) {
    const r = d.desks.find((x) => x.desk === desk.id);
    if (!r) continue;
    lines.push(`${desk.code.padEnd(5)} ${r.setUp ? r.line : 'not set up'}`);
  }
  if (d.cash.target) lines.push('', `CASH THIS WEEK ${money(d.cash.week)} / ${money(d.cash.target)}`);
  else if (d.cash.week) lines.push('', `CASH THIS WEEK ${money(d.cash.week)}`);
  lines.push(`Reply ${DESKS.map((x) => x.code).join(' ')} for full reports`);
  return fitSms(lines.join('\n'));
}

/** Enforce the 600-character rule by dropping the least important lines
 *  first (desks that aren't set up, then the reply hint), never the
 *  schedule, yesterday or #1. Truncates as a last resort. */
export function fitSms(text: string, max = MAX_SMS): string {
  if (text.length <= max) return text;
  let lines = text.split('\n');
  lines = lines.filter((l) => !/ not set up$/.test(l));
  if (lines.join('\n').length > max) lines = lines.filter((l) => !l.startsWith('Reply '));
  let out = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  if (out.length > max) out = out.slice(0, max - 1) + '…';
  return out;
}

export type ReplyCommand =
  | { kind: 'desk'; desk: Desk }
  | { kind: 'log'; field: 'dials' | 'conversations' | 'meetings' | 'inbound_leads' | 'posts' | 'cash_in'; value: number }
  | { kind: 'done' }
  | { kind: 'help' };
const LOG_WORDS: Record<string, 'dials' | 'conversations' | 'meetings' | 'inbound_leads' | 'posts' | 'cash_in'> = {
  dials: 'dials', dial: 'dials', calls: 'dials', convos: 'conversations', conversations: 'conversations', conversation: 'conversations',
  meetings: 'meetings', meeting: 'meetings', inbound: 'inbound_leads', leads: 'inbound_leads', posts: 'posts', post: 'posts', cash: 'cash_in',
};
export function parseReply(body: string): ReplyCommand {
  const t = body.trim().toLowerCase().replace(/[.!]+$/, '');
  const code = t.toUpperCase();
  const desk = DESKS.find((d) => d.code === code || d.id.toUpperCase() === code || (d.id === 'content' && code === 'CONTENT'));
  if (desk) return { kind: 'desk', desk: desk.id };
  if (t === 'done' || t === 'did it' || t === '#1 done') return { kind: 'done' };
  const m = t.match(/^([a-z]+)\s+\$?(-?[\d,]+(?:\.\d+)?)$/);
  if (m && LOG_WORDS[m[1]]) return { kind: 'log', field: LOG_WORDS[m[1]], value: Number(m[2].replace(/,/g, '')) };
  return { kind: 'help' };
}
export const HELP_TEXT = 'Reply ECOM, MBM, MM, CONT or MKT for a full report. Log with "dials 30", "cash 550", "inbound 1", "posts 2". "done" marks today\'s #1 complete.';

/** Twilio's X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + sorted
 *  key+value pairs of the POST params)). */
export async function twilioSignature(url: string, params: Record<string, string>, authToken: string): Promise<string> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function twiml(message: string): string {
  const esc = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${esc}</Message></Response>`;
}

/** Grades out of 4 against a 30-day view average (same rule as the Content Engine). */
export function grade(views: number | null | undefined, avg: number | null): number | null {
  if (views == null || avg == null || avg <= 0) return null;
  const r = views / avg;
  return r >= 2 ? 4 : r > 1 ? 3 : r >= 0.5 ? 2 : 1;
}
