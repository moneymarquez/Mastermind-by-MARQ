// Morning Digest (master build file, Appendix 4) — runs in this Worker per
// build rule B2: the */15 cron fires the desk reports ~30 min before the
// send time and the master digest at the send time, in the user's own zone
// (America/Denver by default; Intl handles daylight saving). SMS goes out
// through Twilio when its secrets exist; web push is the fallback so the
// digest works before Twilio's toll-free verification clears.
import { requireUser, OWNER_USER_ID } from '../lib/auth';
import { Sb, json, zonedNow, addDaysIso, pushToUser } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { ask } from '../lib/ai';
import { DESKS, composeDraft, fitSms, parseReply, twilioSignature, twiml, grade, HELP_TEXT, MAX_SMS } from '../lib/digestText';
import type { Desk, DeskReport, DigestInput, ScheduleItem } from '../lib/digestText';
import { m0Progress, M0_LABEL } from '../../src/data/stageZero';
import type { M0Venture } from '../../src/data/stageZero';
import { toE164 } from '../lib/phone';

export interface DigestEnv extends SbEnv {
  ANTHROPIC_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  DIGEST_TO_NUMBER?: string;
}

const HAIKU = 'claude-haiku-4-5';
const DIGEST_DOMAIN = 'digest';

interface Settings { user_id: string; enabled: boolean; send_time: string; timezone: string; channel: 'sms' | 'push' | 'both'; desks: Partial<Record<Desk, boolean>>; separate_texts: boolean; last_sent_date: string | null }

const hrs = (iso: string, now = Date.now()) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 3600000));
const n = (v: unknown) => (v == null ? 0 : Number(v));

// ── Desk builders ─────────────────────────────────────────────────────
// Each is independent and defensive: a missing table returns [] from Sb,
// which reads as "not set up" rather than an exception.

async function ecomDesk(sb: Sb, u: string, today: string, yday: string): Promise<DeskReport> {
  const [added, pending, alerts, top, brands, orch] = await Promise.all([
    sb.get<{ channel: string }>(`ecom_products?user_id=eq.${u}&created_at=gte.${yday}T00:00:00&select=channel`),
    sb.get<{ id: string; is_money: boolean; title: string }>(`ai_approvals?user_id=eq.${u}&domain=eq.ecom&status=eq.pending&select=id,is_money,title`),
    sb.count(`ai_alerts?user_id=eq.${u}&domain=eq.ecom&read_at=is.null`),
    sb.get<{ name: string; score: number | null }>(`ecom_products?user_id=eq.${u}&score=not.is.null&order=score.desc&limit=1&select=name,score`),
    sb.get<{ name: string; current_step: number }>(`ecom_brands?user_id=eq.${u}&select=name,current_step`),
    // The Orchestrator's overnight summary (lib/orchestrator.ts), written
    // before this desk runs.
    sb.get<{ summary_text: string }>(`ai_daily_summaries?user_id=eq.${u}&domain=eq.orchestrator&date=eq.${today}&select=summary_text`),
  ]);
  const total = await sb.count(`ecom_products?user_id=eq.${u}`);
  if (total === 0 && brands.length === 0) return { desk: 'ecom', line: '', full: 'E-Com: no products or brands yet. Import a product sheet or run Product Scout.', setUp: false };
  const parts: string[] = [];
  if (added.length) parts.push(`Scout added ${added.length}`);
  if (top[0]) parts.push(`${top[0].name} scores ${n(top[0].score).toFixed(0)}/10${pending.length ? ' → approve?' : ''}`);
  if (pending.length && !top[0]) parts.push(`${pending.length} to approve`);
  if (!parts.length) parts.push(`${brands.length} brand${brands.length === 1 ? '' : 's'}, ${total} products`);
  const money = pending.filter((p) => p.is_money);
  const urgent = [
    ...(money.length ? [{ weight: 95, text: `Money approval waiting in E-Com: ${money[0].title}` }] : []),
    ...(pending.length ? [{ weight: 55, text: `Approve ${pending.length} item${pending.length === 1 ? '' : 's'} in E-Com` }] : []),
  ];
  const full = [
    `E-COM — ${today}`,
    `Products: ${total} total, ${added.length} added since yesterday`,
    `Brands: ${brands.map((b) => `${b.name} (step ${b.current_step})`).join(', ') || 'none'}`,
    `Waiting on you: ${pending.length} approval${pending.length === 1 ? '' : 's'}${money.length ? ` (${money.length} money)` : ''} · ${alerts} unread alert${alerts === 1 ? '' : 's'}`,
    top[0] ? `Top product: ${top[0].name} ${n(top[0].score).toFixed(1)}/10` : '',
    orch[0]?.summary_text ? `Orchestrator overnight: ${orch[0].summary_text}` : '',
  ].filter(Boolean).join('\n');
  return { desk: 'ecom', line: parts.join('. '), full, setUp: true, urgent };
}

