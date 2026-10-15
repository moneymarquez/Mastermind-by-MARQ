import type { Sb } from '../sb';
import { zonedNow } from '../sb';
import { ask } from '../ai';
import { MODELS } from '../models';
import { extractJson } from '../scout';
import { notifyStored } from '../notify';
import { isDryRun } from '../dryRun';
import { callDueDate, callScript, dailyCap, draftColdEmail, looksLikeStop, parseClassification, routeReply, shouldPause, type Classified, type ReplyClass } from './core';
import { sendMail, type MailEnv } from './mail';
import { TZ } from '../engines/budget';

export type OutreachEnv = MailEnv & { ANTHROPIC_API_KEY?: string };
export const BOOKING_BASE = 'https://mastermindsbymarq.com/book/marq';
export const bookingLink = (outreachId: string) => `${BOOKING_BASE}?lead=${outreachId}`;

interface Outreach { id: string; lead_id: string | null; place_id: string | null; business_name: string; to_email: string | null; phone: string | null; finding_kind: string | null; finding_summary: string | null; subject: string | null; body: string | null; status: string; is_test: boolean; sent_at: string | null; bumped_at: string | null; bump_due_at: string | null; text_consent: boolean; warm: boolean; next_checkin_at: string | null }
const today = () => zonedNow(TZ).date;
const ownerEmail = async (sb: Sb, userId: string) => (await sb.get<{ owner_email: string | null }>(`booking_settings?user_id=eq.${userId}&select=owner_email&limit=1`))[0]?.owner_email ?? null;

/** Turn the best findings into drafted cold emails (not sent: each waits for Marq's approval). */
export async function draftOutreach(sb: Sb, userId: string, limit = 10): Promise<number> {
  const f = await sb.get<{ place_id: string; kind: string; summary: string; score: number; evidence: Record<string, unknown> }>(`lead_findings?user_id=eq.${userId}&kind=neq.checked&order=score.desc&limit=200&select=place_id,kind,summary,score,evidence`);
  const seen = new Set<string>(), top: typeof f = [];
  for (const x of f) if (!seen.has(x.place_id)) { seen.add(x.place_id); top.push(x); }
  if (!top.length) return 0;
  const have = new Set((await sb.get<{ place_id: string }>(`lead_outreach?user_id=eq.${userId}&place_id=in.(${top.map((t) => `"${t.place_id}"`).join(',')})&select=place_id`)).map((r) => r.place_id));
  const dnc = await sb.get<{ email: string | null }>(`do_not_contact?user_id=eq.${userId}&select=email&limit=5000`);
  const blocked = new Set(dnc.map((d) => (d.email ?? '').toLowerCase()));
  let n = 0;
  for (const t of top) {
    if (n >= limit) break;
    if (have.has(t.place_id)) continue;
    const [lead] = await sb.get<{ id: string; business_name: string; owner_name: string | null; city: string | null; category: string | null; owner_email: string | null; phone: string | null; status: string | null }>(`leads?place_id=eq.${encodeURIComponent(t.place_id)}&select=id,business_name,owner_name,city,category,owner_email,phone,status&limit=1`);
    if (!lead || lead.status === 'do_not_contact' || (lead.owner_email && blocked.has(lead.owner_email.toLowerCase()))) continue;
    const e = draftColdEmail(lead, t);
    await sb.insert('lead_outreach', { user_id: userId, lead_id: lead.id, place_id: t.place_id, business_name: lead.business_name, to_email: lead.owner_email, phone: lead.phone, finding_kind: t.kind, finding_summary: t.summary, subject: e.subject, body: e.body, status: 'drafted', is_test: true });
    n++;
  }
  return n;
}

async function mailboxState(sb: Sb, userId: string) {
  const [d] = await sb.get<{ warmup_start: string | null; paused: boolean; pause_reason: string | null; mailbox: string | null; sent_total: number; bounced: number; complaints: number }>(`outreach_domain?user_id=eq.${userId}&select=*&limit=1`);
  return d ?? { warmup_start: null, paused: false, pause_reason: null, mailbox: null, sent_total: 0, bounced: 0, complaints: 0 };
}
const sentToday = async (sb: Sb, userId: string) => {
  const start = new Date(`${today()}T00:00:00Z`).getTime() - 7 * 3600000;
  return sb.count(`lead_outreach?user_id=eq.${userId}&sent_at=gte.${new Date(start).toISOString()}`);
};

