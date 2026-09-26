/** Marketing Engine — types and pure rules (08-marketing-engine-spec).
 *
 *  Phase M1: scripts (venture × audience × tone × channel), touches logged
 *  against LeadFlow leads, the win-rate and the call-funnel diagnosis
 *  table from §3. No React, no network. */

export type Venture = 'madebymarq' | 'mastermind' | 'client';
export type Audience = 'single' | 'multi' | 'any';
export type Tone = 'straight' | 'friendly' | 'playful';
export type ScriptChannel = 'call' | 'voicemail' | 'email' | 'dm' | 'landing';
export type TouchChannel = 'call' | 'voicemail' | 'email' | 'dm' | 'social' | 'website';
export type TouchOutcome = 'no_answer' | 'answered' | 'conversation' | 'meeting' | 'closed' | 'not_interested';

export interface Script {
  id: string; venture: Venture; audience: Audience; tone: Tone; channel: ScriptChannel;
  title: string; body: string; principle: string | null; version: number; parent_id: string | null; active: boolean;
  created_at: string; updated_at: string;
}
export interface Touch {
  id: string; campaign_id: string | null; script_id: string | null; contact_id: string | null; contact_name: string | null; contact_phone: string | null;
  channel: TouchChannel; outcome: TouchOutcome; source_status: string | null; notes: string | null; at: string; created_at: string;
}

export const VENTURES: { id: Venture; label: string }[] = [
  { id: 'madebymarq', label: 'Made by Marq' },
  { id: 'mastermind', label: 'Mastermind' },
  { id: 'client', label: 'For a client' },
];
export const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: 'single', label: 'Single location', hint: 'Food truck, one shop, one owner on the line.' },
  { id: 'multi', label: 'Multi-location', hint: 'Five trucks, three shops — an operator, not a cook.' },
];
export const TONES: { id: Tone; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'playful', label: 'Playful' },
];
export const SCRIPT_CHANNELS: { id: ScriptChannel; label: string; icon: string }[] = [
  { id: 'call', label: 'Call opener', icon: '📞' },
  { id: 'voicemail', label: 'Voicemail', icon: '📼' },
  { id: 'email', label: 'Email', icon: '✉️' },
  { id: 'dm', label: 'DM', icon: '💬' },
  { id: 'landing', label: 'Landing copy', icon: '🖥️' },
];

/** The six funnel buckets every touch lands in, in funnel order. */
export const TOUCH_OUTCOMES: { id: TouchOutcome; label: string; color: string; short: string }[] = [
  { id: 'no_answer', label: 'No answer', short: 'No ans.', color: 'var(--text-tertiary)' },
  { id: 'answered', label: 'Answered', short: 'Answered', color: 'var(--accent)' },
  { id: 'conversation', label: 'Conversation', short: 'Convo', color: 'var(--accent-strong)' },
  { id: 'meeting', label: 'Meeting booked', short: 'Meeting', color: 'var(--client-accent)' },
  { id: 'closed', label: 'Closed', short: 'Closed', color: 'var(--success)' },
  { id: 'not_interested', label: 'Not interested', short: 'Not int.', color: 'var(--danger)' },
];
export const OUTCOME_LABEL: Record<TouchOutcome, string> = Object.fromEntries(TOUCH_OUTCOMES.map((o) => [o.id, o.label])) as Record<TouchOutcome, string>;
export const OUTCOME_COLOR: Record<TouchOutcome, string> = Object.fromEntries(TOUCH_OUTCOMES.map((o) => [o.id, o.color])) as Record<TouchOutcome, string>;

/** Spec §4 — scripts quote the package, never a custom number. */
export const PACKAGES: { audience: Audience; name: string; build: string; retainer: string; example: string }[] = [
  { audience: 'single', name: 'Single location', build: '$1,500–2,000', retainer: '$500–600 / mo', example: 'food truck, small shop' },
  { audience: 'multi', name: 'Multi-location', build: '$5,000–6,000', retainer: '$1,000–2,000 / mo', example: 'e.g. 5 trucks' },
];

/** LeadFlow's lead statuses (leadOutcomes.ts) → the six funnel buckets.
 *  Anything that isn't a call result (new, client set by hand…) returns
 *  null and produces no touch. */
export function leadStatusToOutcome(status: string | null | undefined): TouchOutcome | null {
  switch (status) {
    case 'no_answer': case 'voicemail': return 'no_answer';
    case 'gatekeeper': case 'callback': return 'answered';
    case 'interested': return 'conversation';
    case 'not_interested': return 'not_interested';
    case 'client': return 'meeting';
    default: return null;
  }
}