async function mbmDesk(sb: Sb, u: string, today: string, yday: string): Promise<DeskReport> {
  const weekEnd = addDaysIso(today, 6);
  const [calls, touches, meetings, proposals, inbound, clients] = await Promise.all([
    sb.count(`call_outcomes?user_id=eq.${u}&call_date=eq.${yday}`),
    sb.get<{ outcome: string }>(`mkt_touches?user_id=eq.${u}&at=gte.${yday}T00:00:00&at=lt.${today}T00:00:00&select=outcome`),
    sb.get<{ event_date: string; details: Record<string, unknown> }>(`events?user_id=eq.${u}&type=eq.scalez&event_date=gte.${today}&event_date=lte.${weekEnd}&select=event_date,details`),
    sb.count(`client_invoices?user_id=eq.${u}&status=eq.sent`),
    sb.get<{ source: string; first_touch_at: string; name: string | null }>(`mkt_inbound?user_id=eq.${u}&responded_at=is.null&order=first_touch_at.asc&select=source,first_touch_at,name`),
    sb.get<{ stage: string }>(`crm_clients?user_id=eq.${u}&select=stage`),
  ]);
  const dials = calls + touches.length;
  const convos = touches.filter((t) => ['conversation', 'meeting', 'closed'].includes(t.outcome)).length;
  const stages: Record<string, number> = {};
  for (const c of clients) stages[c.stage] = (stages[c.stage] ?? 0) + 1;
  const urgent = inbound.length ? [{ weight: 100, text: `Reply to the ${inbound[0].source.replace('_', ' ')} lead${inbound[0].name ? ` (${inbound[0].name})` : ''} — waiting ${hrs(inbound[0].first_touch_at)} hrs` }] : [];
  const line = `${meetings.length} meeting${meetings.length === 1 ? '' : 's'} this week, ${proposals} proposal${proposals === 1 ? '' : 's'} out${inbound.length ? `, ${inbound.length} inbound waiting` : ''}`;
  const full = [
    `MADE BY MARQ — ${today}`,
    `Yesterday: ${dials} dials, ${convos} conversations`,
    `Meetings this week: ${meetings.length}${meetings.length ? ` (${meetings.map((m) => `${m.event_date.slice(5)} ${String((m.details as { business_name?: string }).business_name ?? '')}`.trim()).join('; ')})` : ''}`,
    `Proposals/invoices out: ${proposals}`,
    `Inbound waiting on a reply: ${inbound.length}${inbound[0] ? ` — oldest ${hrs(inbound[0].first_touch_at)} hrs` : ''}`,
    `Pipeline: ${Object.entries(stages).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ') || 'empty'}`,
  ].join('\n');
  return { desk: 'mbm', line, full, setUp: true, urgent };
}

async function mmDesk(sb: Sb, u: string, today: string): Promise<DeskReport> {
  const [openInbox, bugs, paying, testers] = await Promise.all([
    sb.get<{ subject: string | null; category: string | null; created_at: string }>(`support_inbox?status=eq.new&order=created_at.asc&select=subject,category,created_at`),
    sb.count(`client_tickets?user_id=eq.${u}&status=neq.resolved`),
    sb.count(`subscriptions?status=eq.active`),
    sb.count(`comped_users`),
  ]);
  const bugsOpen = openInbox.filter((m) => (m.category ?? '').toLowerCase().includes('bug')).length + bugs;
  const line = `${testers} tester${testers === 1 ? '' : 's'} · ${paying} paying · ${bugsOpen} bug${bugsOpen === 1 ? '' : 's'} open · ${openInbox.length} inbox`;
  const urgent = openInbox[0] && hrs(openInbox[0].created_at) >= 24 ? [{ weight: 50, text: `Answer "${(openInbox[0].subject ?? 'support email').slice(0, 40)}" — ${hrs(openInbox[0].created_at)} hrs old` }] : [];
  const full = [`MASTERMIND — ${today}`, `Testers (comped): ${testers}`, `Paying users: ${paying}`, `Bugs open: ${bugsOpen}`, `Support inbox unread: ${openInbox.length}${openInbox.slice(0, 3).map((m) => `\n· ${m.subject ?? '(no subject)'}`).join('')}`].join('\n');
  return { desk: 'mm', line, full, setUp: true, urgent };
}

