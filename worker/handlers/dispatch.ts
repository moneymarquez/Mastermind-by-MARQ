// Dispatch (specs 14 + 15): talk tasks out, they land on the right person.
//
//   POST /api/dispatch/extract     transcript → tasks, questions, notes (Claude)
//   POST /api/dispatch/transcribe  audio → text (Workers AI Whisper) — the
//                                  fallback when the browser can't transcribe
//                                  live, and the retry when it failed
//   POST /api/dispatch/notify      a saved session → tell each assignee
//   POST /api/dispatch/nudge       one task → remind its assignee
//   POST /api/dispatch/invite      a person → invite link (+ SMS if asked)
//   POST /api/dispatch/join        invite token → attach the caller's login
//
// The browser writes sessions and tasks itself (RLS in schema_111 decides
// who may); the Worker only does what needs a secret: the model call, the
// transcription, and push / SMS / email.
import { requireUser } from '../lib/auth';
import type { AuthedUser } from '../lib/auth';
import { isMember } from '../lib/member';
import { Sb, json, zonedNow, pushToUser } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { ask, CapReached } from '../lib/ai';
import { sendSms } from './digest';
import type { DigestEnv } from './digest';

export interface DispatchEnv extends DigestEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
}

const MODEL = 'claude-opus-5';
const DOMAIN = 'dispatch';
const MAX_TRANSCRIPT = 20_000;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

interface MemberRow { id: string; owner_id: string; user_id: string | null; name: string; role: string; phone: string | null; email: string | null; notify: string }
interface TaskRow { id: string; owner_id: string; assignee_member_id: string | null; title: string; priority: number; due_date: string | null; source_quote: string | null; status: string; session_id: string | null }

/** Whose workspace the caller is acting in, and whether they may assign
 *  to other people. A subscriber runs their own; a team member works in
 *  the team lead's (the first team, for now — nobody is on two yet). */
async function workspace(sb: Sb, user: AuthedUser): Promise<{ ownerId: string; canAssign: boolean; self: MemberRow | null } | Response> {
  if (await isMember(sb, user.id)) return { ownerId: user.id, canAssign: true, self: null };
  const [m] = await sb.get<MemberRow>(`dispatch_members?user_id=eq.${user.id}&select=*&order=joined_at.asc&limit=1`);
  if (!m) return json({ error: 'This needs an active Mastermind subscription or a team invite.', code: 'subscription_required' }, 402);
  return { ownerId: m.owner_id, canAssign: m.role === 'manager', self: m };
}

async function readJson<T>(request: Request, max = 64_000): Promise<T | Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const raw = await request.text();
  if (raw.length > max) return json({ error: 'Too large' }, 413);
  try { return JSON.parse(raw) as T; } catch { return json({ error: 'Bad JSON' }, 400); }
}

async function ownerFirstName(sb: Sb, ownerId: string): Promise<string> {
  const res = await fetch(`${sb.url}/auth/v1/admin/users/${ownerId}`, { headers: sb.headers }).catch(() => null);
  const u = res?.ok ? ((await res.json()) as { user_metadata?: { full_name?: string } }) : null;
  return u?.user_metadata?.full_name?.trim().split(/\s+/)[0] || 'Your team lead';
}

// ── extract ────────────────────────────────────────────────────────────
export interface ExtractedTask {
  title: string;
  assignee_member_id: string | null; // null = the person talking / owner
  assignee_name: string;
  confidence: 'high' | 'low';
  priority: number;
  priority_reason: string;
  due_date: string | null;
  source_quote: string;
}
export interface Extraction { tasks: ExtractedTask[]; questions: { task_index: number; text: string; options: string[] }[]; notes: string[] }

const SYSTEM = `You turn a spoken brain-dump from a small-business owner into tasks for their team.

Return ONLY a JSON object, no prose, no code fence:
{"tasks":[{"title":string,"assignee":string,"confidence":"high"|"low","priority":1-5,"priority_reason":string,"due_date":"YYYY-MM-DD"|null,"source_quote":string}],
 "questions":[{"task_index":number,"text":string,"options":[string]}],
 "notes":[string]}

Rules:
- One task per distinct action. Title: imperative, under 60 characters, no names or dates in it.
- assignee: exactly one name from PEOPLE, or "me" for the speaker. If the speaker hedges ("probably", "maybe", "or someone") or names nobody for work that isn't clearly theirs, pick the likeliest and set confidence "low", and add a question for it whose options are the likely names plus "me".
- priority: 1 = urgent / "the big one" / blocking money, 2 = important this week, 3 = normal, 4 = when there's time, 5 = someday. priority_reason: a few words why.
- due_date: resolve relative dates against TODAY (weekday included). "By Thursday" = the coming Thursday. No date said → null.
- source_quote: the speaker's exact words for this task, trimmed, under 120 characters.
- notes: things said that are facts or reminders, not actions (e.g. "the Johnson site gate code is 4471").
- Never invent tasks, people or dates that weren't said.`;

