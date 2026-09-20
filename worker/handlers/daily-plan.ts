import Anthropic from '@anthropic-ai/sdk';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushMessage, PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';
import { requireUser } from '../lib/auth';
import { buildPlan, mergePlan, planNotifications, toMinutes } from '../lib/planBuilder';
import type { PlanBlock, PlanEvent, PlanInput, PlanReminder, PlanShift, PlanStep } from '../lib/planBuilder';

// Ported from netlify/functions/generate-daily-plan.ts, then rebuilt.
//
// Why it was empty. The overnight job was running on schedule and had been
// since the Cloudflare move — but it built its list of users to plan for
// from push_subscriptions, and there were none. So it ran for nobody, every
// night, and wrote nothing. On top of that the plan was 100% one Claude
// call: if that call failed, or was skipped for want of a key, the day
// stayed blank. The 4pm calling hour — the one block that produces money —
// depended on a model returning JSON.
//
// Now: users come from who has goals (and push subscriptions), the floor of
// the plan is built by code in worker/lib/planBuilder.ts (shifts, the
// calling hour, every daily goal step, the Sunday review, overdue
// reminders), and Claude is only asked to fill free hours around it. A
// failed model call still saves the floor. There's also a same-day route
// (/api/daily-plan/today) so the tab fills on first open instead of waiting
// for tomorrow's 2am run.
export interface DailyPlanEnv {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  STORE_TIMEZONE?: string;
}