async function contentDesk(sb: Sb, u: string, today: string, yday: string): Promise<DeskReport> {
  const since30 = addDaysIso(today, -30);
  const [accounts, posts, items] = await Promise.all([
    sb.count(`social_accounts?user_id=eq.${u}`),
    sb.get<{ id: string; account_id: string; posted_at: string; hook: string | null }>(`social_posts?user_id=eq.${u}&posted_at=gte.${since30}T00:00:00&select=id,account_id,posted_at,hook`),
    sb.get<{ concept: string; status: string; scheduled_for: string | null }>(`content_items?user_id=eq.${u}&status=in.(idea,script)&scheduled_for=gte.${today}&scheduled_for=lte.${addDaysIso(today, 1)}&order=scheduled_for.asc&select=concept,status,scheduled_for`),
  ]);
  if (accounts === 0 && posts.length === 0 && items.length === 0) return { desk: 'content', line: '', full: 'Content: no accounts yet. Add them in Content → Accounts.', setUp: false };
  const ids = posts.map((p) => p.id);
  const metrics = ids.length ? await sb.get<{ post_id: string; views: number | null; captured_at: string }>(`social_post_metrics?post_id=in.(${ids.join(',')})&select=post_id,views,captured_at`) : [];
  const latest: Record<string, number | null> = {};
  for (const m of metrics.sort((a, b) => a.captured_at.localeCompare(b.captured_at))) latest[m.post_id] = m.views;
  const byAcct: Record<string, number[]> = {};
  for (const p of posts) if (latest[p.id] != null) (byAcct[p.account_id] ??= []).push(latest[p.id]!);
  const avg = (a: string) => { const v = byAcct[a] ?? []; return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
  const yPosts = posts.filter((p) => p.posted_at.slice(0, 10) === yday);
  const grades = yPosts.map((p) => grade(latest[p.id], avg(p.account_id))).filter((g): g is number => g != null);
  const film = items.slice(0, 3).map((i) => i.concept);
  const line = film.length ? `Film ${film.length}: ${film.join(', ')}` : yPosts.length ? `${yPosts.length} posted yesterday${grades.length ? ` (grades ${grades.join(', ')})` : ''}` : 'Nothing scheduled — plan the week';
  const full = [`CONTENT — ${today}`, `Accounts: ${accounts}`, `Yesterday: ${yPosts.length} post${yPosts.length === 1 ? '' : 's'}${grades.length ? `, grades ${grades.join(', ')}` : ''}`, `To film today/tomorrow: ${film.length ? film.join('; ') : 'nothing scheduled'}`, `Posts in the last 30 days: ${posts.length}`].join('\n');
  return { desk: 'content', line, full, setUp: true, urgent: film.length ? [{ weight: 20, text: `Film: ${film[0]}` }] : [] };
}

async function marketingDesk(sb: Sb, u: string, today: string): Promise<DeskReport> {
  const since = addDaysIso(today, -7);
  const [touches, scripts, m0] = await Promise.all([
    sb.get<{ outcome: string; script_id: string | null }>(`mkt_touches?user_id=eq.${u}&at=gte.${since}T00:00:00&select=outcome,script_id`),
    sb.get<{ id: string; title: string; tone: string }>(`mkt_scripts?user_id=eq.${u}&select=id,title,tone`),
    sb.get<{ venture: string; done: boolean; item_key: string }>(`mkt_foundation?user_id=eq.${u}&select=venture,done,item_key`),
  ]);
  const win = (o: string) => ['conversation', 'meeting', 'closed'].includes(o);
  const byTone: Record<string, { reached: number; wins: number }> = {};
  for (const t of touches) {
    const tone = scripts.find((s) => s.id === t.script_id)?.tone;
    if (!tone || t.outcome === 'no_answer') continue;
    const b = (byTone[tone] ??= { reached: 0, wins: 0 });
    b.reached++; if (win(t.outcome)) b.wins++;
  }
  const ranked = Object.entries(byTone).filter(([, v]) => v.reached >= 2).sort((a, b) => b[1].wins / b[1].reached - a[1].wins / a[1].reached);
  const reached = touches.filter((t) => t.outcome !== 'no_answer').length;
  const wins = touches.filter((t) => win(t.outcome)).length;
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  let line = `${touches.length} calls in 7d, ${reached} reached, ${wins} convos+`;
  if (ranked.length >= 2 && ranked[0][1].wins > ranked[1][1].wins) line = `${cap(ranked[0][0])} opener beat ${cap(ranked[1][0])} ${ranked[0][1].wins}:${ranked[1][1].wins} → use it`;
  const m0Rows = m0.map((r) => ({ venture: r.venture as M0Venture, item_key: (r as { item_key?: string }).item_key ?? '', done: r.done }));
  const m0Line = (['madebymarq', 'mastermind'] as M0Venture[]).map((v) => { const p = m0Progress(v, m0Rows); return `${M0_LABEL[v]} Stage Zero ${p.done}/${p.total}${p.complete ? ' ✓' : ''}`; }).join(' · ');
  if (touches.length === 0) line = m0Line;
  const full = [`MARKETING — ${today}`, `Last 7 days: ${touches.length} touches, ${reached} reached, ${wins} conversations or better`, ranked.length ? `By tone: ${ranked.map(([k, v]) => `${k} ${v.wins}/${v.reached}`).join(', ')}` : 'By tone: not enough reached calls yet', m0Line ? `Foundation: ${m0Line}` : ''].filter(Boolean).join('\n');
  return { desk: 'marketing', line, full, setUp: true };
}

/** Rewrite one desk's full report as a short ranked list. Best effort; the
 *  deterministic report stands if the model call fails or the cap is hit. */
async function polishDesk(env: DigestEnv, sb: Sb, u: string, today: string, r: DeskReport): Promise<DeskReport> {
  if (!r.setUp || !env.ANTHROPIC_API_KEY) return r;
  try {
    const res = await ask(env.ANTHROPIC_API_KEY, sb, {
      model: HAIKU, domain: DIGEST_DOMAIN, userId: u, date: today, maxTokens: 300,
      system: 'You write one desk of a founder\'s morning report. Rank what matters most first. Numbers, not activity. Money and people waiting come first. No motivation, no filler, no markdown. Max 5 short lines. Keep every number exactly as given; never invent one.',
      user: r.full,
    });
    if (res.text && res.text.length < 700) return { ...r, full: res.text };
  } catch (e) { console.error('polishDesk', r.desk, e instanceof Error ? e.message : e); }
  return r;
}

async function buildDesks(env: DigestEnv, sb: Sb, s: Settings, today: string, yday: string, polish = true): Promise<DeskReport[]> {
  const u = s.user_id;
  const on = (d: Desk) => s.desks?.[d] !== false;
  const jobs: Promise<DeskReport>[] = [];
  if (on('ecom')) jobs.push(ecomDesk(sb, u, today, yday));
  if (on('mbm')) jobs.push(mbmDesk(sb, u, today, yday));
  if (on('mm')) jobs.push(mmDesk(sb, u, today));
  if (on('content')) jobs.push(contentDesk(sb, u, today, yday));
  if (on('marketing')) jobs.push(marketingDesk(sb, u, today));
  const settled = await Promise.allSettled(jobs);
  const reports = settled.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter((r): r is DeskReport => !!r);
  const out = polish ? await Promise.all(reports.map((r) => polishDesk(env, sb, u, today, r))) : reports;
  for (const r of out) {
    await sb.insert('ai_daily_summaries', { user_id: u, date: today, domain: r.desk, summary_text: r.full, numbers: { line: r.line, set_up: r.setUp, urgent: r.urgent ?? [] }, updated_at: new Date().toISOString() }, { upsert: 'user_id,date,domain' }).catch((e) => console.error('desk upsert', e));
  }
  return out;
}

async function loadDesks(sb: Sb, u: string, today: string): Promise<DeskReport[]> {
  const rows = await sb.get<{ domain: Desk; summary_text: string; numbers: { line?: string; set_up?: boolean; urgent?: DeskReport['urgent'] } }>(`ai_daily_summaries?user_id=eq.${u}&date=eq.${today}&domain=in.(${DESKS.map((d) => d.id).join(',')})&select=domain,summary_text,numbers`);
  return rows.map((r) => ({ desk: r.domain, full: r.summary_text, line: r.numbers?.line ?? '', setUp: r.numbers?.set_up !== false, urgent: r.numbers?.urgent ?? [] }));
}

// ── Master digest ────────────────────────────────────────────────────
async function gatherInput(sb: Sb, s: Settings, today: string, yday: string, dow: number, desks: DeskReport[]): Promise<DigestInput> {
  const u = s.user_id;
  const weekStart = addDaysIso(today, -((dow + 6) % 7));
  const [blocks, plan, ylog, targets, calls, touches, inbound, posts, weekLog, paid] = await Promise.all([
    sb.get<{ start_time: string; end_time: string; label: string }>(`schedule_blocks?user_id=eq.${u}&active=eq.true&day_of_week=eq.${dow}&order=start_time.asc&select=start_time,end_time,label`),
    sb.get<{ blocks: { time: string; duration: number; title: string }[] }>(`daily_plans?user_id=eq.${u}&plan_date=eq.${today}&select=blocks`),
    sb.get<{ dials: number | null; inbound_leads: number | null; posts: number | null }>(`daily_log?user_id=eq.${u}&date=eq.${yday}&select=dials,inbound_leads,posts`),
    sb.get<{ key: string; target: number; period: string }>(`plan_targets?user_id=eq.${u}&select=key,target,period`),
    sb.count(`call_outcomes?user_id=eq.${u}&call_date=eq.${yday}`),
    sb.count(`mkt_touches?user_id=eq.${u}&at=gte.${yday}T00:00:00&at=lt.${today}T00:00:00`),
    sb.count(`mkt_inbound?user_id=eq.${u}&first_touch_at=gte.${yday}T00:00:00&first_touch_at=lt.${today}T00:00:00`),
    sb.count(`social_posts?user_id=eq.${u}&posted_at=gte.${yday}T00:00:00&posted_at=lt.${today}T00:00:00`),
    sb.get<{ cash_in: number | null }>(`daily_log?user_id=eq.${u}&date=gte.${weekStart}&date=lte.${today}&select=cash_in`),
    sb.get<{ amount: number }>(`client_invoices?user_id=eq.${u}&status=eq.paid&paid_at=gte.${weekStart}T00:00:00&select=amount`),
  ]);
  const toHm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const schedule: ScheduleItem[] = blocks.length
    ? blocks.map((b) => ({ start: b.start_time.slice(0, 5), end: b.end_time.slice(0, 5), label: b.label }))
    : (plan[0]?.blocks ?? []).slice(0, 5).map((b) => { const [h, m] = b.time.split(':').map(Number); return { start: b.time.slice(0, 5), end: toHm(h * 60 + m + (b.duration || 0)), label: b.title }; });
  const t = (k: string) => targets.find((x) => x.key === k)?.target ?? null;
  const logged = ylog[0];
  const content = desks.find((d) => d.desk === 'content');
  const grades = (content?.full.match(/grades ([\d, ]+)/)?.[1] ?? '').split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
  const loggedCash = weekLog.reduce((s2, r) => s2 + n(r.cash_in), 0);
  return {
    dateLabel: new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' }),
    schedule,
    yesterday: { dials: logged?.dials ?? calls + touches, dialTarget: t('dials') ?? 35, inbound: logged?.inbound_leads ?? inbound, posts: logged?.posts ?? posts, grades },
    desks,
    cash: { week: loggedCash || paid.reduce((s2, r) => s2 + n(r.amount), 0), target: t('cash') },
    name: 'Marq',
  };
}

/** Deterministic draft, then one Haiku pass to rank and tighten. The model
 *  output is only used if it keeps under 600 characters and still carries
 *  every number the draft had. */
async function writeMaster(env: DigestEnv, sb: Sb, u: string, today: string, input: DigestInput): Promise<{ text: string; polished: boolean }> {
  const draft = composeDraft(input);
  if (!env.ANTHROPIC_API_KEY) return { text: draft, polished: false };
  try {
    const res = await ask(env.ANTHROPIC_API_KEY, sb, {
      model: HAIKU, domain: DIGEST_DOMAIN, userId: u, date: today, maxTokens: 400,
      system: 'You edit a founder\'s 5:30am text message. Rules: schedule with timestamps first. Then yesterday vs. target. Then exactly ONE #1 priority. Then one line per desk, numbers not activity; money and approvals waiting go first. No motivation, no filler, no markdown, no emoji. Under 600 characters. Keep the first line, the desk codes (MBM MM ECOM CONT MKT) and the final "Reply ..." line. Never invent or drop a number. Return only the message.',
      user: draft,
    });
    const nums = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');
    if (res.text && res.text.length <= MAX_SMS && nums(res.text) === nums(draft)) return { text: res.text, polished: true };
  } catch (e) { console.error('writeMaster', e instanceof Error ? e.message : e); }
  return { text: draft, polished: false };
}

interface Delivery { channel: string; sent: boolean; error?: string }
export async function sendSms(env: DigestEnv, body: string, to = env.DIGEST_TO_NUMBER): Promise<Delivery> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER || !to) return { channel: 'sms', sent: false, error: 'Twilio secrets are not all set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DIGEST_TO_NUMBER).' };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: toE164(to), From: toE164(env.TWILIO_FROM_NUMBER), Body: body }).toString(),
  });
  if (res.ok) return { channel: 'sms', sent: true };
  const err = (await res.json().catch(() => ({}))) as { message?: string; code?: number };
  return { channel: 'sms', sent: false, error: `Twilio ${res.status}${err.code ? ` (${err.code})` : ''}: ${err.message ?? 'send failed'}` };
}