function parseExtraction(text: string): { tasks: Record<string, unknown>[]; questions: Record<string, unknown>[]; notes: unknown[] } | null {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return { tasks: Array.isArray(o.tasks) ? o.tasks as Record<string, unknown>[] : [], questions: Array.isArray(o.questions) ? o.questions as Record<string, unknown>[] : [], notes: Array.isArray(o.notes) ? o.notes : [] };
  } catch { return null; }
}

/** Model output → rows the Review screen can trust: names resolved to
 *  member ids, priorities clamped, dates validated, anything a member
 *  isn't allowed to assign pulled back to themselves and flagged. */
export function normalizeExtraction(raw: NonNullable<ReturnType<typeof parseExtraction>>, people: { id: string; name: string }[], self: { id: string | null; name: string }, canAssign: boolean): Extraction {
  const byName = new Map(people.map((p) => [p.name.trim().toLowerCase(), p]));
  const firstName = new Map(people.map((p) => [p.name.trim().split(/\s+/)[0].toLowerCase(), p]));
  const resolve = (n: string) => byName.get(n.trim().toLowerCase()) ?? firstName.get(n.trim().split(/\s+/)[0].toLowerCase()) ?? null;
  const tasks: ExtractedTask[] = raw.tasks.slice(0, 30).flatMap((t) => {
    const title = String(t.title ?? '').trim().slice(0, 200);
    if (!title) return [];
    const who = String(t.assignee ?? 'me');
    const person = /^me$/i.test(who) ? null : resolve(who);
    let confidence: 'high' | 'low' = t.confidence === 'low' || (!person && !/^me$/i.test(who)) ? 'low' : 'high';
    let assignee = person ? { id: person.id, name: person.name } : { id: self.id, name: self.name };
    if (!canAssign && assignee.id !== self.id) { assignee = { id: self.id, name: self.name }; confidence = 'low'; }
    const p = Math.round(Number(t.priority));
    const due = typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) && !Number.isNaN(Date.parse(t.due_date)) ? t.due_date : null;
    return [{ title, assignee_member_id: assignee.id, assignee_name: assignee.name, confidence, priority: p >= 1 && p <= 5 ? p : 3, priority_reason: String(t.priority_reason ?? '').slice(0, 120), due_date: due, source_quote: String(t.source_quote ?? '').trim().slice(0, 200) }];
  });
  const questions = raw.questions.flatMap((q) => {
    const i = Number(q.task_index);
    if (!Number.isInteger(i) || !tasks[i]) return [];
    const options = (Array.isArray(q.options) ? q.options : []).map(String).filter((o) => /^me$/i.test(o) || resolve(o)).slice(0, 4);
    return [{ task_index: i, text: String(q.text ?? `Who should do "${tasks[i].title}"?`).slice(0, 160), options }];
  });
  // Every low-confidence task gets exactly one question, even if the model forgot it.
  tasks.forEach((t, i) => { if (t.confidence === 'low' && !questions.some((q) => q.task_index === i)) questions.push({ task_index: i, text: `Who should ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}?`, options: [] }); });
  return { tasks, questions, notes: raw.notes.map(String).filter(Boolean).slice(0, 10).map((n) => n.slice(0, 300)) };
}

export async function dispatchExtract(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const body = await readJson<{ transcript?: string; tz?: string }>(request);
  if (body instanceof Response) return body;
  const transcript = String(body.transcript ?? '').trim();
  if (!transcript) return json({ error: 'Nothing was said.' }, 400);
  if (transcript.length > MAX_TRANSCRIPT) return json({ error: 'That was too long to process in one go — split it in two.' }, 413);
  const sb = new Sb(env);
  const ws = await workspace(sb, user);
  if (ws instanceof Response) return ws;

  const roster = await sb.get<MemberRow>(`dispatch_members?owner_id=eq.${ws.ownerId}&select=id,name,role,user_id&order=name.asc`);
  const people = roster.filter((m) => m.id !== ws.self?.id).map((m) => ({ id: m.id, name: m.name }));
  let tz = 'America/Los_Angeles';
  try { if (body.tz) { new Intl.DateTimeFormat('en-US', { timeZone: body.tz }); tz = body.tz; } } catch { /* keep default */ }
  const now = zonedNow(tz);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.dow];
  try {
    const res = await ask(env.ANTHROPIC_API_KEY, sb, {
      model: MODEL, domain: DOMAIN, userId: ws.ownerId, date: now.date, maxTokens: 2000, system: SYSTEM,
      user: `TODAY: ${weekday} ${now.date}\nPEOPLE: ${people.map((p) => p.name).join(', ') || '(none yet)'}\nSPEAKER: ${ws.self ? ws.self.name : 'the owner'}${ws.canAssign ? '' : ' (can only assign to themselves)'}\n\nTRANSCRIPT:\n${transcript}`,
    });
    const raw = parseExtraction(res.text);
    if (!raw) return json({ error: "Couldn't read the tasks out of that. Your words are kept — try again." }, 502);
    return json({ ...normalizeExtraction(raw, people, { id: ws.self?.id ?? null, name: ws.self ? ws.self.name : 'You' }, ws.canAssign), owner_id: ws.ownerId, cost_usd: res.costUsd });
  } catch (e) {
    if (e instanceof CapReached) return json({ error: e.message, code: 'cap_reached' }, 429);
    console.error('dispatch extract', e);
    return json({ error: e instanceof Error ? e.message : 'Extraction failed' }, 502);
  }
}

