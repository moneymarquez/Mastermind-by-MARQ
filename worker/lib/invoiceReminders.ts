// Invoice reminders (spec Part 4). At 3 and 7 days overdue the timer drafts a
// short, friendly reminder as an approval card; nothing reaches the client
// until Marq approves it. Covers both invoice kinds: Stripe client invoices
// (client_invoices, pay link = the Stripe hosted page) and Ledger invoices
// (biz_invoices, pay link = pay_url when set). Runs in its own
// /__tick/invoices invocation, a handful of rows per tick.
import type { Sb } from './sb';
import { zonedNow } from './sb';
import { sendMessage } from './madeby';
import type { MadebyEnv } from './madeby';
import { DEFAULT_SENDER } from '../../src/data/madeby';

const TZ = 'America/Denver';
const DAY = 86400000;
const PER_TICK = 5;
const now = () => new Date().toISOString();

/** Whole days between a due date and today (both YYYY-MM-DD). Pure. */
export const daysOverdue = (due: string | null | undefined, today: string): number =>
  !due ? 0 : Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due.slice(0, 10)}T00:00:00Z`)) / DAY);

/** Which reminder is due now: 7 once a week late, 3 once three days late, else null. Never repeats a stage. Pure. */
export function reminderStage(due: string | null | undefined, today: string, sentStage: number): 3 | 7 | null {
  const d = daysOverdue(due, today);
  if (d >= 7 && sentStage < 7) return 7;
  if (d >= 3 && sentStage < 3) return 3;
  return null;
}

/** The reminder itself: short, warm, one link. Pure. */
export function reminderEmail(o: { firstName: string; label: string; amount: number; due: string; days: number; payUrl: string | null; sender: string; stage: 3 | 7 }): { subject: string; body: string } {
  const amt = `$${o.amount.toFixed(2)}`;
  const subject = o.stage === 7 ? `Following up: ${o.label} (${amt})` : `Quick reminder: ${o.label}`;
  const pay = o.payUrl ? `\n\nYou can pay here: ${o.payUrl}` : '\n\nReply here and I can send a payment link.';
  const body = o.stage === 7
    ? `Hi ${o.firstName},\n\nFollowing up on ${o.label} for ${amt}, which was due ${o.due} (${o.days} days ago). If something's holding it up, just reply and we'll sort it out.${pay}\n\nThanks,\n${o.sender}`
    : `Hi ${o.firstName},\n\nA quick reminder that ${o.label} for ${amt} was due ${o.due}. If it's already on its way, thank you and please ignore this.${pay}\n\nThanks,\n${o.sender}`;
  return { subject, body };
}

interface Draft { table: 'client_invoices' | 'biz_invoices'; id: string; user_id: string; to: string | null; firstName: string; label: string; amount: number; due: string; reminder_stage: number; payUrl: string | null; client_id: string | null; contact_id: string | null }