async function deliver(env: DigestEnv, sb: Sb, s: Settings, title: string, body: string): Promise<Delivery[]> {
  const out: Delivery[] = [];
  if (s.channel === 'sms' || s.channel === 'both') out.push(await sendSms(env, body));
  const smsOk = out.some((d) => d.channel === 'sms' && d.sent);
  if (s.channel === 'push' || s.channel === 'both' || !smsOk) {
    const p = await pushToUser(env, sb, s.user_id, title, body, '/?screen=home');
    out.push({ channel: 'push', sent: p.sent > 0, error: p.error });
  }
  return out;
}

async function runForUser(env: DigestEnv, sb: Sb, s: Settings, opts: { kind: 'master' | 'test'; send: boolean; freshDesks: boolean }): Promise<{ body: string; desks: DeskReport[]; delivery: Delivery[]; polished: boolean }> {
  const z = zonedNow(s.timezone || 'America/Denver');
  const today = z.date, yday = addDaysIso(today, -1);
  let desks = opts.freshDesks ? [] : await loadDesks(sb, s.user_id, today);
  if (desks.length === 0) desks = await buildDesks(env, sb, s, today, yday);
  const input = await gatherInput(sb, s, today, yday, z.dow, desks);
  const { text, polished } = await writeMaster(env, sb, s.user_id, today, input);
  const delivery = opts.send ? await deliver(env, sb, s, 'Morning Digest', text) : [];
  if (opts.send && s.separate_texts) {
    for (const d of desks.filter((x) => x.setUp)) delivery.push(...(s.channel === 'push' ? [] : [await sendSms(env, fitSms(`[${DESKS.find((x) => x.id === d.desk)?.code}] ${d.full}`))]));
  }
  const sent = delivery.some((d) => d.sent);
  await sb.insert('digest_log', { user_id: s.user_id, date: today, kind: opts.kind, channel: delivery.filter((d) => d.sent).map((d) => d.channel).join('+') || null, body: text, status: !opts.send ? 'preview' : sent ? 'sent' : 'failed', error: delivery.filter((d) => !d.sent && d.error).map((d) => `${d.channel}: ${d.error}`).join(' | ') || null }).catch((e) => console.error('digest_log', e));
  return { body: text, desks, delivery, polished };
}