const MODEL = 'claude-opus-5';

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
// This cron tick is */15 (shared with the stocks bot) — a 15-minute window
// matches that cadence exactly, so every firing inside the target minute
// range catches it exactly once.
function inWindow(now: Date, hour: number, minute: number): boolean {
  return now.getHours() === hour && now.getMinutes() >= minute && now.getMinutes() < minute + 15;
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface PushSubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface EventRow { type: string; event_date: string; start_time: string; end_time: string; notes: string | null; details: Record<string, unknown> }
interface HolidayShiftRow { start_time: string; end_time: string }
interface StepRow { id: string; goal_id: string; description: string; frequency: string | null; done: boolean; auto_tracked_source: string | null; goals: { title: string } | null }
interface ReminderRow { id: string; title: string; due_date: string }
interface FitnessRouteRow { workout_time?: string; meal_plan?: string; sleep_target_hours?: number }
interface CustomPlanRow { chosen_route: 'a' | 'b' | null; route_a: FitnessRouteRow; route_b: FitnessRouteRow }
interface NutritionTargetRow { daily_calories: number; daily_protein_g: number }
interface DailyPlanRow { id: string; user_id: string; plan_date: string; status: string; blocks: PlanBlock[]; notified_at: string | null; nudged_at: string | null }

type Headers = Record<string, string>;

function eventLabel(details: Record<string, unknown>, type: string, notes: string | null): string {
  if (type === 'holiday') return notes || 'Shift';
  if (type === 'dialing') return `${details.first_name ?? ''} ${details.last_name ?? ''}`.toString().trim() || 'Dialing appt';
  return (details.business_name as string) || (details.contact_name as string) || notes || 'Scalez appt';
}

/** Everything the deterministic builder needs for one user on one date. */
async function fetchPlanInput(supabaseUrl: string, headers: Headers, userId: string, date: string): Promise<PlanInput> {
  const [eventsRes, shiftsRes, stepsRes, remindersRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/events?user_id=eq.${userId}&event_date=eq.${date}&select=type,event_date,start_time,end_time,notes,details`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/holiday_shifts?user_id=eq.${userId}&shift_date=eq.${date}&is_self=eq.true&select=start_time,end_time`, { headers }),
    // Every step on every goal, with the goal's title. Daily/weekly is
    // decided by the builder from `frequency`; `done` is passed through so
    // weekly one-offs already finished don't keep showing up.
    fetch(`${supabaseUrl}/rest/v1/goal_steps?user_id=eq.${userId}&select=id,goal_id,description,frequency,done,auto_tracked_source,goals(title)&order=sort_order`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/reminders?user_id=eq.${userId}&done=eq.false&due_date=lt.${date}&select=id,title,due_date&order=due_date`, { headers }),
  ]);
  const events = (await eventsRes.json()) as EventRow[];
  const shiftRows = (await shiftsRes.json()) as HolidayShiftRow[];
  const stepRows = (await stepsRes.json()) as StepRow[];
  const reminderRows = (await remindersRes.json()) as ReminderRow[];

  // A shift can be recorded either way: on the team Holiday Calendar
  // flagged "this is my shift", or as a Schedule event of type holiday.
  // Both mean the same thing here, and both used to be read by different
  // jobs — the plan read only one, the reminders job only the other.
  const shifts: PlanShift[] = [
    ...(Array.isArray(shiftRows) ? shiftRows : []).map((s) => ({ start_time: s.start_time, end_time: s.end_time })),
    ...(Array.isArray(events) ? events : []).filter((e) => e.type === 'holiday').map((e) => ({ start_time: e.start_time, end_time: e.end_time })),
  ];
  const planEvents: PlanEvent[] = (Array.isArray(events) ? events : [])
    .filter((e) => e.type !== 'holiday')
    .map((e) => ({ type: e.type, start_time: e.start_time, end_time: e.end_time, label: eventLabel(e.details ?? {}, e.type, e.notes) }));
  const steps: PlanStep[] = (Array.isArray(stepRows) ? stepRows : []).map((s) => ({
    id: s.id, goal_id: s.goal_id, goal_title: s.goals?.title ?? 'Goal',
    description: s.description, frequency: s.frequency, done: s.done, auto_tracked_source: s.auto_tracked_source,
  }));
  const overdue: PlanReminder[] = Array.isArray(reminderRows) ? reminderRows : [];
  return { date, shifts, events: planEvents, steps, overdue };
}

/** Asks Claude for extra blocks in the hours the floor leaves open —
 *  fitness, meals, goal work weighted by priority. Anything it returns on
 *  an hour the floor already owns is dropped: the floor is not negotiable,
 *  and a model that overwrote the calling hour with "gym" would be worse
 *  than no model. On any failure, returns the floor unchanged. */
async function enrichWithAi(anthropic: Anthropic, supabaseUrl: string, headers: Headers, userId: string, floor: PlanBlock[]): Promise<PlanBlock[]> {
  try {
    const [goalsRes, fitnessRes, nutritionRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/goals?user_id=eq.${userId}&select=title,why,deadline,priority_score,committed_path`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/custom_fitness_plans?user_id=eq.${userId}&active=eq.true&select=chosen_route,route_a,route_b`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/nutrition_targets?user_id=eq.${userId}&active=eq.true&select=daily_calories,daily_protein_g`, { headers }),
    ]);
    const goals = (await goalsRes.json()) as { title: string; why: string | null; deadline: string | null; priority_score: number | null; committed_path: { title: string; actions: { description: string; frequency: string }[] } | null }[];
    const fitnessPlans = (await fitnessRes.json()) as CustomPlanRow[];
    const nutrition = ((await nutritionRes.json()) as NutritionTargetRow[])[0] ?? null;
    const fp = fitnessPlans[0];
    const route = fp ? (fp.chosen_route === 'a' ? fp.route_a : fp.chosen_route === 'b' ? fp.route_b : null) : null;

    const takenHours = new Set(floor.map((b) => Math.floor(toMinutes(b.time) / 60)));
    const free: string[] = [];
    for (let h = 6; h < 21; h++) if (!takenHours.has(h)) free.push(`${pad(h)}:00`);
    if (free.length === 0) return floor;

    const fixedText = floor.map((b) => `${b.time} (${b.duration} min): ${b.title}`).join('\n');
    const goalsText = goals.length
      ? goals.map((g) => `- ${g.title}${g.priority_score != null ? ` (priority ${g.priority_score}/10)` : ''}${g.deadline ? `, deadline ${g.deadline}` : ''}${g.why ? ` — ${g.why}` : ''}`).join('\n')
      : '(none)';
    const fitnessText = route ? `Workout time: ${route.workout_time ?? 'unspecified'}. Sleep target: ${route.sleep_target_hours ?? '?'}h.` : '(no active fitness plan)';
    const macrosText = nutrition ? `Daily target: ${nutrition.daily_calories} cal, ${nutrition.daily_protein_g}g protein.` : '(no active nutrition target)';

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system:
        "You are Nova, filling the open hours of Cristopher's day around blocks that are already fixed. The fixed " +
        'blocks are NOT yours to move, shorten, or duplicate — do not emit anything at their times. You may only use ' +
        'the hour slots listed as free. Add blocks only where there is a real reason: a gym block if he has a ' +
        'fitness plan, an eating cutoff if he has a nutrition target, focused work on a high-priority goal near its ' +
        'deadline. If nothing is warranted, return an empty list — an empty evening is better than filler. Mark ' +
        'anything not explicitly agreed to as "ai_suggested". ' +
        'Respond with ONLY JSON: {"blocks": [{"time": "HH:00" (one of the free slots), "duration": number, "title": ' +
        'string, "detail": string, "type": "goal"|"fitness"|"macros"|"ai_suggested", "module": ' +
        '"fitness"|"client-work"|"goal"|"manual", "source": null}]}.',
      messages: [{
        role: 'user',
        content: `Fixed blocks (do not touch):\n${fixedText}\n\nFree hour slots: ${free.join(', ')}\n\nGoals:\n${goalsText}\n\nFitness: ${fitnessText}\nMacros: ${macrosText}\n\nFill the free hours, or return an empty list.`,
      }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const parsed = JSON.parse(text.slice(start, end + 1)) as { blocks?: PlanBlock[] };
    const extra = (parsed.blocks ?? []).filter((b) =>
      typeof b.time === 'string' && /^\d{2}:\d{2}$/.test(b.time)
      && !takenHours.has(Math.floor(toMinutes(b.time) / 60))
      && typeof b.title === 'string' && b.title.trim(),
    ).map((b) => ({ ...b, source: b.source ?? null, duration: Number(b.duration) || 30, detail: String(b.detail ?? '') }));
    return [...floor, ...extra].sort((a, b) => a.time.localeCompare(b.time));
  } catch (err) {
    console.error('runDailyPlan: AI enrichment failed, saving the floor as-is', err);
    return floor;
  }
}