/** Send approved emails, capped by the warm-up schedule and the auto-pause. In test mode each goes to Marq's inbox as [TEST]; the warm-up counter then isn't touched. */
export async function sendApproved(env: OutreachEnv, sb: Sb, userId: string, only?: string[]): Promise<{ sent: number; capped: boolean; paused: string | null; errors: string[] }> {
  const dom = await mailboxState(sb, userId), test = isDryRun(env);
  const reason = shouldPause(dom.sent_total, dom.bounced, dom.complaints);
  if (!test && (dom.paused || reason)) return { sent: 0, capped: false, paused: dom.pause_reason ?? reason, errors: [] };
  const cap = test ? 10 : dailyCap(dom.warmup_start, today());
  const room = Math.max(0, cap - (test ? 0 : await sentToday(sb, userId)));
  const rows = await sb.get<Outreach>(`lead_outreach?user_id=eq.${userId}&status=eq.approved${only?.length ? `&id=in.(${only.join(',')})` : ''}&order=approved_at.asc&limit=${Math.max(1, room)}`);
  const owner = await ownerEmail(sb, userId);
  let sent = 0; const errors: string[] = [];
  for (const o of rows.slice(0, room)) {
    const dnc = o.to_email ? await sb.get(`do_not_contact?user_id=eq.${userId}&email=eq.${encodeURIComponent(o.to_email.toLowerCase())}&select=id&limit=1`) : [];
    if (dnc.length) { await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'dnc', updated_at: new Date().toISOString() }); continue; }
    const r = await sendMail(env, { to: o.to_email, subject: o.subject ?? 'Quick question', body: o.body ?? '' }, { ownerEmail: owner, fromMailbox: dom.mailbox, kind: 'cold' });
    if (!r.ok) { errors.push(`${o.business_name}: ${r.error}`); continue; }
    const now = new Date(), sd = zonedNow(TZ, now).date;
    await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'sent', sent_at: now.toISOString(), is_test: r.test, call_due_at: new Date(`${callDueDate(sd)}T15:00:00Z`).toISOString(), bump_due_at: new Date(now.getTime() + 3 * 86400000).toISOString(), updated_at: now.toISOString() });
    if (!r.test) await sb.patch('outreach_domain', `user_id=eq.${userId}`, { sent_total: dom.sent_total + sent + 1 });
    sent++;
  }
  return { sent, capped: rows.length > room, paused: null, errors };
}

/** Sent, no reply: one short bump after three days; after one business day with no reply at all, the lead goes on the call list. */
export async function followUps(env: OutreachEnv, sb: Sb, userId: string): Promise<{ bumped: number; called: number }> {
  const now = new Date().toISOString();
  const bumps = await sb.get<Outreach>(`lead_outreach?user_id=eq.${userId}&status=eq.sent&bumped_at=is.null&bump_due_at=lte.${now}&limit=10`);
  const owner = await ownerEmail(sb, userId), dom = await mailboxState(sb, userId);
  let bumped = 0;
  for (const o of bumps) {
    const r = await sendMail(env, { to: o.to_email, subject: `Re: ${o.subject ?? ''}`, body: `Hi, just floating this back up in case it got buried. ${o.finding_summary ?? ''} Yes or no is all I need.\n\nMarq\n\nReply "stop" and I won't write again.` }, { ownerEmail: owner, fromMailbox: dom.mailbox, kind: 'cold' });
    if (r.ok) { await sb.patch('lead_outreach', `id=eq.${o.id}`, { bumped_at: new Date().toISOString(), updated_at: new Date().toISOString() }); bumped++; }
  }
  const due = await sb.get<Outreach>(`lead_outreach?user_id=eq.${userId}&status=eq.sent&call_due_at=lte.${now}&limit=50`);
  for (const o of due) await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'call_list', updated_at: now });
  return { bumped, called: due.length };
}

