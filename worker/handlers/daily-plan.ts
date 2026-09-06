import Anthropic from '@anthropic-ai/sdk';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { PushMessage, PushSubscription, VapidKeys } from '@block65/webcrypto-web-push';

// Ported from netlify/functions/generate-daily-plan.ts — that function
// depended on the `web-push` npm package, which needs Node crypto and
// doesn't run reliably in the Workers runtime, the exact same reason
// Opening/Closing's reminders (shift-reminders.ts) had to move off Netlify
// first. This is why "Daily Plan" showed nothing: the overnight generation
// job hasn't actually been running since the deploy target moved to
// Cloudflare. @block65/webcrypto-web-push (pure WebCrypto) replaces
// `web-push` here too, same as shift-reminders.ts.
export interface DailyPlanEnv {
  VITE_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  STORE_TIMEZONE?: string;
}

const MODEL = 'claude-opus-5';
// Kept in sync manually with DAILY_CALL_GOAL in src/data/useCallOutcomes.ts
// — not imported directly since that module pulls in React + the browser
// Supabase client, neither of which belong in a Worker bundle.
const DAILY_CALL_GOAL = 100;

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

interface PushSubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface EventRow { type: string; event_date: string; start_time: string; end_time: string; notes: string | null; details: Record<string, unknown> }
interface HolidayShiftRow { start_time: string; end_time: string }
interface GoalRow {
  title: string;
  committed_path: { title: string; actions: { description: string; frequency: string }[] } | null;
  deadline: string | null;
  priority_score: number | null;
}
interface FitnessRouteRow { workout_time?: string; meal_plan?: string; sleep_target_hours?: number }
interface CustomPlanRow { chosen_route: 'a' | 'b' | null; route_a: FitnessRouteRow; route_b: FitnessRouteRow }
interface NutritionTargetRow { daily_calories: number; daily_protein_g: number }
interface CallOutcomeCountRow { id: string }
interface DailyPlanRow { id: string; user_id: string; plan_date: string; status: string; notified_at: string | null; nudged_at: string | null }

function eventLabel(details: Record<string, unknown>, type: string, notes: string | null): string {
  if (type === 'holiday') return notes || 'Shift';
  if (type === 'dialing') return `${details.first_name ?? ''} ${details.last_name ?? ''}`.toString().trim() || 'Dialing appt';
  return (details.business_name as string) || (details.contact_name as string) || 'Scalez appt';
}

interface GeneratedBlock {
  time: string;
  duration: number;
  title: string;
  detail: string;
  type: 'fixed' | 'goal' | 'fitness' | 'macros' | 'dialing' | 'ai_suggested';
  module: 'dialing' | 'fitness' | 'work-shift' | 'client-work' | 'goal' | 'manual';
  source: string | null;
}

