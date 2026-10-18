// October build, Phase 5: the server side of Made by Marq.
//
//   sendMessage        Comms hub: email (Resend) or SMS (Twilio), saved forever; DRY_RUN aware
//   runCommsTick       5-minute cron: scheduled sends + people-list sequences
//   sendContract       email a signing link; signContract / viewContract (public, by token)
//   sendBizInvoice     invoice anyone; recurring monthly copies
//   runLedgerDaily     recurring income/expenses land unconfirmed for Marq to confirm
//   marketingPlan      the Marketing orchestrator's weekly plan for Our Brands
import type { Sb } from './sb';
import { senderFor } from './senders';
import type { SendPurpose } from './senders';
import { zonedNow } from './sb';
import { isDryRun, dryRunId } from './dryRun';
import type { DryRunEnv } from './dryRun';
import { sendTwilioSms } from './twilio';
import type { TwilioEnv } from './twilio';
import { ask } from './ai';
import { ROLE_MODEL } from './models';
import { extractJson } from './scout';
import { notifyStored } from './notify';
import { dueRecurring, renderMessage, nextSequenceAt, IDEA_BANK, DEFAULT_SENDER } from '../../src/data/madeby';
import type { SeqStep } from '../../src/data/madeby';

export interface MadebyEnv extends DryRunEnv, TwilioEnv { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; MADEBYMARQUEZ_FROM_EMAIL?: string; APP_ORIGIN?: string; ANTHROPIC_API_KEY?: string }
const TZ = 'America/Denver';
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const now = () => new Date().toISOString();

/** Plain text → simple safe email HTML. Pure. */
export function emailHtml(body: string, footer?: string): string {
  const paras = esc(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('');
  return `<div style="font:15px/1.55 -apple-system,Segoe UI,sans-serif;color:#111;max-width:600px">${paras}${footer ? `<p style="color:#888;font-size:12px;margin-top:24px">${esc(footer)}</p>` : ''}</div>`;
}

export async function sendEmail(env: MadebyEnv, to: string, subject: string, html: string, purpose: SendPurpose = 'comms'): Promise<{ ok: boolean; id?: string; error?: string; dryRun?: boolean }> {
  if (!EMAIL_RE.test(to)) return { ok: false, error: 'That email address doesn\'t look right.' };
  if (isDryRun(env)) return { ok: true, id: dryRunId('email'), dryRun: true };
  const from = senderFor(env, purpose);
  if (!env.RESEND_API_KEY || !from) return { ok: false, error: 'Email isn\'t connected. Setup → Resend.' };
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 200), html }) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.message ?? `Email failed (${r.status})` };
}

export interface SendInput { channel: 'email' | 'sms'; to: string; subject?: string | null; body: string; contact_id?: string | null; client_id?: string | null; scheduled_for?: string | null; attachments?: { doc_id?: string; name: string }[]; sequence_run_id?: string | null; purpose?: SendPurpose }
/** Send (or schedule) one message and keep it in the thread. */
export async function sendMessage(env: MadebyEnv, sb: Sb, u: string, m: SendInput): Promise<{ ok: boolean; id?: string; status: string; error?: string }> {
  if (!m.to?.trim() || !m.body?.trim()) return { ok: false, status: 'failed', error: 'A recipient and a message are required.' };
  const base = { user_id: u, contact_id: m.contact_id ?? null, client_id: m.client_id ?? null, channel: m.channel, direction: 'out', to_addr: m.to.trim(), subject: m.subject ?? null, body: m.body.slice(0, 20000), attachments: m.attachments ?? [], sequence_run_id: m.sequence_run_id ?? null };
  if (m.scheduled_for && Date.parse(m.scheduled_for) > Date.now() + 60000) {
    const [row] = await sb.insert<{ id: string }>('comm_messages', { ...base, status: 'scheduled', scheduled_for: m.scheduled_for });
    return { ok: true, id: row?.id, status: 'scheduled' };
  }
  const r = await deliver(env, sb, base.channel, base.to_addr, base.subject, base.body, base.attachments, m.purpose);
  const [row] = await sb.insert<{ id: string }>('comm_messages', { ...base, status: r.dryRun ? 'dry_run' : r.ok ? 'sent' : 'failed', sent_at: r.ok ? now() : null, error: r.error ?? null, external_id: r.id ?? null });
  if (r.ok) await touchContact(sb, u, m.contact_id, m.client_id);
  return { ok: r.ok, id: row?.id, status: r.dryRun ? 'dry_run' : r.ok ? 'sent' : 'failed', error: r.error };
}