export async function callList(sb: Sb, userId: string) {
  const rows = await sb.get<Outreach>(`lead_outreach?user_id=eq.${userId}&status=eq.call_list&order=call_due_at.asc&limit=100`);
  const owners = rows.length ? await sb.get<{ id: string; owner_name: string | null }>(`leads?id=in.(${rows.map((r) => r.lead_id).filter(Boolean).join(',')})&select=id,owner_name`) : [];
  const on = new Map(owners.map((l) => [l.id, l.owner_name]));
  return rows.map((o) => ({ id: o.id, business_name: o.business_name, phone: o.phone, finding: o.finding_summary, script: callScript({ business_name: o.business_name, owner_name: o.lead_id ? on.get(o.lead_id) : null }, o.finding_summary ?? ''), text_consent: o.text_consent }));
}

// ── Replies ───────────────────────────────────────────────────────────
const CLASSIFY_SYSTEM = `You classify a business owner's reply to a cold email. Reply with JSON only: {"classification","confidence","return_date","referral","summary"}.
classification is exactly one of: interested (wants to talk, asks to schedule, says yes), question (asks about price, what you do, how it works — wants info), not_now (maybe later; return_date YYYY-MM-DD if they gave a date), not_interested (polite no), stop (unsubscribe, angry, hostile, threatening, "remove me"), out_of_office (auto-reply; return_date if given), wrong_person (not the right contact; referral = who or what they pointed to), unclear.
confidence is 0 to 1 and should be low when the message is ambiguous, sarcastic, or mixes signals. Never treat an auto-reply as interested.`;
export async function classifyReply(env: OutreachEnv, sb: Sb, userId: string, text: string): Promise<Classified> {
  if (looksLikeStop(text)) return { classification: 'stop', confidence: 1, summary: 'Asked to stop.' };
  if (!env.ANTHROPIC_API_KEY) return { classification: 'unclear', confidence: 0, summary: 'Claude isn\'t connected.' };
  const [pb] = await sb.get<{ body: string }>(`ai_playbooks?user_id=eq.${userId}&name=eq.${encodeURIComponent('Reply classification corrections')}&select=body&limit=1`);
  const res = await ask(env.ANTHROPIC_API_KEY, sb, { model: MODELS.haiku, system: pb?.body ? `${CLASSIFY_SYSTEM}\n\nMarq's corrections to earlier readings (learn from them):\n${pb.body.slice(-2500)}` : CLASSIFY_SYSTEM, user: `Today is ${today()}.\n\nReply:\n"""\n${text.slice(0, 3000)}\n"""`, maxTokens: 300, domain: 'marketing', userId, date: today() });
  try { return parseClassification(extractJson(res.text)); } catch { return { classification: 'unclear', confidence: 0, summary: 'Could not read the answer.' }; }
}

const ANSWER_SYSTEM = `You write a short, friendly plain-text email reply for Marq at Made by Marq (websites, ordering/booking pages and follow-up automations for small local businesses). Answer only what was asked, in 2-4 sentences. Never invent prices, timelines or guarantees: if unsure, say Marq will cover it on a quick call. No links (the caller adds one if wanted).`;
async function draftAnswer(env: OutreachEnv, sb: Sb, userId: string, o: Outreach, reply: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) return '';
  const res = await ask(env.ANTHROPIC_API_KEY, sb, { model: MODELS.haiku, system: ANSWER_SYSTEM, user: `Our email about ${o.business_name}: ${o.finding_summary}\n\nTheir reply:\n${reply.slice(0, 2000)}`, maxTokens: 300, domain: 'marketing', userId, date: today() });
  return res.text.trim();
}