/** Five-minute timer: mark late Stripe invoices overdue and draft due reminders as approval cards. */
export async function runInvoiceTick(sb: Sb): Promise<{ overdue: number; drafted: number }> {
  const today = zonedNow(TZ).date;
  // Status tracking: a sent Stripe invoice past its due date reads "overdue".
  const late = await sb.get<{ id: string }>(`client_invoices?status=eq.sent&due_date=lt.${today}&select=id&limit=50`).catch(() => []);
  if (late.length) await sb.patch('client_invoices', `id=in.(${late.map((r) => r.id).join(',')})`, { status: 'overdue', updated_at: now() }).catch(() => {});

  const cut = new Date(Date.parse(`${today}T00:00:00Z`) - 3 * DAY).toISOString().slice(0, 10);
  const [ci, bi] = await Promise.all([
    sb.get<{ id: string; user_id: string; client_id: string; description: string; invoice_number: number | null; amount: number; due_date: string; reminder_stage: number; stripe_invoice_url: string | null; crm_clients: { business_name: string; contact_name: string | null; contact_email: string | null } | null }>(
      `client_invoices?status=in.(sent,overdue)&due_date=lte.${cut}&reminder_stage=lt.7&select=id,user_id,client_id,description,invoice_number,amount,due_date,reminder_stage,stripe_invoice_url,crm_clients(business_name,contact_name,contact_email)&order=due_date.asc&limit=20`).catch(() => []),
    sb.get<{ id: string; user_id: string; number: string; to_name: string; to_email: string | null; amount_usd: number; due_date: string; reminder_stage: number; pay_url: string | null; client_id: string | null; contact_id: string | null }>(
      `biz_invoices?status=eq.sent&due_date=lte.${cut}&reminder_stage=lt.7&select=id,user_id,number,to_name,to_email,amount_usd,due_date,reminder_stage,pay_url,client_id,contact_id&order=due_date.asc&limit=20`).catch(() => []),
  ]);
  const drafts: Draft[] = [
    ...ci.map((r) => ({ table: 'client_invoices' as const, id: r.id, user_id: r.user_id, to: r.crm_clients?.contact_email ?? null, firstName: (r.crm_clients?.contact_name || r.crm_clients?.business_name || 'there').split(' ')[0], label: r.invoice_number ? `invoice #${r.invoice_number}` : `the invoice for ${r.description}`, amount: Number(r.amount), due: r.due_date, reminder_stage: r.reminder_stage, payUrl: r.stripe_invoice_url, client_id: r.client_id, contact_id: null })),
    ...bi.map((r) => ({ table: 'biz_invoices' as const, id: r.id, user_id: r.user_id, to: r.to_email, firstName: r.to_name.split(' ')[0] || 'there', label: `invoice ${r.number}`, amount: Number(r.amount_usd), due: r.due_date, reminder_stage: r.reminder_stage, payUrl: r.pay_url, client_id: r.client_id, contact_id: r.contact_id })),
  ];
  let drafted = 0;
  const senders = new Map<string, string>();
  for (const d of drafts) {
    if (drafted >= PER_TICK) break;
    const stage = reminderStage(d.due, today, d.reminder_stage);
    if (!stage) continue;
    if (!senders.has(d.user_id)) {
      const [bp] = await sb.get<{ sender_entity: string | null; business_name: string | null }>(`business_profile?user_id=eq.${d.user_id}&select=sender_entity,business_name`).catch(() => []);
      senders.set(d.user_id, bp?.sender_entity || bp?.business_name || DEFAULT_SENDER);
    }
    const days = daysOverdue(d.due, today);
    const mail = reminderEmail({ firstName: d.firstName, label: d.label, amount: d.amount, due: d.due, days, payUrl: d.payUrl, sender: senders.get(d.user_id)!, stage });
    // Mark the stage first so a crash between the two never drafts it twice.
    await sb.patch(d.table, `id=eq.${d.id}`, { reminder_stage: stage, updated_at: now() });
    await sb.insert('ai_approvals', {
      user_id: d.user_id, domain: 'marketing', type: 'invoice_reminder', entity_type: 'invoice', entity_id: d.id,
      title: `Send a ${stage}-day reminder: ${d.label} · $${d.amount.toFixed(2)}`,
      payload: { table: d.table, invoice_id: d.id, stage, days, to: d.to, subject: mail.subject, body: mail.body, pay_url: d.payUrl, client_id: d.client_id, contact_id: d.contact_id, summary: d.to ? `${days} days overdue. Approve to email ${d.to}.` : `${days} days overdue, but there's no email on file. Add one, then approve.` },
      is_money: false, confidence: 'hard',
    }).catch((e) => console.error('invoice reminder card', d.id, e));
    drafted++;
  }
  return { overdue: late.length, drafted };
}

/** Approved reminder card → send it (DRY_RUN still applies) and keep it in the client's thread. */
export async function sendInvoiceReminder(env: MadebyEnv, sb: Sb, u: string, p: Record<string, unknown>): Promise<{ ok: boolean; error?: string; status?: string }> {
  const to = typeof p.to === 'string' ? p.to : '';
  if (!to) return { ok: false, error: 'No email on file for this client.' };
  const table = p.table === 'biz_invoices' ? 'biz_invoices' : 'client_invoices';
  const [inv] = await sb.get<{ status: string }>(`${table}?id=eq.${String(p.invoice_id)}&user_id=eq.${u}&select=status`);
  if (!inv) return { ok: false, error: 'That invoice is gone.' };
  if (inv.status === 'paid' || inv.status === 'void') return { ok: true, status: `skipped_${inv.status}` };
  const r = await sendMessage(env, sb, u, { channel: 'email', to, subject: String(p.subject ?? 'Invoice reminder'), body: String(p.body ?? ''), client_id: typeof p.client_id === 'string' ? p.client_id : null, contact_id: typeof p.contact_id === 'string' ? p.contact_id : null, purpose: 'invoice' });
  return r.ok ? { ok: true, status: r.status } : { ok: false, error: r.error, status: r.status };
}