async function deliver(env: MadebyEnv, sb: Sb, channel: 'email' | 'sms', to: string, subject: string | null, body: string, attachments: { doc_id?: string; name: string }[], purpose: SendPurpose = 'comms'): Promise<{ ok: boolean; id?: string; error?: string; dryRun?: boolean }> {
  if (channel === 'sms') { const r = await sendTwilioSms(env, to, body); return { ok: r.sent, id: r.sid, error: r.error, dryRun: r.dryRun }; }
  // Brain Dump documents go along as their text, inline (no binary attachments yet).
  let extra = '';
  for (const a of attachments) if (a.doc_id) { const [d] = await sb.get<{ title: string; body_text: string | null }>(`brain_documents?id=eq.${a.doc_id}&select=title,body_text`).catch(() => []); if (d?.body_text) extra += `\n\n— ${d.title} —\n${d.body_text.slice(0, 20000)}`; }
  return sendEmail(env, to, subject || '(no subject)', emailHtml(body + extra), purpose);
}

async function touchContact(sb: Sb, u: string, contactId?: string | null, clientId?: string | null) {
  if (contactId) await sb.patch('contacts', `id=eq.${contactId}&user_id=eq.${u}`, { last_contact_at: now() }).catch(() => {});
  if (clientId) await sb.patch('crm_clients', `id=eq.${clientId}&user_id=eq.${u}`, { last_contact_at: now() }).catch(() => {});
}

/** Inbound email/SMS from a known contact lands in their thread. */
export async function recordInbound(sb: Sb, u: string, m: { channel: 'email' | 'sms'; from: string; to?: string | null; subject?: string | null; body: string; external_id?: string | null }): Promise<void> {
  const from = m.from.trim().toLowerCase();
  const filter = m.channel === 'email' ? `email=ilike.${encodeURIComponent(from)}` : `phone=eq.${encodeURIComponent(m.from)}`;
  const [c] = await sb.get<{ id: string }>(`contacts?user_id=eq.${u}&${filter}&select=id&limit=1`).catch(() => []);
  const [cl] = m.channel === 'email' ? await sb.get<{ id: string }>(`crm_clients?user_id=eq.${u}&contact_email=ilike.${encodeURIComponent(from)}&select=id&limit=1`).catch(() => []) : [];
  if (!c && !cl) return;
  await sb.insert('comm_messages', { user_id: u, contact_id: c?.id ?? null, client_id: cl?.id ?? null, channel: m.channel, direction: 'in', from_addr: m.from, to_addr: m.to ?? null, subject: m.subject ?? null, body: m.body.slice(0, 20000), status: 'received', sent_at: now(), external_id: m.external_id ?? null }).catch(() => {});
  await touchContact(sb, u, c?.id, cl?.id);
}