async function existingPlan(supabaseUrl: string, headers: Headers, userId: string, date: string): Promise<DailyPlanRow | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/daily_plans?user_id=eq.${userId}&plan_date=eq.${date}&select=*`, { headers });
  const rows = (await res.json()) as DailyPlanRow[];
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function savePlan(supabaseUrl: string, headers: Headers, userId: string, date: string, blocks: PlanBlock[]): Promise<DailyPlanRow | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/daily_plans`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, plan_date: date, blocks, status: 'draft' }),
  });
  if (!res.ok) {
    console.error('runDailyPlan: could not save plan', res.status, await res.text().catch(() => ''));
    return null;
  }
  const rows = (await res.json()) as DailyPlanRow[];
  return rows[0] ?? null;
}

async function sendPush(supabaseUrl: string, headers: Headers, subs: PushSubRow[], vapid: VapidKeys, title: string, body: string): Promise<void> {
  for (const sub of subs) {
    const subscription: PushSubscription = { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    const message: PushMessage = { data: JSON.stringify({ title, body }) };
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(sub.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
      } else if (!res.ok) {
        console.error('runDailyPlan: push send failed', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      console.error('runDailyPlan: push send failed', err);
    }
  }
}

/** Runs on the shared every-15-minutes Cron Trigger (wrangler.jsonc), same
 *  tick as the stocks bot — internal window checks below decide whether
 *  this firing actually does anything, matching runStocksBot's own gating
 *  pattern. */
export async function runDailyPlan(env: DailyPlanEnv): Promise<void> {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const vapidPublic = env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:notifications@example.com';
  const storeTimezone = env.STORE_TIMEZONE || 'America/Chicago';

  if (!supabaseUrl || !serviceRoleKey) return;

  const headers: Headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  const now = nowInTimeZone(storeTimezone);
  const today = dateOnly(now);
  const tomorrow = dateOnly(addDays(now, 1));

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers });
  const subsRaw = (await subsRes.json()) as PushSubRow[];
  const subs = Array.isArray(subsRaw) ? subsRaw : [];
  const vapid: VapidKeys | null = vapidPublic && vapidPrivate ? { subject: vapidSubject, publicKey: vapidPublic, privateKey: vapidPrivate } : null;

  // ── Overnight generation (2:00-2:15am local — comfortably ready by 6am) ──
  if (inWindow(now, 2, 0)) {
    // Anyone with a goal gets a plan. This used to be "anyone with a push
    // subscription", which was nobody.
    const goalUsersRes = await fetch(`${supabaseUrl}/rest/v1/goals?select=user_id`, { headers });
    const goalUsers = (await goalUsersRes.json()) as { user_id: string }[];
    const userIds = [...new Set([
      ...(Array.isArray(goalUsers) ? goalUsers : []).map((g) => g.user_id),
      ...subs.map((s) => s.user_id),
    ])];
    const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
    if (!anthropic) console.error('runDailyPlan: ANTHROPIC_API_KEY not set — saving the deterministic floor only');

    for (const userId of userIds) {
      // Tomorrow, with the AI pass; and today as a backfill if a previous
      // night was missed, floor only — it's already the day.
      for (const [date, withAi] of [[tomorrow, true], [today, false]] as const) {
        try {
          if (await existingPlan(supabaseUrl, headers, userId, date)) continue;
          const floor = buildPlan(await fetchPlanInput(supabaseUrl, headers, userId, date));
          const blocks = withAi && anthropic ? await enrichWithAi(anthropic, supabaseUrl, headers, userId, floor) : floor;
          await savePlan(supabaseUrl, headers, userId, date, blocks);
        } catch (err) {
          console.error('runDailyPlan: generation failed for user', userId, date, err);
        }
      }
    }
  }

  if (!vapid || subs.length === 0) return;

  const plansRes = await fetch(`${supabaseUrl}/rest/v1/daily_plans?plan_date=eq.${today}&select=*`, { headers });
  const plansRaw = (await plansRes.json()) as DailyPlanRow[];
  const plans = Array.isArray(plansRaw) ? plansRaw : [];

  for (const plan of plans) {
    const userSubs = subs.filter((s) => s.user_id === plan.user_id);
    if (userSubs.length === 0) continue;

    // ── 8am "plan ready" push + 11am follow-up nudge ─────────────────
    if (inWindow(now, 8, 0) && !plan.notified_at) {
      await sendPush(supabaseUrl, headers, userSubs, vapid, "Today's plan is ready", 'Review and confirm your day — open Daily Plan.');
      await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, { method: 'PATCH', headers, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
    }
    if (inWindow(now, 11, 0) && plan.status === 'draft' && plan.notified_at && !plan.nudged_at) {
      await sendPush(supabaseUrl, headers, userSubs, vapid, "Still haven't confirmed today's plan", "It's still sitting there — take a look when you get a sec.");
      await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, { method: 'PATCH', headers, body: JSON.stringify({ nudged_at: new Date().toISOString() }) });
    }

    // ── "Move your leads" and "Start dialing" — two pushes, at the plan's
    //    own times, so a shifted calling hour shifts its notification too.
    //    Deduped through notification_log like every other reminder push,
    //    so a cron firing twice inside the window can't send twice. ──────
    const due = planNotifications(plan.blocks ?? []).filter((n) => {
      const [h, m] = n.time.split(':').map(Number);
      const at = new Date(now); at.setHours(h, m, 0, 0);
      const delta = now.getTime() - at.getTime();
      return delta >= 0 && delta < 16 * 60000;
    });
    if (due.length === 0) continue;
    const keys = due.map((n) => `plan-${n.source}-${today}`);
    const logRes = await fetch(`${supabaseUrl}/rest/v1/notification_log?user_id=eq.${plan.user_id}&notif_key=in.(${keys.map((k) => `"${k}"`).join(',')})&select=notif_key`, { headers });
    const already = new Set(((await logRes.json()) as { notif_key: string }[]).map((r) => r.notif_key));
    for (const n of due) {
      const key = `plan-${n.source}-${today}`;
      if (already.has(key)) continue;
      await sendPush(supabaseUrl, headers, userSubs, vapid, n.title, n.body);
      await fetch(`${supabaseUrl}/rest/v1/notification_log?on_conflict=user_id,notif_key`, {
        method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([{ user_id: plan.user_id, notif_key: key }]),
      });
    }
  }
}