/** Cron (every 15 min): desks in the half hour before send time, the
 *  master digest once in the 45 minutes from send time. */
export async function runMorningDigest(env: DigestEnv): Promise<void> {
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = new Sb(env);
  const all = await sb.get<Settings>('digest_settings?enabled=eq.true&select=*');
  for (const s of all) {
    try {
      const z = zonedNow(s.timezone || 'America/Denver');
      const [h, m] = s.send_time.split(':').map(Number);
      const sendMin = h * 60 + m;
      if (s.last_sent_date === z.date) continue;
      if (z.minutes >= sendMin - 30 && z.minutes < sendMin) {
        const have = await loadDesks(sb, s.user_id, z.date);
        if (have.length === 0) await buildDesks(env, sb, s, z.date, addDaysIso(z.date, -1));
      } else if (z.minutes >= sendMin && z.minutes < sendMin + 45) {
        await runForUser(env, sb, s, { kind: 'master', send: true, freshDesks: false });
        await sb.patch('digest_settings', `user_id=eq.${s.user_id}`, { last_sent_date: z.date, updated_at: new Date().toISOString() });
      }
    } catch (e) { console.error('runMorningDigest', s.user_id, e); }
  }
}

async function settingsFor(sb: Sb, userId: string): Promise<Settings> {
  const rows = await sb.get<Settings>(`digest_settings?user_id=eq.${userId}&select=*`);
  if (rows[0]) return rows[0];
  const made = await sb.insert<Settings>('digest_settings', { user_id: userId }, { upsert: 'user_id' });
  return made[0];
}

