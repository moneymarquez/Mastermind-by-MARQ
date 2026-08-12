import type { Config } from '@netlify/functions';
import webpush from 'web-push';
import { buildSchedule } from '../../src/data/shiftChecklist';

// Store's local timezone for schedule math — REQUIRED to be correct, or
// reminders fire at the wrong wall-clock time. This function runs on
// Netlify's infrastructure clock (effectively UTC), not the store's clock,
// unlike the client (which already uses the browser's local time correctly
// with no changes needed). Set STORE_TIMEZONE in Netlify env vars to an
// IANA name (e.g. "America/Chicago") — this default is a placeholder.
const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'America/Chicago';

function nowInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // buildSchedule only reads local getters (getDay/getHours/setHours), so a
  // Date built from these numbers behaves correctly regardless of the
  // server's actual system timezone.
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
}

function clockLabel(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface PushSubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface ChecklistStateRow {
  completed_task_ids: string[] | null;
  notified_task_ids: string[] | null;
}

interface SettingsRow {
  opening_closing_enabled: boolean;
}

// Runs every 5 minutes (Netlify Scheduled Function). Checks whether any
// Opening/Closing task or milestone just came due for any subscribed user,
// and sends a real push notification — this is what makes reminders fire
// even with the app fully closed, unlike the foreground-only polling in
// OpeningClosingScreen.tsx.
export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    console.error('send-shift-reminders: missing required env vars (Supabase service role or VAPID keys)');
    return new Response('Server misconfigured', { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  // Service role bypasses RLS deliberately — this is a trusted system cron,
  // not a user request, so it must see across the relevant tables itself.
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  };

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers });
  const subs = (await subsRes.json()) as PushSubRow[];
  if (!Array.isArray(subs) || subs.length === 0) {
    return new Response('no subscriptions', { status: 200 });
  }

  const now = nowInTimeZone(STORE_TIMEZONE);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const schedule = buildSchedule(now);

  const notifiable = [
    ...schedule.tasks.map((t) => ({ id: t.id, at: t.at, title: t.name, body: `Scheduled for ${clockLabel(t.at)}` })),
    ...schedule.milestones.map((m) => ({ id: m.id, at: m.at, title: 'Mastermind', body: m.message })),
  ];

  // Store hours span every day of the week, but that doesn't mean any given
  // user is actually working today — buildSchedule() has no concept of
  // that. Only send Opening/Closing task alerts to users who have a real
  // holiday-type shift on today's date, same source of truth as the
  // Schedule calendar's client-side gate in OpeningClosingScreen.tsx.
  const todaysShiftsRes = await fetch(
    `${supabaseUrl}/rest/v1/events?type=eq.holiday&event_date=eq.${today}&select=user_id`,
    { headers }
  );
  const usersWorkingToday = new Set(((await todaysShiftsRes.json()) as { user_id: string }[]).map((r) => r.user_id));

  const userIds = [...new Set(subs.map((s) => s.user_id))];

  for (const userId of userIds) {
    if (!usersWorkingToday.has(userId)) continue;

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/notification_settings?user_id=eq.${userId}&select=opening_closing_enabled`,
      { headers }
    );
    const settingsRows = (await settingsRes.json()) as SettingsRow[];
    // No settings row yet defaults to enabled (matches useNotificationSettings' client-side default).
    if (settingsRows[0]?.opening_closing_enabled === false) continue;

    const stateRes = await fetch(
      `${supabaseUrl}/rest/v1/shift_checklist_state?user_id=eq.${userId}&checklist_date=eq.${today}&select=completed_task_ids,notified_task_ids`,
      { headers }
    );
    const stateRows = (await stateRes.json()) as ChecklistStateRow[];
    const state = stateRows[0];
    const completed = new Set(state?.completed_task_ids ?? []);
    const notified = new Set(state?.notified_task_ids ?? []);

    const due = notifiable.filter((item) => {
      if (completed.has(item.id) || notified.has(item.id)) return false;
      const deltaMs = now.getTime() - item.at.getTime();
      return deltaMs >= 0 && deltaMs < 6 * 60000; // crossed within the last 6 minutes
    });
    if (due.length === 0) continue;

    const userSubs = subs.filter((s) => s.user_id === userId);
    for (const item of due) {
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: item.title, body: item.body })
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is dead (uninstalled, permission revoked, etc.) — clean it up.
            await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
          } else {
            console.error('push send failed', err);
          }
        }
      }
      notified.add(item.id);
    }

    await fetch(`${supabaseUrl}/rest/v1/shift_checklist_state?on_conflict=user_id,checklist_date`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: userId, checklist_date: today, notified_task_ids: [...notified] }),
    });
  }

  return new Response('ok', { status: 200 });
};

export const config: Config = {
  schedule: '*/5 * * * *',
};