/** POST /api/daily-plan/today — today's plan for the caller, in sync with
 *  today's schedule. Creates it if there isn't one; if there is, rebuilds
 *  the floor from live shifts, events, steps and reminders and swaps it in,
 *  keeping any blocks that were added by hand. So a shift logged this
 *  morning blocks its hours and moves the calling hour the next time the
 *  tab opens, instead of being invisible until tomorrow's 2am run.
 *
 *  Floor only, no model call: this runs on every tab open and has to be
 *  fast. Status, confirmation and notification stamps are untouched. */
export async function dailyPlanToday(request: Request, env: DailyPlanEnv): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Plan generation is not configured.' }, 503);

  const headers: Headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
  const today = dateOnly(nowInTimeZone(env.STORE_TIMEZONE || 'America/Chicago'));

  const floor = buildPlan(await fetchPlanInput(env.VITE_SUPABASE_URL, headers, user.id, today));
  const existing = await existingPlan(env.VITE_SUPABASE_URL, headers, user.id, today);

  if (!existing) {
    const saved = await savePlan(env.VITE_SUPABASE_URL, headers, user.id, today, floor);
    if (!saved) return json({ error: 'Could not save the plan.' }, 500);
    return json(saved);
  }

  const merged = mergePlan(existing.blocks ?? [], floor);
  if (!merged) return json(existing);
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/daily_plans?id=eq.${existing.id}`, {
    method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ blocks: merged }),
  });
  if (!res.ok) return json(existing); // stale is better than nothing; the next open tries again
  const rows = (await res.json()) as DailyPlanRow[];
  return json(rows[0] ?? { ...existing, blocks: merged });
}