export interface FunnelStats { attempts: number; reached: number; conversations: number; meetings: number; closes: number; notInterested: number; answerRate: number | null; winRate: number | null }
/** Win rate = of the people you reached, how many became a conversation
 *  or better. Reached excludes no-answer. Null under one reach so a
 *  single lucky call never reads as 100%. */
export function funnelStats(touches: Pick<Touch, 'outcome'>[]): FunnelStats {
  const attempts = touches.length;
  const count = (o: TouchOutcome) => touches.filter((t) => t.outcome === o).length;
  const reached = attempts - count('no_answer');
  const conversations = count('conversation'), meetings = count('meeting'), closes = count('closed'), notInterested = count('not_interested');
  const wins = conversations + meetings + closes;
  return {
    attempts, reached, conversations, meetings, closes, notInterested,
    answerRate: attempts ? reached / attempts : null,
    winRate: reached >= 2 ? wins / reached : null,
  };
}

/** §3 "Scoring diagnosis (calls)" — the weakest stage with enough data. */
export function diagnoseCalls(s: FunnelStats): { symptom: string; problem: string } | null {
  if (s.attempts >= 10 && (s.answerRate ?? 0) < 0.2) return { symptom: 'Few answers', problem: 'Wrong call time or wrong numbers' };
  if (s.reached >= 5 && s.conversations + s.meetings + s.closes === 0) return { symptom: 'Answers, no conversation past 30 sec', problem: 'Opener' };
  if (s.conversations >= 5 && s.meetings + s.closes === 0) return { symptom: 'Conversations, no meetings', problem: 'Offer or price framing' };
  if (s.meetings >= 3 && s.closes === 0) return { symptom: 'Meetings, no closes', problem: 'Proof — need a case study (e-comm and Mastermind are yours)' };
  return null;
}

/** {business}, {owner}, {city}, {first} placeholders → the lead in front of you. */
export function fillScript(body: string, lead: { business_name?: string | null; owner_name?: string | null; city?: string | null } | null): string {
  if (!lead) return body;
  const owner = (lead.owner_name ?? '').trim();
  const first = owner.split(/\s+/)[0] || '';
  return body
    .replace(/\{business\}/g, lead.business_name ?? '…')
    .replace(/\{owner\}/g, owner || 'the owner')
    .replace(/\{first\}/g, first || 'there')
    .replace(/\{city\}/g, lead.city ?? 'town');
}

/** The script currently open in dialer mode; LeadFlow's outcome buttons
 *  stamp it onto the touch. Local to this browser on purpose — it is a
 *  "what I'm reading right now", not data. */
const ACTIVE_KEY = 'mkt_active_script';
export function getActiveScript(): string | null { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } }
export function setActiveScript(id: string | null): void { try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch { /* private mode */ } }

export interface ScriptSeed { venture: Venture; audience: Audience; tone: Tone; channel: ScriptChannel; title: string; body: string; principle: string }
const single = PACKAGES[0], multi = PACKAGES[1];
/** A starting set so the screen is useful on day one. Every one quotes
 *  the §4 package and names its principle. Edit freely — versions keep
 *  the history. */
