import type { Sb } from '../sb';
import { notifyStored } from '../notify';
import { OWNER_USER_ID } from '../auth';
import { eventBusy, eventTimes, freeSlots, icsFor, isOpenSlot, slotLabel, type BookingSettings, type Busy, type Slot } from './slots';
import { sendMail, type MailEnv } from './mail';

export const DEFAULT_SETTINGS: BookingSettings & { title: string; calendly_url: string | null; owner_email: string | null } = {
  windows: [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '16:00', end: '19:00' })), days_off: [], slot_min: 15, timezone: 'America/Denver', title: 'Quick call with Marq', calendly_url: null, owner_email: null,
};
export type Settings = typeof DEFAULT_SETTINGS;
/** `/book/marq` is Marq's page. */
export const ownerForSlug = (slug: string): string | null => (slug === 'marq' ? OWNER_USER_ID : null);

export async function loadSettings(sb: Sb, userId: string): Promise<Settings> {
  const [r] = await sb.get<Partial<Settings>>(`booking_settings?user_id=eq.${userId}&select=*&limit=1`);
  return { ...DEFAULT_SETTINGS, ...(r ?? {}), windows: (r?.windows as Settings['windows']) ?? DEFAULT_SETTINGS.windows, days_off: (r?.days_off as string[]) ?? [] };
}
/** What's already taken: dated Schedule events and confirmed bookings. */
export async function loadBusy(sb: Sb, userId: string, s: Settings, now: Date, days = 21): Promise<Busy[]> {
  const from = new Date(now.getTime() - 86400000).toISOString().slice(0, 10), to = new Date(now.getTime() + (days + 1) * 86400000).toISOString().slice(0, 10);
  const [ev, bk] = await Promise.all([
    sb.get<{ type: string; event_date: string; start_time: string; end_time: string; status: string | null }>(`events?user_id=eq.${userId}&event_date=gte.${from}&event_date=lte.${to}&select=type,event_date,start_time,end_time,status`),
    sb.get<{ starts_at: string; ends_at: string }>(`lead_bookings?user_id=eq.${userId}&status=eq.booked&starts_at=gte.${now.toISOString()}&select=starts_at,ends_at`),
  ]);
  return [...ev.filter((e) => e.status !== 'cancelled').map((e) => eventBusy(e, s.timezone)), ...bk.map((b) => ({ start: b.starts_at, end: b.ends_at }))];
}
export async function slotsFor(sb: Sb, userId: string, now = new Date()): Promise<{ settings: Settings; slots: Slot[] }> {
  const settings = await loadSettings(sb, userId);
  return { settings, slots: freeSlots(settings, await loadBusy(sb, userId, settings, now), now, 14) };
}

export interface BookInput { token?: string; outreachId: string | null; startsAt: string; name: string; business?: string; phone?: string; email?: string }
export type BookResult = { ok: true; label: string; token: string } | { ok: false; status: number; error: string };