/** Scheduled sends that are due, and the next step of every active sequence. */
export async function runCommsTick(env: MadebyEnv, sb: Sb): Promise<{ sent: number; steps: number }> {
  let sent = 0, steps = 0;
  const due = await sb.get<{ id: string; user_id: string; channel: 'email' | 'sms'; to_addr: string; subject: string | null; body: string; attachments: { doc_id?: string; name: string }[]; contact_id: string | null; client_id: string | null }>(`comm_messages?status=eq.scheduled&scheduled_for=lte.${now()}&select=id,user_id,channel,to_addr,subject,body,attachments,contact_id,client_id&limit=50`).catch(() => []);
  for (const m of due) {
    await sb.patch('comm_messages', `id=eq.${m.id}&status=eq.scheduled`, { status: 'sending' });
    const r = await deliver(env, sb, m.channel, m.to_addr, m.subject, m.body, m.attachments ?? []);
    await sb.patch('comm_messages', `id=eq.${m.id}`, { status: r.dryRun ? 'dry_run' : r.ok ? 'sent' : 'failed', sent_at: r.ok ? now() : null, error: r.error ?? null, external_id: r.id ?? null });
    if (r.ok) { sent++; await touchContact(sb, m.user_id, m.contact_id, m.client_id); }
  }
  const runs = await sb.get<{ id: string; user_id: string; sequence_id: string; contact_id: string; step: number; comm_sequences: { steps: SeqStep[]; active: boolean } | null; contacts: { name: string; email: string | null; phone: string | null } | null }>(`comm_sequence_runs?status=eq.active&next_at=lte.${now()}&select=id,user_id,sequence_id,contact_id,step,comm_sequences(steps,active),contacts(name,email,phone)&limit=50`).catch(() => []);
  for (const r of runs) {
    const seq = r.comm_sequences, c = r.contacts;
    const s = seq?.steps?.[r.step];
    if (!seq?.active || !s || !c) { await sb.patch('comm_sequence_runs', `id=eq.${r.id}`, { status: 'done' }); continue; }
    const to = s.channel === 'email' ? c.email : c.phone;
    const vars = { first_name: c.name.split(' ')[0], name: c.name, link: env.APP_ORIGIN ?? 'https://mastermindsbymarq.com', packet_link: `${env.APP_ORIGIN ?? ''}/jobs`, loom_link: 'https://www.loom.com' };
    if (to) { await sendMessage(env, sb, r.user_id, { channel: s.channel, to, subject: s.subject ? renderMessage(s.subject, vars) : null, body: renderMessage(s.body, vars), contact_id: r.contact_id, sequence_run_id: r.id }); steps++; }
    const next = nextSequenceAt(seq.steps, r.step + 1, new Date());
    await sb.patch('comm_sequence_runs', `id=eq.${r.id}`, next ? { step: r.step + 1, next_at: next.toISOString() } : { step: r.step + 1, status: 'done' });
  }
  return { sent, steps };
}

/** Owner: adding a contact to a list starts that list's sequence. */
export async function startSequencesFor(sb: Sb, u: string, contactId: string, listName: string): Promise<number> {
  const seqs = await sb.get<{ id: string; steps: SeqStep[] }>(`comm_sequences?user_id=eq.${u}&active=eq.true&list_name=eq.${encodeURIComponent(listName)}&select=id,steps`).catch(() => []);
  for (const s of seqs) await sb.insert('comm_sequence_runs', { user_id: u, sequence_id: s.id, contact_id: contactId, step: 0, next_at: new Date(Date.now() + (s.steps[0]?.delay_days ?? 0) * 86400000).toISOString() }, { upsert: 'sequence_id,contact_id', ignore: true }).catch(() => {});
  return seqs.length;
}

// ── Contracts ─────────────────────────────────────────────────────────
export async function sendContract(env: MadebyEnv, sb: Sb, u: string, id: string, origin: string): Promise<{ ok: boolean; status: string; link?: string; error?: string }> {
  const [c] = await sb.get<{ id: string; title: string; to_name: string; to_email: string | null; sign_token: string; contact_id: string | null; client_id: string | null; sender_entity: string | null }>(`contracts?id=eq.${id}&user_id=eq.${u}&select=id,title,to_name,to_email,sign_token,contact_id,client_id,sender_entity`);
  if (!c) return { ok: false, status: 'missing', error: 'That contract is gone.' };
  if (!c.to_email) return { ok: false, status: 'no_email', error: 'Add the signer\'s email first.' };
  const link = `${env.APP_ORIGIN ?? origin}/sign/${c.sign_token}`;
  const body = `Hi ${c.to_name.split(' ')[0]},\n\n${c.sender_entity ?? DEFAULT_SENDER} sent you "${c.title}" to review and sign.\n\nRead and sign here: ${link}\n\nIt takes a minute: read it, type your full name, and agree to sign electronically.`;
  const r = await sendMessage(env, sb, u, { channel: 'email', to: c.to_email, subject: `Please sign: ${c.title}`, body, contact_id: c.contact_id, client_id: c.client_id, purpose: 'contract' });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  await sb.patch('contracts', `id=eq.${id}`, { status: 'sent', sent_at: now(), updated_at: now() });
  return { ok: true, status: r.status, link };
}