export const STARTER_SCRIPTS: ScriptSeed[] = [
  { venture: 'madebymarq', audience: 'single', tone: 'straight', channel: 'call', title: 'Opener — straight', principle: 'Specificity (I looked at YOUR business)',
    body: `Hi, is this {owner}? This is Marq with Made by Marq in {city}.\n\nI'll be quick. I pulled up {business} online before I called — you're getting found, but people can't order or book from what they see. That's the whole reason I called.\n\nI build the site plus the ordering and follow-up for places like yours. It's ${single.build} to build and ${single.retainer} to keep it running and updated. Nothing custom to figure out.\n\nDo you have ten minutes this week for me to show you what it would look like for {business}?` },
  { venture: 'madebymarq', audience: 'single', tone: 'friendly', channel: 'call', title: 'Opener — friendly', principle: 'Liking + reciprocity (lead with something useful)',
    body: `Hey {first}, Marq here — I'm local, I do websites and ordering for food trucks and small shops around {city}.\n\nHonestly I was looking at {business} because I wanted to try it, and I noticed there's no way to order or see today's spot from your page. So I figured I'd just call you instead of guessing.\n\nIf it helps, I can send you a quick mock of what it could look like — no charge, no pressure. If you like it, it's ${single.build} to build and ${single.retainer} a month after.\n\nWant me to send that over?` },
  { venture: 'madebymarq', audience: 'single', tone: 'playful', channel: 'call', title: 'Opener — playful', principle: 'Pattern interrupt + curiosity',
    body: `{first}! Marq. Real human, not a robot, promise.\n\nI tried to order from {business} at 11pm last night — the craving was real — and your page sent me nowhere. So this is me calling to fix that.\n\nI build the whole thing: site, ordering, the "we're here today" post, the follow-up text. ${single.build} once, ${single.retainer} a month. That's the whole menu.\n\nCan I show you in ten minutes what {business} looks like when it actually takes orders?` },
  { venture: 'madebymarq', audience: 'multi', tone: 'straight', channel: 'call', title: 'Opener — straight (operator)', principle: 'Authority + loss aversion (what it costs you now)',
    body: `{owner}? Marq, Made by Marq.\n\nYou're running more than one location, so I'll talk numbers. Right now each of your spots is its own page, its own menu, its own inbox — and orders leak between them. I build one system that runs all of them: shared menu, per-location ordering and hours, one dashboard.\n\nIt's ${multi.build} to build and ${multi.retainer} to run, depending on how many locations.\n\nWorth twenty minutes to see what it does for {business}?` },
  { venture: 'madebymarq', audience: 'multi', tone: 'friendly', channel: 'call', title: 'Opener — friendly (operator)', principle: 'Social proof',
    body: `Hi {first}, Marq here with Made by Marq.\n\nI work with owners who've grown past one location and hit the same wall: every truck or shop has its own half-working page and nobody has time to keep them updated. I put it all under one roof — one menu, per-location ordering, one place to see what's happening.\n\nFor a group your size it's ${multi.build} to build and ${multi.retainer} monthly.\n\nCan I walk you through it this week? Twenty minutes, on a screen share.` },
  { venture: 'madebymarq', audience: 'multi', tone: 'playful', channel: 'call', title: 'Opener — playful (operator)', principle: 'Contrast (the mess vs. the one system)',
    body: `{first}, quick one — Marq, Made by Marq.\n\nHow many logins does it take to update the hours on all your locations right now? If the answer made you sigh, that's my pitch.\n\nOne system, every location, one screen. ${multi.build} to build, ${multi.retainer} a month to keep it humming.\n\nGive me twenty minutes and I'll show you what {business} looks like with one login.` },
  { venture: 'madebymarq', audience: 'single', tone: 'straight', channel: 'voicemail', title: 'Voicemail — straight', principle: 'Specificity + one clear ask',
    body: `Hi {owner}, this is Marq with Made by Marq in {city}. I looked at {business} online — people can find you but can't order from you. I build the site and ordering for places like yours, ${single.build} flat. I'll text you a mock. Call me back at this number if you want to see it. Thanks.` },
  { venture: 'madebymarq', audience: 'multi', tone: 'straight', channel: 'voicemail', title: 'Voicemail — straight (operator)', principle: 'Specificity + one clear ask',
    body: `{owner}, Marq with Made by Marq. You've got multiple locations and each one has its own page — I put them under one system with per-location ordering. ${multi.build} to build. I'll send a one-pager. Call me back at this number if it's worth twenty minutes.` },
  { venture: 'madebymarq', audience: 'single', tone: 'straight', channel: 'email', title: 'Email — straight', principle: 'Specificity + a low-friction ask',
    body: `Subject: {business} — people can't order from your page\n\nHi {owner},\n\nI pulled up {business} before writing this. You're getting found on Google, but there's no way to order, book, or see where you are today. Every one of those is a lost sale.\n\nI build the site plus ordering and follow-up for single-location places like yours. It's ${single.build} to build and ${single.retainer} to run. No custom quotes, no surprises.\n\nWant a free mock of what {business} would look like? Reply "yes" and I'll send it within a day.\n\n— Marq\nMade by Marq · {city}\n\nMade by Marq, [your business address]. Reply "stop" and I won't email again.` },
  { venture: 'madebymarq', audience: 'multi', tone: 'straight', channel: 'email', title: 'Email — straight (operator)', principle: 'Authority + contrast',
    body: `Subject: One system for every {business} location\n\nHi {owner},\n\nEach of your locations has its own page, its own menu, its own inbox. That's the pattern I see with every multi-location owner, and it costs orders every week.\n\nI build one system that runs all of them: shared menu, per-location ordering and hours, one dashboard. ${multi.build} to build, ${multi.retainer} a month.\n\nIf that's worth twenty minutes, reply with a time and I'll bring a mock of {business}.\n\n— Marq\nMade by Marq · {city}\n\nMade by Marq, [your business address]. Reply "stop" and I won't email again.` },
  { venture: 'mastermind', audience: 'any', tone: 'friendly', channel: 'dm', title: 'DM — Mastermind opener', principle: 'Commitment + proof (I use it myself)',
    body: `Hey {first} — saw your post about trying to stay on top of everything. I built the app I run my own days on: calls, money, workouts, one screen. Not selling anything in this message — if you want a look, say the word and I'll send you the invite.` },
];