/** Book one slot: check it's still open, write the booking and the Schedule event, move the lead to "call booked" (callback), tell Marq, confirm to the lead. */
export async function createBooking(env: MailEnv, sb: Sb, userId: string, input: BookInput, now = new Date()): Promise<BookResult> {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, status: 400, error: 'Please add your name.' };
  if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, status: 400, error: 'Add a phone number or an email so Marq can reach you.' };
  const settings = await loadSettings(sb, userId);
  const busy = await loadBusy(sb, userId, settings, now);
  if (!isOpenSlot(settings, busy, now, input.startsAt)) return { ok: false, status: 409, error: 'That time was just taken. Please pick another.' };
  const startsAt = new Date(input.startsAt), endsAt = new Date(startsAt.getTime() + settings.slot_min * 60000);
  const [o] = input.outreachId ? await sb.get<{ id: string; lead_id: string | null; place_id: string | null; business_name: string; finding_summary: string | null }>(`lead_outreach?user_id=eq.${userId}&id=eq.${input.outreachId}&limit=1`) : [];
  const token = crypto.randomUUID().replace(/-/g, '');
  let booking: { id: string } | undefined;
  try {
    [booking] = await sb.insert<{ id: string }>('lead_bookings', { user_id: userId, lead_id: o?.lead_id ?? null, outreach_id: o?.id ?? null, token, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), name, business: input.business?.trim().slice(0, 160) || o?.business_name || null, phone: input.phone?.trim().slice(0, 40) || null, email: input.email?.trim().slice(0, 160) || null, finding: o?.finding_summary ?? null });
  } catch { return { ok: false, status: 409, error: 'That time was just taken. Please pick another.' }; }
  const t = eventTimes(startsAt.toISOString(), settings.slot_min, settings.timezone), business = input.business?.trim() || o?.business_name || name;
  const [ev] = await sb.insert<{ id: string }>('events', { user_id: userId, type: 'dialing', ...t, notes: `Booked call: ${name} (${business})${o?.finding_summary ? ` — ${o.finding_summary}` : ''}`, status: 'scheduled', details: { source: 'booking_page', booking_id: booking?.id, phone: input.phone ?? null, email: input.email ?? null, outreach_id: o?.id ?? null } }).catch(() => [] as { id: string }[]);
  if (ev && booking) await sb.patch('lead_bookings', `id=eq.${booking.id}`, { event_id: ev.id }).catch(() => {});
  if (o) await sb.patch('lead_outreach', `id=eq.${o.id}`, { status: 'booked', text_consent: true, updated_at: now.toISOString() }).catch(() => {});
  if (o?.lead_id) await sb.patch('leads', `id=eq.${o.lead_id}`, { status: 'callback', next_followup_at: startsAt.toISOString(), tag: 'call_booked', updated_at: now.toISOString() }).catch(() => {});
  const label = slotLabel(startsAt.toISOString(), settings.timezone);
  await notifyStored(sb, userId, 'lead_booked', { title: `Call booked: ${business}`, body: `${name} · ${label}${input.phone ? ` · ${input.phone}` : ''}`, deepLink: 'schedule', priority: 'high' }).catch(() => {});
  if (input.email) {
    await sendMail(env, { to: input.email.trim(), subject: `Your call with Marq: ${label}`, body: `Hi ${name.split(' ')[0]},\n\nYou're booked for a ${settings.slot_min}-minute call on ${label} (Mountain Time). Marq will call ${input.phone ? input.phone : 'you'}.\n\nThe invite is attached so it lands on your calendar. If something comes up, just reply to this email.\n\nMarq\nMade by Marq`, ics: icsFor({ uid: token, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), title: settings.title, description: `Call with Marq about ${business}` }) }, { ownerEmail: settings.owner_email, kind: 'service' }).catch(() => {});
  }
  return { ok: true, label, token };
}

/** One hour before each call: remind the lead (email) and Marq (push). */
export async function sendReminders(env: MailEnv, sb: Sb, userId: string, now = new Date()): Promise<number> {
  const rows = await sb.get<{ id: string; starts_at: string; name: string | null; business: string | null; email: string | null; phone: string | null }>(`lead_bookings?user_id=eq.${userId}&status=eq.booked&reminder_sent=eq.false&starts_at=gt.${now.toISOString()}&starts_at=lte.${new Date(now.getTime() + 65 * 60000).toISOString()}&select=id,starts_at,name,business,email,phone`);
  if (!rows.length) return 0;
  const settings = await loadSettings(sb, userId);
  for (const r of rows) {
    const label = slotLabel(r.starts_at, settings.timezone);
    await sb.patch('lead_bookings', `id=eq.${r.id}`, { reminder_sent: true });
    await notifyStored(sb, userId, 'lead_booked', { title: `Call in about an hour: ${r.business ?? r.name ?? ''}`, body: `${label}${r.phone ? ` · ${r.phone}` : ''}`, deepLink: 'schedule' }).catch(() => {});
    if (r.email) await sendMail(env, { to: r.email, subject: `Reminder: your call with Marq at ${label}`, body: `Hi ${(r.name ?? '').split(' ')[0] || 'there'},\n\nA quick reminder that Marq will call you in about an hour (${label}, Mountain Time).\n\nMarq` }, { ownerEmail: settings.owner_email, kind: 'service' }).catch(() => {});
  }
  return rows.length;
}