async function generatePlanBlocks(anthropic: Anthropic, ctx: {
  events: EventRow[]; shifts: HolidayShiftRow[]; goals: GoalRow[];
  fitnessRoute: FitnessRouteRow | null; nutrition: NutritionTargetRow | null; callsMadeToday: number;
}): Promise<GeneratedBlock[]> {
  const fixedParts = [
    ...ctx.shifts.map((s) => `${s.start_time}-${s.end_time}: Work shift`),
    ...ctx.events.map((e) => `${e.start_time}-${e.end_time}: ${eventLabel(e.details ?? {}, e.type, e.notes)}`),
  ];
  const fixedText = fixedParts.length ? fixedParts.join('\n') : '(nothing fixed on the calendar)';
  const goalsText = ctx.goals.length
    ? ctx.goals
        .map((g) => {
          const actions = g.committed_path?.actions.map((a) => `${a.description} (${a.frequency})`).join('; ') ?? '(no committed path)';
          const priority = g.priority_score != null ? `priority ${g.priority_score}/10` : 'no priority set';
          return `- ${g.title} (${priority}${g.deadline ? `, deadline ${g.deadline}` : ''}): ${actions}`;
        })
        .join('\n')
    : '(no committed goals)';
  const fitnessText = ctx.fitnessRoute
    ? `Workout time: ${ctx.fitnessRoute.workout_time ?? 'unspecified'}. Sleep target: ${ctx.fitnessRoute.sleep_target_hours ?? '?'}h.`
    : '(no active fitness plan)';
  const macrosText = ctx.nutrition ? `Daily target: ${ctx.nutrition.daily_calories} cal, ${ctx.nutrition.daily_protein_g}g protein.` : '(no active nutrition target)';
  const dialingText = `Daily call goal: ${DAILY_CALL_GOAL} dials. Made so far today: ${ctx.callsMadeToday}.`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      "You are Nova, building Cristopher's full day plan overnight so it's completely ready when he wakes up — no " +
      'generating later, this is the finished product. Cross-reference: fixed calendar events and work shifts (put ' +
      "these in as-is, unmovable), his active goals' daily/weekly actions (slot them into the open time around " +
      'fixed blocks — weight allocation by BOTH priority score (1-10, higher = more hours) and deadline proximity; ' +
      'a high-priority goal with a near deadline should visibly get more of the open day than a low-priority one ' +
      "with a distant deadline), his daily cold-calling goal (block real dialing time — don't invent a number, use " +
      'the stated goal and today\'s progress against it), and his active fitness/macros plan if any (specific ' +
      'eating windows, a cutoff time to stop eating, and a gym time block, not a vague "go to the gym"). Keep ' +
      'targets realistic — do not schedule more dials in a block than a person can physically make; a normal ' +
      'session is 15-25 dials/hour, not more. You may propose a genuinely new action item not explicitly requested ' +
      'if a goal looks unreachable on its stated timeline through stated methods — mark ANY such item\'s "type" as ' +
      '"ai_suggested" so it\'s clearly flagged as a suggestion, not something already agreed to. For every block, ' +
      'set "module" to whichever of "dialing"|"fitness"|"work-shift"|"client-work"|"goal"|"manual" it actually is, ' +
      'and "duration" to its length in minutes. ' +
      'Respond with ONLY JSON: {"blocks": [{"time": "HH:MM", "duration": number, "title": string, "detail": ' +
      'string, "type": "fixed"|"goal"|"fitness"|"macros"|"dialing"|"ai_suggested", "module": ' +
      '"dialing"|"fitness"|"work-shift"|"client-work"|"goal"|"manual", "source": string | null}]}, ordered by time.',
    messages: [
      {
        role: 'user',
        content: `Fixed calendar/shifts tomorrow:\n${fixedText}\n\nActive goals:\n${goalsText}\n\nDialing:\n${dialingText}\n\nFitness:\n${fitnessText}\n\nMacros:\n${macrosText}\n\nBuild tomorrow's full plan.`,
      },
    ],
  });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const parsed = JSON.parse(text.slice(start, end + 1)) as { blocks: GeneratedBlock[] };
  return parsed.blocks ?? [];
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

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  const now = nowInTimeZone(storeTimezone);
  const today = dateOnly(now);
  const tomorrow = dateOnly(addDays(now, 1));

  // ── Overnight generation (2:00-2:15am local — comfortably ready by 6am) ──
  if (inWindow(now, 2, 0)) {
    if (!anthropicKey) {
      console.error('runDailyPlan: ANTHROPIC_API_KEY not set, skipping generation');
    } else {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=user_id`, { headers });
      const subs = (await subsRes.json()) as { user_id: string }[];
      const userIds = [...new Set(subs.map((s) => s.user_id))];

      for (const userId of userIds) {
        const existingRes = await fetch(`${supabaseUrl}/rest/v1/daily_plans?user_id=eq.${userId}&plan_date=eq.${tomorrow}&select=id`, { headers });
        const existing = (await existingRes.json()) as { id: string }[];
        if (existing.length > 0) continue;

        const [eventsRes, shiftsRes, goalsRes, fitnessRes, nutritionRes, callsRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/events?user_id=eq.${userId}&event_date=eq.${tomorrow}&select=*`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/holiday_shifts?user_id=eq.${userId}&shift_date=eq.${tomorrow}&is_self=eq.true&select=start_time,end_time`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/goals?user_id=eq.${userId}&committed_path=not.is.null&select=title,committed_path,deadline,priority_score`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/custom_fitness_plans?user_id=eq.${userId}&active=eq.true&select=chosen_route,route_a,route_b`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/nutrition_targets?user_id=eq.${userId}&active=eq.true&select=daily_calories,daily_protein_g`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/call_outcomes?user_id=eq.${userId}&call_date=eq.${today}&select=id`, { headers }),
        ]);
        const events = (await eventsRes.json()) as EventRow[];
        const shifts = (await shiftsRes.json()) as HolidayShiftRow[];
        const goals = (await goalsRes.json()) as GoalRow[];
        const fitnessPlans = (await fitnessRes.json()) as CustomPlanRow[];
        const nutritionTargets = (await nutritionRes.json()) as NutritionTargetRow[];
        const calls = (await callsRes.json()) as CallOutcomeCountRow[];
        const fitnessPlan = fitnessPlans[0];
        const fitnessRoute = fitnessPlan ? (fitnessPlan.chosen_route === 'a' ? fitnessPlan.route_a : fitnessPlan.chosen_route === 'b' ? fitnessPlan.route_b : null) : null;

        try {
          const blocks = await generatePlanBlocks(anthropic, {
            events, shifts, goals, fitnessRoute, nutrition: nutritionTargets[0] ?? null,
            callsMadeToday: Array.isArray(calls) ? calls.length : 0,
          });
          await fetch(`${supabaseUrl}/rest/v1/daily_plans`, {
            method: 'POST', headers,
            body: JSON.stringify({ user_id: userId, plan_date: tomorrow, blocks, status: 'draft' }),
          });
        } catch (err) {
          console.error('runDailyPlan: generation failed for user', userId, err);
        }
      }
    }
  }

  // ── 8am "plan ready" push + 11am follow-up nudge ─────────────────────
  if ((inWindow(now, 8, 0) || inWindow(now, 11, 0)) && vapidPublic && vapidPrivate) {
    const vapid: VapidKeys = { subject: vapidSubject, publicKey: vapidPublic, privateKey: vapidPrivate };
    const [subsRes, plansRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/daily_plans?plan_date=eq.${today}&select=*`, { headers }),
    ]);
    const subs = (await subsRes.json()) as PushSubRow[];
    const plans = (await plansRes.json()) as DailyPlanRow[];
    if (!Array.isArray(subs) || subs.length === 0) return;

    const sendToUser = async (userId: string, title: string, body: string) => {
      const userSubs = subs.filter((s) => s.user_id === userId);
      for (const sub of userSubs) {
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
    };

    for (const plan of plans) {
      if (inWindow(now, 8, 0) && !plan.notified_at) {
        await sendToUser(plan.user_id, "Today's plan is ready", 'Review and confirm your day — open Daily Plan.');
        await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, { method: 'PATCH', headers, body: JSON.stringify({ notified_at: new Date().toISOString() }) });
      }
      if (inWindow(now, 11, 0) && plan.status === 'draft' && plan.notified_at && !plan.nudged_at) {
        await sendToUser(plan.user_id, "Still haven't confirmed today's plan", "It's still sitting there — take a look when you get a sec.");
        await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, { method: 'PATCH', headers, body: JSON.stringify({ nudged_at: new Date().toISOString() }) });
      }
    }
  }
}
