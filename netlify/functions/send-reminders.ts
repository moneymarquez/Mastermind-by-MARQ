import type { Config } from '@netlify/functions';
import webpush from 'web-push';
import { STORE_HOURS } from '../../src/data/shiftChecklist';

// Same store-clock caveat as send-shift-reminders.ts: this function runs on
// Netlify's own clock (UTC), not the store's — STORE_TIMEZONE must be set
// correctly in env vars or every notification below fires at the wrong
// wall-clock time. See send-shift-reminders.ts for the fuller explanation.
const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'America/Chicago';

// Real closed-app delivery via the same web-push/VAPID backend as
// send-shift-reminders.ts — not foreground-only. The one remaining gap is
// iOS Safari requiring the app be installed to the home screen before it
// allows push at all (see src/lib/pwa.ts / the "Installing as a PWA"
// README section) — that's a platform rule, not something this function
// can work around; if push ever needs to reach non-installed iOS Safari
// tabs too, that's a native-app-wrapper problem, not a code fix here.

function nowInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function atTime(dateStr: string, hhmm: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMinutes(timeToMinutes(hhmm));
  return d;
}
function clockLabel(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function classifyShift(startMin: number, endMin: number, openMin: number, closeMin: number): string {
  if (Math.abs(startMin - openMin) <= 60) return 'Opening';
  if (Math.abs(endMin - closeMin) <= 60) return 'Closing';
  return 'Shift';
}
function eventLabel(details: Record<string, unknown>, type: string): string {
  if (type === 'dialing') {
    const name = `${details.first_name ?? ''} ${details.last_name ?? ''}`.toString().trim();
    return name || 'Dialing appt';
  }
  return (details.business_name as string) || (details.contact_name as string) || 'Scalez appt';
}

interface PushSubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface EventRow { id: string; user_id: string; type: string; event_date: string; start_time: string; end_time: string; details: Record<string, unknown> }
interface ReminderRow { id: string; user_id: string; title: string; due_date: string; due_time: string | null }
interface MealRow { user_id: string; meal_type: string }
interface SettingsRow {
  user_id: string; shifts_enabled: boolean; events_enabled: boolean; meals_enabled: boolean;
  breakfast_time: string; lunch_time: string; dinner_time: string;
}
interface Candidate { key: string; at: Date; title: string; body: string }

export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    console.error('send-reminders: missing required env vars (Supabase service role or VAPID keys)');
    return new Response('Server misconfigured', { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers });
  const subs = (await subsRes.json()) as PushSubRow[];
  if (!Array.isArray(subs) || subs.length === 0) return new Response('no subscriptions', { status: 200 });

  const now = nowInTimeZone(STORE_TIMEZONE);
  const today = dateOnly(now);
  const tomorrow = dateOnly(addDays(now, 1));
  const dayAfter = dateOnly(addDays(now, 2));

  const [eventsRes, remindersRes, mealsRes, settingsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/events?event_date=gte.${today}&event_date=lte.${dayAfter}&select=*`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/reminders?done=eq.false&due_date=gte.${today}&due_date=lte.${dayAfter}&select=*`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/meals?meal_date=eq.${today}&select=user_id,meal_type`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/notification_settings?select=*`, { headers }),
  ]);
  const events = (await eventsRes.json()) as EventRow[];
  const reminders = (await remindersRes.json()) as ReminderRow[];
  const meals = (await mealsRes.json()) as MealRow[];
  const settingsRows = (await settingsRes.json()) as SettingsRow[];
  const settingsByUser = new Map(settingsRows.map((s) => [s.user_id, s]));

  const userIds = [...new Set(subs.map((s) => s.user_id))];

  for (const userId of userIds) {
    const settings: Pick<SettingsRow, 'shifts_enabled' | 'events_enabled' | 'meals_enabled' | 'breakfast_time' | 'lunch_time' | 'dinner_time'> =
      settingsByUser.get(userId) ?? { shifts_enabled: true, events_enabled: true, meals_enabled: true, breakfast_time: '08:00', lunch_time: '12:30', dinner_time: '18:30' };
    const candidates: Candidate[] = [];

    if (settings.shifts_enabled) {
      const shifts = events.filter((e) => e.user_id === userId && e.type === 'holiday' && (e.event_date === today || e.event_date === tomorrow));
      for (const ev of shifts) {
        const weekday = new Date(`${ev.event_date}T00:00:00`).getDay();
        const hours = STORE_HOURS[weekday];
        const startMin = timeToMinutes(ev.start_time);
        const endMin = timeToMinutes(ev.end_time);
        const kind = classifyShift(startMin, endMin, timeToMinutes(hours.open), timeToMinutes(hours.close));
        const shiftStart = atTime(ev.event_date, ev.start_time);
        const eveningBefore = addDays(shiftStart, -1);
        eveningBefore.setHours(20, 0, 0, 0);
        const sixtyBefore = new Date(shiftStart.getTime() - 60 * 60000);
        const body = `${kind}, ${clockLabel(shiftStart)} start`;
        candidates.push({ key: `shift-evening-${ev.id}`, at: eveningBefore, title: 'Shift tomorrow', body });
        candidates.push({ key: `shift-60min-${ev.id}`, at: sixtyBefore, title: 'Shift starting soon', body });
      }
    }

    if (settings.events_enabled) {
      const appts = events.filter((e) => e.user_id === userId && e.type !== 'holiday');
      for (const ev of appts) {
        const start = atTime(ev.event_date, ev.start_time);
        const label = eventLabel(ev.details ?? {}, ev.type);
        const body = `${label} at ${clockLabel(start)}`;
        candidates.push({ key: `event-24h-${ev.id}`, at: new Date(start.getTime() - 24 * 3600000), title: 'Event tomorrow', body });
        candidates.push({ key: `event-1h-${ev.id}`, at: new Date(start.getTime() - 3600000), title: 'Event in 1 hour', body });
      }
      const userReminders = reminders.filter((r) => r.user_id === userId);
      for (const r of userReminders) {
        if (r.due_time) {
          const start = atTime(r.due_date, r.due_time);
          const body = `${r.title} at ${clockLabel(start)}`;
          candidates.push({ key: `event-24h-reminder-${r.id}`, at: new Date(start.getTime() - 24 * 3600000), title: 'Reminder tomorrow', body });
          candidates.push({ key: `event-1h-reminder-${r.id}`, at: new Date(start.getTime() - 3600000), title: 'Reminder in 1 hour', body });
        } else {
          const morning = new Date(`${r.due_date}T00:00:00`);
          morning.setHours(8, 0, 0, 0);
          candidates.push({ key: `reminder-morning-${r.id}`, at: morning, title: 'Due today', body: r.title });
        }
      }
    }

    if (settings.meals_enabled) {
      const loggedTypes = new Set(meals.filter((m) => m.user_id === userId).map((m) => m.meal_type));
      const mealDefs: { type: string; time: string }[] = [
        { type: 'breakfast', time: settings.breakfast_time },
        { type: 'lunch', time: settings.lunch_time },
        { type: 'dinner', time: settings.dinner_time },
      ];
      for (const m of mealDefs) {
        if (loggedTypes.has(m.type)) continue;
        candidates.push({ key: `meal-${m.type}-${today}`, at: atTime(today, m.time), title: 'Mastermind', body: `Log your ${m.type}` });
      }
    }

    const due = candidates.filter((c) => {
      const deltaMs = now.getTime() - c.at.getTime();
      return deltaMs >= 0 && deltaMs < 16 * 60000; // crossed within the last ~16 min (cron runs every 15)
    });
    if (due.length === 0) continue;

    const keysParam = due.map((c) => `"${c.key}"`).join(',');
    const logRes = await fetch(`${supabaseUrl}/rest/v1/notification_log?user_id=eq.${userId}&notif_key=in.(${keysParam})&select=notif_key`, { headers });
    const already = new Set(((await logRes.json()) as { notif_key: string }[]).map((r) => r.notif_key));
    const toSend = due.filter((c) => !already.has(c.key));
    if (toSend.length === 0) continue;

    const userSubs = subs.filter((s) => s.user_id === userId);
    for (const item of toSend) {
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: item.title, body: item.body })
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
          } else {
            console.error('push send failed', err);
          }
        }
      }
    }

    await fetch(`${supabaseUrl}/rest/v1/notification_log?on_conflict=user_id,notif_key`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(toSend.map((c) => ({ user_id: userId, notif_key: c.key }))),
    });
  }

  return new Response('ok', { status: 200 });
};

export const config: Config = {
  schedule: '*/15 * * * *',
};
