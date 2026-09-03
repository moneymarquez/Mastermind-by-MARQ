import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushMessage, PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import { buildSchedule } from '../../src/data/shiftChecklist';

// Opening/Closing push, ported from netlify/functions/send-shift-reminders.ts
// (a Netlify Scheduled Function) to a Cloudflare Cron Trigger. That function
// depended on the `web-push` npm package, which needs Node crypto/
// https-proxy-agent and doesn't run reliably in the Workers runtime even
// with nodejs_compat — exactly why this stayed on Netlify through the rest
// of the Cloudflare migration (see push-subscription.ts's own note). It
// silently stopped firing once Netlify's deploys went stale: the app kept
// working everywhere else because nothing else in the request path touched
// Netlify, so there was no error to surface — the reminders just never
// went out. @block65/webcrypto-web-push implements the same Web Push
// protocol (RFC 8291 encryption, RFC 8292 VAPID) with pure WebCrypto, which
// Workers does support natively, so this removes the Netlify dependency
// for good rather than working around it again.
export interface ShiftReminderEnv {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  STORE_TIMEZONE?: string;
}

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
  // Worker's own execution timezone (always UTC).
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

/** Runs every 5 minutes via the Worker's Cron Trigger (wrangler.jsonc).
 *  Checks whether any Opening/Closing task or milestone just came due for
 *  any subscribed user, and sends a real push notification — this is what
 *  makes reminders fire even with the app fully closed, unlike the
 *  foreground-only polling in OpeningClosingScreen.tsx. */
export async function runShiftReminders(env: ShiftReminderEnv): Promise<void> {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:notifications@example.com';
  const storeTimezone = env.STORE_TIMEZONE || 'America/Chicago';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    console.error('runShiftReminders: missing required env vars (Supabase service role or VAPID keys)');
    return;
  }

  const vapid: VapidKeys = { subject: vapidSubject, publicKey: vapidPublic, privateKey: vapidPrivate };

  // Service role bypasses RLS deliberately — this is a trusted system cron,
  // not a user request, so it must see across the relevant tables itself.
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  };

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers });
  const subs = (await subsRes.json()) as PushSubRow[];
  if (!Array.isArray(subs) || subs.length === 0) return;

  const now = nowInTimeZone(storeTimezone);
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
    { headers },
  );
  const usersWorkingToday = new Set(((await todaysShiftsRes.json()) as { user_id: string }[]).map((r) => r.user_id));

  const userIds = [...new Set(subs.map((s) => s.user_id))];

  for (const userId of userIds) {
    if (!usersWorkingToday.has(userId)) continue;

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/notification_settings?user_id=eq.${userId}&select=opening_closing_enabled`,
      { headers },
    );
    const settingsRows = (await settingsRes.json()) as SettingsRow[];
    // No settings row yet defaults to enabled (matches useNotificationSettings' client-side default).
    if (settingsRows[0]?.opening_closing_enabled === false) continue;

    const stateRes = await fetch(
      `${supabaseUrl}/rest/v1/shift_checklist_state?user_id=eq.${userId}&checklist_date=eq.${today}&select=completed_task_ids,notified_task_ids`,
      { headers },
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
        const subscription: PushSubscription = {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        const message: PushMessage = { data: JSON.stringify({ title: item.title, body: item.body }) };
        try {
          const payload = await buildPushPayload(message, subscription, vapid);
          const res = await fetch(sub.endpoint, payload);
          if (res.status === 404 || res.status === 410) {
            // Subscription is dead (uninstalled, permission revoked, etc.) — clean it up.
            await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
          } else if (!res.ok) {
            console.error('push send failed', res.status, await res.text().catch(() => ''));
          }
        } catch (err) {
          console.error('push send failed', err);
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
}