// ── transcribe ─────────────────────────────────────────────────────────
export async function dispatchTranscribe(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const ws = await workspace(new Sb(env), user);
  if (ws instanceof Response) return ws;
  if (!env.AI) return json({ error: "Server transcription isn't switched on (Workers AI binding missing). Type it instead.", code: 'no_ai' }, 501);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return json({ error: 'No audio' }, 400);
  if (buf.length > MAX_AUDIO_BYTES) return json({ error: 'Recording too long to transcribe — keep it under about 5 minutes.' }, 413);
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  try {
    const out = (await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: btoa(bin), language: 'en' })) as { text?: string };
    return json({ text: (out.text ?? '').trim() });
  } catch (e) {
    console.error('dispatch transcribe', e);
    return json({ error: 'Transcription failed. The recording is kept — retry, or type it.' }, 502);
  }
}

// ── notify / nudge ─────────────────────────────────────────────────────
async function sendEmail(env: DispatchEnv, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, subject, text }),
  }).catch(() => null);
  return !!res?.ok;
}

/** Reach one person on the channel they chose, falling back through the
 *  others so a missing Twilio number never swallows the message. */
async function reach(env: DispatchEnv, sb: Sb, m: MemberRow, title: string, body: string, url: string): Promise<string | null> {
  const order = [m.notify, 'push', 'sms', 'email'].filter((c, i, a) => a.indexOf(c) === i);
  for (const c of order) {
    if (c === 'push' && m.user_id) { const r = await pushToUser(env as SbEnv, sb, m.user_id, title, body, url); if (r.sent > 0) return 'push'; }
    if (c === 'sms' && m.phone) { const r = await sendSms(env, `${title}: ${body}`.slice(0, 320), m.phone); if (r.sent) return 'sms'; }
    if (c === 'email' && m.email && (await sendEmail(env, m.email, title, `${body}\n\n${url}`))) return 'email';
  }
  return null;
}

function origin(request: Request): string { return new URL(request.url).origin; }

export async function dispatchNotify(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const body = await readJson<{ session_id?: string }>(request);
  if (body instanceof Response) return body;
  if (!/^[0-9a-f-]{36}$/.test(String(body.session_id))) return json({ error: 'session_id required' }, 400);
  const sb = new Sb(env);
  const [session] = await sb.get<{ owner_id: string; created_by: string }>(`dispatch_sessions?id=eq.${body.session_id}&select=owner_id,created_by`);
  if (!session || session.created_by !== user.id) return json({ error: 'Not your session' }, 403);
  const tasks = await sb.get<TaskRow>(`dispatch_tasks?session_id=eq.${body.session_id}&select=*&order=priority.asc`);
  const ids = [...new Set(tasks.map((t) => t.assignee_member_id).filter((x): x is string => !!x))];
  if (!ids.length) return json({ notified: [] });
  const members = await sb.get<MemberRow>(`dispatch_members?id=in.(${ids.join(',')})&select=*`);
  const from = session.owner_id === user.id ? await ownerFirstName(sb, session.owner_id) : (members.find((m) => m.user_id === user.id)?.name ?? 'Your team');
  const notified: { name: string; via: string | null }[] = [];
  for (const m of members) {
    if (m.user_id === user.id) continue;
    const mine = tasks.filter((t) => t.assignee_member_id === m.id);
    const lead = mine[0];
    const text = mine.length === 1 ? `"${lead.title}"${lead.due_date ? ` · due ${lead.due_date}` : ''}` : `${mine.length} tasks — first: "${lead.title}"`;
    notified.push({ name: m.name, via: await reach(env, sb, m, `${from} sent you ${mine.length === 1 ? 'a task' : `${mine.length} tasks`}`, text, `${origin(request)}/?screen=dispatch`) });
  }
  return json({ notified });
}