/** Take one reply end to end: classify, log, route, and do whatever the route allows. Only "interested" sends anything on its own. */
export async function handleReply(env: OutreachEnv, sb: Sb, userId: string, input: { outreachId: string | null; from?: string; body: string }, classify = classifyReply): Promise<{ classification: ReplyClass; confidence: number; action: string; note: string; replyId: string | null; sentBookingLink: boolean }> {
  const [o] = input.outreachId ? await sb.get<Outreach>(`lead_outreach?user_id=eq.${userId}&id=eq.${input.outreachId}&limit=1`) : [];
  const c = await classify(env, sb, userId, input.body);
  const routed = routeReply(c, today(), !!o?.warm);
  const now = new Date().toISOString();
  let draft: string | null = null, sentBookingLink = false;
  if (o) {
    if (routed.action === 'send_booking_link') {
      const link = bookingLink(o.id);
      const r = await sendMail(env, { to: input.from || o.to_email, subject: `Re: ${o.subject ?? 'Quick question'}`, body: `Great, thanks for the quick reply. Here's a link to grab a 15-minute slot that works for you: ${link}\n\nMarq` }, { ownerEmail: await ownerEmail(sb, userId), kind: 'cold' });
      sentBookingLink = r.ok;
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'replied', text_consent: true, updated_at: now });
    } else if (routed.action === 'draft_answer') {
      draft = (await draftAnswer(env, sb, userId, o, input.body)) || null;
      if (draft && o.warm) draft += `\n\nIf it's easier to talk it through, here's a link to grab 15 minutes: ${bookingLink(o.id)}`;
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'replied', text_consent: true, updated_at: now });
    } else if (routed.action === 'check_in' || routed.action === 'wait_for_return') {
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'replied', next_checkin_at: `${routed.nextDate}T15:00:00Z`, updated_at: now });
    } else if (routed.action === 'thank_and_close') {
      draft = `Thanks for letting me know, and all the best with ${o.business_name}.\n\nMarq`;
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'closed', updated_at: now });
    } else if (routed.action === 'do_not_contact') {
      const em = (input.from || o.to_email || '').toLowerCase().match(/[^\s<>]+@[^\s<>]+/)?.[0];
      if (em) await sb.insert('do_not_contact', { user_id: userId, email: em, domain: em.split('@')[1], reason: 'Asked to stop' }, { upsert: 'user_id,email', ignore: true }).catch(() => {});
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'dnc', updated_at: now });
    } else if (routed.action === 'save_referral') {
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'replied', updated_at: now });
    } else {
      await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'replied', updated_at: now });
    }
  }
  const [row] = await sb.insert<{ id: string }>('lead_replies', { user_id: userId, outreach_id: o?.id ?? null, from_email: input.from ?? null, body: input.body.slice(0, 6000), classification: c.classification, confidence: c.confidence, action: routed.action, action_state: routed.state, draft_reply: draft, referral: c.referral ?? null, return_date: c.return_date ?? routed.nextDate });
  if (['interested', 'question', 'needs_read'].includes(routed.action === 'needs_read' ? 'needs_read' : c.classification)) await notifyStored(sb, userId, 'lead_reply', { title: routed.action === 'needs_read' ? `Needs your read: ${o?.business_name ?? 'a reply'}` : `${o?.business_name ?? 'A lead'} replied: ${c.classification.replace('_', ' ')}`, body: routed.note, deepLink: 'lead-engines', priority: 'normal' }).catch(() => {});
  return { classification: c.classification, confidence: c.confidence, action: routed.action, note: routed.note, replyId: row?.id ?? null, sentBookingLink };
}

/** Marq corrects a classification: the reply is re-routed, and the correction is kept for the playbook. */
export async function correctReply(sb: Sb, userId: string, replyId: string, to: ReplyClass): Promise<void> {
  const [r] = await sb.get<{ classification: string; body: string }>(`lead_replies?user_id=eq.${userId}&id=eq.${replyId}&select=classification,body&limit=1`);
  if (!r) return;
  await sb.patch('lead_replies', `id=eq.${replyId}&user_id=eq.${userId}`, { corrected_to: to, action_state: 'done' });
  const name = 'Reply classification corrections';
  const line = `- A reply read as "${r.classification}" was really "${to}": "${r.body.replace(/\s+/g, ' ').slice(0, 200)}"`;
  const [pb] = await sb.get<{ id: string; body: string; version: number }>(`ai_playbooks?user_id=eq.${userId}&name=eq.${encodeURIComponent(name)}&select=id,body,version&limit=1`);
  if (pb) await sb.patch('ai_playbooks', `id=eq.${pb.id}`, { body: `${pb.body}\n${line}`.split('\n').slice(-40).join('\n'), version: pb.version + 1, updated_at: new Date().toISOString() });
  else await sb.insert('ai_playbooks', { user_id: userId, name, domain: 'marketing', body: line, version: 1 }).catch(() => {});
}