/** POST /api/digest/test — "Send test now". ?send=0 previews without sending. */
export async function digestTest(request: Request, env: DigestEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set as a Worker secret.' }, 500);
  const sb = new Sb(env);
  const send = new URL(request.url).searchParams.get('send') !== '0';
  try {
    const s = await settingsFor(sb, user.id);
    const r = await runForUser(env, sb, s, { kind: 'test', send, freshDesks: true });
    return json({ body: r.body, length: r.body.length, polished: r.polished, delivery: r.delivery, desks: r.desks.map((d) => ({ desk: d.desk, line: d.line, full: d.full, setUp: d.setUp })), twilio: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER && env.DIGEST_TO_NUMBER) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

/** GET /api/digest/status — which secrets exist (never their values). */
export async function digestStatus(request: Request, env: DigestEnv): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  return json({
    twilio: { sid: !!env.TWILIO_ACCOUNT_SID, token: !!env.TWILIO_AUTH_TOKEN, from: !!env.TWILIO_FROM_NUMBER, to: !!env.DIGEST_TO_NUMBER },
    anthropic: !!env.ANTHROPIC_API_KEY,
    push: !!(env.VITE_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    replyWebhook: `${new URL(request.url).origin}/api/digest/reply`,
  });
}

/** POST /api/digest/reply — Twilio's incoming-message webhook. */
export async function digestReply(request: Request, env: DigestEnv): Promise<Response> {
  const xml = (m: string) => new Response(twiml(m), { headers: { 'content-type': 'text/xml' } });
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => { params[k] = String(v); });
  if (env.TWILIO_AUTH_TOKEN) {
    const expected = await twilioSignature(request.url, params, env.TWILIO_AUTH_TOKEN);
    if (request.headers.get('x-twilio-signature') !== expected) return new Response('Bad signature', { status: 403 });
  } else {
    return new Response('Twilio is not configured', { status: 503 });
  }
  const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');
  if (!env.DIGEST_TO_NUMBER || digits(params.From) !== digits(env.DIGEST_TO_NUMBER)) return xml('This number only answers its owner.');
  const sb = new Sb(env);
  const userId = OWNER_USER_ID;
  const s = await settingsFor(sb, userId);
  const today = zonedNow(s.timezone || 'America/Denver').date;
  const cmd = parseReply(params.Body ?? '');
  let reply = HELP_TEXT;
  if (cmd.kind === 'desk') {
    let desks = await loadDesks(sb, userId, today);
    if (!desks.find((d) => d.desk === cmd.desk)) desks = await buildDesks(env, sb, s, today, addDaysIso(today, -1), false);
    reply = fitSms(desks.find((d) => d.desk === cmd.desk)?.full ?? 'That desk has no report today.', 1500);
  } else if (cmd.kind === 'log') {
    await sb.insert('daily_log', { user_id: userId, date: today, [cmd.field]: cmd.value, updated_at: new Date().toISOString() }, { upsert: 'user_id,date' });
    reply = `Logged ${cmd.field.replace('_in', '').replace('_leads', '')} ${cmd.value} for ${today}.`;
  } else if (cmd.kind === 'done') {
    await sb.insert('daily_log', { user_id: userId, date: today, top_done: true, updated_at: new Date().toISOString() }, { upsert: 'user_id,date' });
    reply = 'Marked today\'s #1 done.';
  }
  await sb.insert('digest_log', { user_id: userId, date: today, kind: 'reply', channel: 'sms', body: `${params.Body ?? ''} → ${reply}`.slice(0, 2000), status: 'sent' }).catch(() => {});
  return xml(reply);
}
