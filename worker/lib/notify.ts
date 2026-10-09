// One notification service, three channels (brief §2e): web push, SMS
// (Twilio) and the in-app list (app_notifications). Every event has default
// channels, the user can change them per event (notify_prefs.channels), and
// quiet hours hold push/SMS back overnight — except a sale, which Marq wants
// whenever it happens. The in-app row is always written.
//
// SMS never approves anything on reply: it carries a deep link to the
// approval screen, because an approval should be a deliberate tap.
import { Sb, pushToUser, zonedNow } from './sb';
import type { SbEnv } from './sb';
import { sendTwilioSms } from './twilio';
import type { TwilioEnv } from './twilio';
import type { DryRunEnv } from './dryRun';

export type Channel = 'push' | 'sms' | 'inapp';
export type NotifyEvent =
  | 'product_pitch' | 'brand_directions' | 'store_preview' | 'post_batch' | 'sale_made'
  | 'worker_problem' | 'kill_switch' | 'contract_signed' | 'invoice_paid' | 'inbound_text'
  | 'task_due' | 'weekly_checkin' | 'money_move' | 'peptide_reminder' | 'feed_reactions' | 'hq_report';

export const EVENTS: { id: NotifyEvent; label: string; defaults: Channel[]; ignoresQuiet?: boolean }[] = [
  { id: 'product_pitch', label: 'Product pitch ready to approve', defaults: ['push', 'sms'] },
  { id: 'brand_directions', label: 'Brand directions ready to pick', defaults: ['push'] },
  { id: 'store_preview', label: 'Store preview ready to approve', defaults: ['push', 'sms'] },
  { id: 'post_batch', label: 'Post batch ready to approve', defaults: ['push'] },
  { id: 'sale_made', label: 'Sale made', defaults: ['push', 'sms'], ignoresQuiet: true },
  { id: 'worker_problem', label: 'Worker stalled, failed or hit a cap', defaults: ['push'] },
  { id: 'kill_switch', label: 'Kill switch toggled', defaults: ['push'] },
  { id: 'contract_signed', label: 'Contract signed', defaults: ['push'] },
  { id: 'invoice_paid', label: 'Invoice paid', defaults: ['push'] },
  { id: 'inbound_text', label: 'Inbound client text', defaults: ['push'] },
  { id: 'task_due', label: 'Task due', defaults: ['push'] },
  { id: 'weekly_checkin', label: 'Weekly check-in ready', defaults: ['push'] },
  { id: 'money_move', label: 'This week\'s Money Move', defaults: ['push'] },
  { id: 'peptide_reminder', label: 'Peptide reminder', defaults: ['push'] },
  { id: 'feed_reactions', label: 'Reactions on your wins', defaults: ['push'] },
  { id: 'hq_report', label: 'HQ morning report', defaults: ['push'] },
];

export interface NotifyPrefs { channels: Partial<Record<NotifyEvent, Channel[]>>; quiet_start: string; quiet_end: string; timezone: string; sms_to: string | null }
export const DEFAULT_PREFS: NotifyPrefs = { channels: {}, quiet_start: '22:00', quiet_end: '07:00', timezone: 'America/Denver', sms_to: null };

const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
/** Quiet hours may wrap midnight (22:00 → 07:00). */
export function inQuietHours(nowMinutes: number, start: string, end: string): boolean {
  const s = mins(start), e = mins(end);
  if (s === e) return false;
  return s < e ? nowMinutes >= s && nowMinutes < e : nowMinutes >= s || nowMinutes < e;
}

/** Which channels a notification goes out on right now. Pure. */
export function planDelivery(event: NotifyEvent, prefs: NotifyPrefs, nowMinutes: number, priority: 'low' | 'normal' | 'high' = 'normal'): { channels: Channel[]; held: Channel[] } {
  const def = EVENTS.find((e) => e.id === event);
  const wanted = (prefs.channels[event] ?? def?.defaults ?? ['push']).filter((c) => c !== 'inapp');
  const quiet = inQuietHours(nowMinutes, prefs.quiet_start, prefs.quiet_end) && !def?.ignoresQuiet && priority !== 'high';
  const held = quiet ? wanted : [];
  return { channels: ['inapp', ...(quiet ? [] : wanted)], held };
}

/** One SMS line: title, body, and the deep link to tap. */
export function smsText(title: string, body: string | undefined, deepLink: string | undefined, origin = 'https://mastermindsbymarq.com'): string {
  const link = deepLink ? (deepLink.startsWith('http') ? deepLink : `${origin}/?screen=${encodeURIComponent(deepLink)}`) : '';
  return [title, body, link].filter(Boolean).join('\n').slice(0, 480);
}