/** Signed record: the exact text, who, when, from where. Pure. */
export function signedHtml(c: { title: string; body_html: string; sender_entity: string | null }, sig: { name: string; at: string; ip: string; agent: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.title)} — signed</title><style>body{font:15px/1.6 Georgia,serif;color:#111;max-width:760px;margin:40px auto;padding:0 24px}.sig{border-top:2px solid #111;margin-top:40px;padding-top:16px;font-family:-apple-system,Segoe UI,sans-serif;font-size:13px}</style></head><body>${c.body_html}<div class="sig"><div><strong>Signed electronically by:</strong> ${esc(sig.name)}</div><div><strong>Date/time (UTC):</strong> ${esc(sig.at)}</div><div><strong>IP address:</strong> ${esc(sig.ip)}</div><div><strong>Device:</strong> ${esc(sig.agent.slice(0, 200))}</div><div><strong>Sender:</strong> ${esc(c.sender_entity ?? DEFAULT_SENDER)}</div><div>The signer checked "I agree to sign electronically" before signing.</div></div></body></html>`;
}
/** Minimal markdown → HTML for contract bodies (headings, bold, paragraphs). Pure. */
export function mdToHtml(md: string): string {
  return esc(md).split(/\n{2,}/).map((b) => {
    const t = b.trim();
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
    return `<p>${t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

export async function viewContract(sb: Sb, token: string): Promise<{ title: string; html: string; status: string; to_name: string; sender: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [c] = await sb.get<{ id: string; title: string; body: string; status: string; to_name: string; sender_entity: string | null; viewed_at: string | null }>(`contracts?sign_token=eq.${token}&select=id,title,body,status,to_name,sender_entity,viewed_at`);
  if (!c) return null;
  if (!c.viewed_at && c.status === 'sent') await sb.patch('contracts', `id=eq.${c.id}`, { status: 'viewed', viewed_at: now() });
  return { title: c.title, html: mdToHtml(c.body), status: c.status === 'sent' ? 'viewed' : c.status, to_name: c.to_name, sender: c.sender_entity ?? DEFAULT_SENDER };
}

export async function signContract(sb: Sb, token: string, sig: { name: string; agree: boolean; decline?: boolean; ip: string; agent: string }): Promise<{ ok: boolean; error?: string; status?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: 'Bad link.' };
  const [c] = await sb.get<{ id: string; user_id: string; title: string; body: string; status: string; sender_entity: string | null; project: string | null; contact_id: string | null; to_name: string }>(`contracts?sign_token=eq.${token}&select=id,user_id,title,body,status,sender_entity,project,contact_id,to_name`);
  if (!c) return { ok: false, error: 'This contract link isn\'t valid.' };
  if (c.status === 'signed' || c.status === 'declined') return { ok: false, error: `This contract was already ${c.status}.` };
  if (sig.decline) {
    await sb.patch('contracts', `id=eq.${c.id}`, { status: 'declined', declined_at: now(), updated_at: now() });
    await notifyStored(sb, c.user_id, 'contract_signed', { title: `Declined: ${c.title}`, body: `${c.to_name} declined to sign.`, deepLink: 'contracts' });
    return { ok: true, status: 'declined' };
  }
  const name = sig.name.trim();
  if (name.length < 3 || !sig.agree) return { ok: false, error: 'Type your full name and check the box to sign.' };
  const at = now();
  const html = signedHtml({ title: c.title, body_html: mdToHtml(c.body), sender_entity: c.sender_entity }, { name, at, ip: sig.ip, agent: sig.agent });
  const [doc] = await sb.insert<{ id: string }>('brain_documents', { user_id: c.user_id, title: `${c.title} (signed ${at.slice(0, 10)})`, category: c.project || 'Made by Marq', mime: 'text/html', body_text: html, file_name: `${c.title.replace(/[^\w]+/g, '-')}-signed.html` }).catch(() => [] as { id: string }[]);
  await sb.patch('contracts', `id=eq.${c.id}`, { status: 'signed', signed_at: at, signer_name: name.slice(0, 200), signer_ip: sig.ip.slice(0, 80), signer_agent: sig.agent.slice(0, 300), signed_html: html, document_id: doc?.id ?? null, updated_at: at });
  await notifyStored(sb, c.user_id, 'contract_signed', { title: `Signed: ${c.title}`, body: `${name} signed it.`, deepLink: 'contracts' });
  return { ok: true, status: 'signed' };
}

// ── Invoices to anyone + ledger ───────────────────────────────────────
export async function sendBizInvoice(env: MadebyEnv, sb: Sb, u: string, id: string): Promise<{ ok: boolean; status: string; error?: string }> {
  const [inv] = await sb.get<{ id: string; number: string; to_name: string; to_email: string | null; items: { description: string; qty: number; rate: number }[]; amount_usd: number; due_date: string | null; contact_id: string | null; client_id: string | null; note: string | null }>(`biz_invoices?id=eq.${id}&user_id=eq.${u}&select=*`);
  if (!inv) return { ok: false, status: 'missing', error: 'That invoice is gone.' };
  if (!inv.to_email) return { ok: false, status: 'no_email', error: 'Add an email to send it to.' };
  const [bp] = await sb.get<{ sender_entity: string | null; business_name: string | null }>(`business_profile?user_id=eq.${u}&select=sender_entity,business_name`).catch(() => []);
  const sender = bp?.sender_entity || bp?.business_name || DEFAULT_SENDER;
  const lines = inv.items.map((i) => `${i.description} — ${i.qty} × $${Number(i.rate).toFixed(2)} = $${(i.qty * i.rate).toFixed(2)}`).join('\n');
  const body = `Hi ${inv.to_name.split(' ')[0]},\n\nInvoice ${inv.number} from ${sender}.\n\n${lines}\n\nTotal: $${Number(inv.amount_usd).toFixed(2)}${inv.due_date ? `\nDue: ${inv.due_date}` : ''}${inv.note ? `\n\n${inv.note}` : ''}\n\nThank you.`;
  const r = await sendMessage(env, sb, u, { channel: 'email', to: inv.to_email, subject: `Invoice ${inv.number} from ${sender}`, body, contact_id: inv.contact_id, client_id: inv.client_id, purpose: 'invoice' });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  await sb.patch('biz_invoices', `id=eq.${id}`, { status: 'sent', sent_at: now(), updated_at: now() });
  return { ok: true, status: r.status };
}

const addMonth = (d: string) => { const [y, m, day] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m, Math.min(day, 28))); return t.toISOString().slice(0, 10); };
/** Daily: recurring ledger rows (unconfirmed) and next copies of monthly invoices. */
export async function runLedgerDaily(sb: Sb): Promise<{ added: number; invoices: number }> {
  const today = zonedNow(TZ).date;
  const rec = await sb.get<{ id: string; user_id: string; kind: 'income' | 'expense'; party: string; amount_usd: number; category: string; day_of_month: number; active: boolean; last_month: string | null }>('ledger_recurring?active=eq.true&select=*&limit=1000').catch(() => []);
  let added = 0;
  for (const r of dueRecurring(rec, today)) {
    await sb.insert('biz_ledger', { user_id: r.user_id, kind: r.kind, amount_usd: r.amount_usd, date: today, category: r.category, party: r.party, auto: true, recurring_key: r.id, confirmed: false, note: 'Recurring — confirm it came in' });
    await sb.patch('ledger_recurring', `id=eq.${r.id}`, { last_month: today.slice(0, 7) });
    added++;
  }
  const monthly = await sb.get<{ id: string; user_id: string; number: string; to_name: string; to_email: string | null; contact_id: string | null; client_id: string | null; items: unknown; amount_usd: number; next_issue_date: string; note: string | null }>(`biz_invoices?recurring=eq.monthly&status=neq.void&next_issue_date=lte.${today}&select=id,user_id,number,to_name,to_email,contact_id,client_id,items,amount_usd,next_issue_date,note&limit=200`).catch(() => []);
  for (const m of monthly) {
    await sb.insert('biz_invoices', { user_id: m.user_id, number: `${m.number.replace(/-\d{4}-\d{2}$/, '')}-${today.slice(0, 7)}`, to_name: m.to_name, to_email: m.to_email, contact_id: m.contact_id, client_id: m.client_id, items: m.items, amount_usd: m.amount_usd, issue_date: today, due_date: addMonth(today).slice(0, 8) + '15', status: 'draft', parent_id: m.id, note: m.note });
    await sb.patch('biz_invoices', `id=eq.${m.id}`, { next_issue_date: addMonth(m.next_issue_date) });
    await notifyStored(sb, m.user_id, 'invoice_paid', { title: `This month's invoice to ${m.to_name} is ready`, body: 'Drafted from your recurring invoice. Review and send.', deepLink: 'ledger' });
  }
  return { added, invoices: monthly.length };
}

/** Paid invoice → Ledger income (once). */
export async function invoicePaidToLedger(sb: Sb, u: string, ref: { type: 'biz_invoice' | 'client_invoice' | 'stripe'; id: string; amount: number; party: string; date?: string; category?: string }): Promise<void> {
  const have = await sb.get<{ id: string }>(`biz_ledger?user_id=eq.${u}&ref_type=eq.${ref.type}&ref_id=eq.${encodeURIComponent(ref.id)}&select=id`).catch(() => []);
  if (have.length) return;
  await sb.insert('biz_ledger', { user_id: u, kind: 'income', amount_usd: ref.amount, date: ref.date ?? zonedNow(TZ).date, category: ref.category ?? 'client', party: ref.party, auto: true, ref_type: ref.type, ref_id: ref.id }).catch(() => {});
}

// ── Marketing orchestrator: weekly plan for Our Brands ───────────────
/** The planner's instructions for ONE brand of any type (product, app, business or client). Pure. */
export function marketingPlanSystem(brandCtx: string, paidAllowed: boolean): string {
  return [
    'You are the Marketing orchestrator. You plan one week of marketing for exactly one brand:',
    brandCtx,
    'Use the account numbers, how the success number is moving, the budget left this month and the idea bank. Pick which hooks go on which account on which day (unique variants per account, never the same post twice). Every post should point toward the success measure above.',
    paidAllowed
      ? 'You may suggest at most one small paid test that fits the budget left.'
      : 'Paid promotion is switched OFF for this brand until it has made a real sale: paid_test must be null. Organic only.',
    'Say where the next $20 should go and why, from the numbers (or "organic only for now" if paid is off). Be specific and short. Never invent numbers.',
    'Answer ONLY with JSON: {"posts":[{"day":"Mon","account":"@handle","hook":"","format":"reel|carousel|story","why":""}],"paid_test":{"channel":"","amount_usd":0,"why":""}|null,"next_20":"","focus":"one sentence"}',
  ].join('\n');
}
/** Keep the model honest: no paid test when it's off, and never more than the budget left. Pure. */
export function finalizePlan(plan: Record<string, unknown>, opts: { paidAllowed: boolean; budgetLeft: number }): Record<string, unknown> {
  const t = plan.paid_test as { amount_usd?: number } | null | undefined;
  if (!opts.paidAllowed || !t || !(Number(t.amount_usd) > 0) || Number(t.amount_usd) > opts.budgetLeft) return { ...plan, paid_test: null };
  return plan;
}
export interface PlanFacts { brand_key?: string; brand?: string; accounts: string[]; funnel: string; budgetLeft: number; nextTwenty: string; ideas: string[]; paidAllowed?: boolean }
export async function marketingPlan(apiKey: string | undefined, sb: Sb, u: string, facts: PlanFacts): Promise<{ id?: string; plan: Record<string, unknown>; brand_key: string }> {
  const date = zonedNow(TZ).date;
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const week = new Date(Date.parse(`${date}T12:00:00Z`) + ((8 - dow) % 7 || 7) * 86400000).toISOString().slice(0, 10);
  const brandKey = /^(product|app|business|client):[A-Za-z0-9_-]{1,64}$/.test(facts.brand_key ?? '') ? facts.brand_key! : 'app:masterminds';
  const paidAllowed = facts.paidAllowed !== false;
  const ctx = (facts.brand ?? 'Brand: Masterminds by MARQ (app)\nAudience: people building something while working a job\nGoal: grow the waitlist').slice(0, 1200);
  const res = await ask(apiKey, sb, { model: ROLE_MODEL.domain, system: marketingPlanSystem(ctx, paidAllowed), user: [`Week starting ${week}.`, `Accounts:\n${facts.accounts.join('\n') || '(none connected yet)'}`, `Success number: ${facts.funnel}`, `Marketing budget left this month: $${facts.budgetLeft.toFixed(2)}`, `Spend so far says: ${facts.nextTwenty}`, `Idea bank:\n${(facts.ideas.length ? facts.ideas : IDEA_BANK).slice(0, 25).map((i) => `- ${i}`).join('\n')}`].join('\n\n'), maxTokens: 2500, domain: 'marketing', userId: u, date });
  const plan = finalizePlan(extractJson(res.text) as Record<string, unknown>, { paidAllowed, budgetLeft: facts.budgetLeft });
  const [row] = await sb.insert<{ id: string }>('mkt_brand_plans', { user_id: u, brand_key: brandKey, week_start: week, plan }, { upsert: 'user_id,brand_key,week_start' });
  return { id: row?.id, plan, brand_key: brandKey };
}