export async function dispatchNudge(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const body = await readJson<{ task_id?: string }>(request);
  if (body instanceof Response) return body;
  if (!/^[0-9a-f-]{36}$/.test(String(body.task_id))) return json({ error: 'task_id required' }, 400);
  const sb = new Sb(env);
  const [task] = await sb.get<TaskRow & { nudged_at: string | null }>(`dispatch_tasks?id=eq.${body.task_id}&select=*`);
  if (!task) return json({ error: 'No such task' }, 404);
  const managers = await sb.get<MemberRow>(`dispatch_members?owner_id=eq.${task.owner_id}&user_id=eq.${user.id}&role=eq.manager&select=id`);
  if (task.owner_id !== user.id && !managers.length) return json({ error: 'Only the team lead or a manager can nudge' }, 403);
  if (!task.assignee_member_id) return json({ error: "That one's yours." }, 400);
  if (task.nudged_at && Date.now() - Date.parse(task.nudged_at) < 10 * 60_000) return json({ error: 'Nudged in the last 10 minutes — give it a moment.' }, 429);
  const [m] = await sb.get<MemberRow>(`dispatch_members?id=eq.${task.assignee_member_id}&select=*`);
  if (!m) return json({ error: 'That person is no longer on the team' }, 404);
  const from = await ownerFirstName(sb, task.owner_id);
  const via = await reach(env, sb, m, `Reminder from ${from}`, `"${task.title}"${task.due_date ? ` · due ${task.due_date}` : ''}${task.source_quote ? ` — “${task.source_quote}”` : ''}`, `${origin(request)}/?screen=dispatch`);
  await sb.patch('dispatch_tasks', `id=eq.${task.id}`, { nudged_at: new Date().toISOString() }).catch(() => {});
  if (!via) return json({ error: `Couldn't reach ${m.name}: no app login with notifications, and no working phone or email. Add one on People.`, sent: false }, 409);
  return json({ sent: true, via });
}

// ── invite / join ──────────────────────────────────────────────────────
function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function dispatchInvite(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const body = await readJson<{ member_id?: string; sms?: boolean }>(request);
  if (body instanceof Response) return body;
  if (!/^[0-9a-f-]{36}$/.test(String(body.member_id))) return json({ error: 'member_id required' }, 400);
  const sb = new Sb(env);
  if (!(await isMember(sb, user.id))) return json({ error: 'This needs an active Mastermind subscription.', code: 'subscription_required' }, 402);
  const [m] = await sb.get<MemberRow>(`dispatch_members?id=eq.${body.member_id}&owner_id=eq.${user.id}&select=*`);
  if (!m) return json({ error: 'No such person on your team' }, 404);
  if (m.user_id) return json({ error: `${m.name} has already joined.` }, 409);
  const t = token();
  await sb.patch('dispatch_members', `id=eq.${m.id}`, { invite_token: t, invited_at: new Date().toISOString() });
  const link = `${origin(request)}/?join=${t}`;
  let sms: { sent: boolean; error?: string } | null = null;
  if (body.sms) {
    if (!m.phone) sms = { sent: false, error: `Add a phone number for ${m.name} first.` };
    else sms = await sendSms(env, `${await ownerFirstName(sb, user.id)} added you to Mastermind — tap to join: ${link}`, m.phone);
  }
  return json({ link, sms });
}

export async function dispatchJoin(request: Request, env: DispatchEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const body = await readJson<{ token?: string }>(request);
  if (body instanceof Response) return body;
  const t = String(body.token ?? '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(t)) return json({ error: 'That invite link looks incomplete.' }, 400);
  const sb = new Sb(env);
  const [m] = await sb.get<MemberRow>(`dispatch_members?invite_token=eq.${t}&select=*`);
  if (!m) return json({ error: 'That invite has already been used or was replaced. Ask for a new one.' }, 404);
  if (m.owner_id === user.id) return json({ error: "That's your own team — send the link to them." }, 400);
  const dupe = await sb.get<MemberRow>(`dispatch_members?owner_id=eq.${m.owner_id}&user_id=eq.${user.id}&select=id`);
  if (dupe.length) return json({ error: "You're already on this team." }, 409);
  await sb.patch('dispatch_members', `id=eq.${m.id}`, { user_id: user.id, joined_at: new Date().toISOString(), invite_token: null, email: m.email ?? user.email ?? null });
  return json({ joined: true, owner_name: await ownerFirstName(sb, m.owner_id), member_name: m.name });
}