export type NotifyEnv = SbEnv & TwilioEnv & DryRunEnv & { DIGEST_TO_NUMBER?: string };
export interface NotifyInput { title: string; body?: string; deepLink?: string; priority?: 'low' | 'normal' | 'high' }

export async function loadPrefs(sb: Sb, u: string): Promise<NotifyPrefs> {
  const [row] = await sb.get<Partial<NotifyPrefs>>(`notify_prefs?user_id=eq.${u}&select=channels,quiet_start,quiet_end,timezone,sms_to`);
  return row ? { channels: row.channels ?? {}, quiet_start: (row.quiet_start ?? '22:00').slice(0, 5), quiet_end: (row.quiet_end ?? '07:00').slice(0, 5), timezone: row.timezone ?? 'America/Denver', sms_to: row.sms_to ?? null } : { ...DEFAULT_PREFS };
}

/** Send one notification. Never throws: a broken channel is recorded on the in-app row. */
export async function notify(env: NotifyEnv, sb: Sb, u: string, event: NotifyEvent, msg: NotifyInput): Promise<{ channels: Channel[]; delivery: Record<string, string> }> {
  const prefs = await loadPrefs(sb, u).catch(() => ({ ...DEFAULT_PREFS }));
  const plan = planDelivery(event, prefs, zonedNow(prefs.timezone).minutes, msg.priority);
  const delivery: Record<string, string> = {};
  if (plan.channels.includes('push')) {
    const r = await pushToUser(env, sb, u, msg.title, msg.body ?? '', msg.deepLink ? `/?screen=${encodeURIComponent(msg.deepLink)}` : '/').catch((e) => ({ sent: 0, error: String(e) }));
    delivery.push = r.sent ? `sent to ${r.sent}` : `not sent: ${r.error ?? 'no devices'}`;
  }
  if (plan.channels.includes('sms')) {
    const to = prefs.sms_to ?? env.DIGEST_TO_NUMBER;
    const r = to ? await sendTwilioSms(env, to, smsText(msg.title, msg.body, msg.deepLink)) : { sent: false, error: 'No phone number on file.' };
    delivery.sms = r.sent ? (r.dryRun ? 'dry run' : 'sent') : `not sent: ${r.error}`;
    if (to) await sb.insert('sms_messages', { user_id: u, direction: 'out', counterpart: to, body: smsText(msg.title, msg.body, msg.deepLink), provider: 'notify', status: r.sent ? 'sent' : 'failed', error: r.sent ? null : r.error ?? null, dry_run: !!r.dryRun }).catch(() => {});
  }
  if (plan.held.length) delivery.held = `quiet hours: ${plan.held.join(', ')}`;
  await sb.insert('app_notifications', { user_id: u, event, title: msg.title.slice(0, 200), body: msg.body?.slice(0, 1000) ?? null, deep_link: msg.deepLink ?? null, priority: msg.priority ?? 'normal', channels: plan.channels, delivery }).catch((e) => console.error('app_notifications', e));
  return { channels: plan.channels, delivery };
}

// Runners (worker engine jobs) only get the Anthropic key; the Worker hands
// notify its env once per request/tick so jobs can still alert Marq.
let storedEnv: NotifyEnv | null = null;
export function setNotifyEnv(env: NotifyEnv): void { storedEnv = env; }
export async function notifyStored(sb: Sb, u: string, event: NotifyEvent, msg: NotifyInput): Promise<void> {
  if (!storedEnv) { await sb.insert('app_notifications', { user_id: u, event, title: msg.title.slice(0, 200), body: msg.body ?? null, deep_link: msg.deepLink ?? null, priority: msg.priority ?? 'normal', channels: ['inapp'] }).catch(() => {}); return; }
  await notify(storedEnv, sb, u, event, msg).catch((e) => console.error('notify', e));
}

/** Which approvals ping Marq the moment a worker files them, and where the link goes. */
export const APPROVAL_EVENTS: Record<string, { event: NotifyEvent; link: string; verb: string }> = {
  product_pitch: { event: 'product_pitch', link: 'ecom-approvals', verb: 'Product pitch ready' },
  brand_options: { event: 'brand_directions', link: 'ecom-approvals', verb: 'Brand directions ready to pick' },
  store_draft: { event: 'store_preview', link: 'ecom-approvals', verb: 'Store preview ready to approve' },
  post_plan: { event: 'post_batch', link: 'content', verb: 'Posts ready to approve' },
  content_plan: { event: 'post_batch', link: 'content', verb: 'Post batch ready to approve' },
  content_kit: { event: 'post_batch', link: 'content', verb: 'Content kit ready for a new brand' },
};
