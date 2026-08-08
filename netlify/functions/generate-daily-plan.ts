import type { Config } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import webpush from 'web-push';

// Same store-clock caveat as the other Scheduled Functions — this runs on
// Netlify's own clock (UTC), not the store's. See send-shift-reminders.ts
// for the fuller explanation.
const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'America/Chicago';
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
function inWindow(now: Date, hour: number, minute: number): boolean {
  return now.getHours() === hour && now.getMinutes() >= minute && now.getMinutes() < minute + 15;
}

interface PushSubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
interface EventRow { type: string; event_date: string; start_time: string; end_time: string; notes: string | null; details: Record<string, unknown> }
interface GoalRow { title: string; committed_path: { title: string; actions: { description: string; frequency: string }[] } | null; deadline: string | null; check_in_cadence: string | null }
interface FitnessRouteRow { workout_time?: string; meal_plan?: string; sleep_target_hours?: number }
interface CustomPlanRow { chosen_route: 'a' | 'b' | null; route_a: FitnessRouteRow; route_b: FitnessRouteRow }
interface NutritionTargetRow { daily_calories: number; daily_protein_g: number }
interface DailyPlanRow { id: string; user_id: string; plan_date: string; status: string; notified_at: string | null; nudged_at: string | null }

function eventLabel(details: Record<string, unknown>, type: string, notes: string | null): string {
  if (type === 'holiday') return notes || 'Shift';
  if (type === 'dialing') return `${details.first_name ?? ''} ${details.last_name ?? ''}`.toString().trim() || 'Dialing appt';
  return (details.business_name as string) || (details.contact_name as string) || 'Scalez appt';
}

interface GeneratedBlock { time: string; title: string; detail: string; type: 'fixed' | 'goal' | 'fitness' | 'macros' | 'ai_suggested'; source: string | null }

async function generatePlanBlocks(anthropic: Anthropic, ctx: {
  events: EventRow[]; goals: GoalRow[]; fitnessRoute: FitnessRouteRow | null; nutrition: NutritionTargetRow | null;
}): Promise<GeneratedBlock[]> {
  const fixedText = ctx.events.length
    ? ctx.events.map((e) => `${e.start_time}-${e.end_time}: ${eventLabel(e.details ?? {}, e.type, e.notes)}`).join('\n')
    : '(nothing fixed on the calendar)';
  const goalsText = ctx.goals.length
    ? ctx.goals
        .map((g) => {
          const actions = g.committed_path?.actions.map((a) => `${a.description} (${a.frequency})`).join('; ') ?? '(no committed path)';
          return `- ${g.title}${g.deadline ? ` (deadline ${g.deadline})` : ''}: ${actions}`;
        })
        .join('\n')
    : '(no committed goals)';
  const fitnessText = ctx.fitnessRoute
    ? `Workout time: ${ctx.fitnessRoute.workout_time ?? 'unspecified'}. Sleep target: ${ctx.fitnessRoute.sleep_target_hours ?? '?'}h.`
    : '(no active fitness plan)';
  const macrosText = ctx.nutrition ? `Daily target: ${ctx.nutrition.daily_calories} cal, ${ctx.nutrition.daily_protein_g}g protein.` : '(no active nutrition target)';

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1400,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system:
      "You are Nova, building Cristopher's full day plan overnight so it's completely ready when he wakes up — no " +
      'generating later, this is the finished product. Cross-reference: fixed calendar events (put these in as-is, ' +
      "unmovable), his active goals' daily/weekly actions (slot them into the open time around fixed events — give " +
      "more of the day's hours to goals with a short runway/big target, less to long-runway goals), and his active " +
      'fitness/macros plan if any (specific eating windows, a cutoff time to stop eating, and a gym time block, not ' +
      'a vague "go to the gym"). You may propose a genuinely new action item not explicitly requested if a goal ' +
      "looks unreachable on its stated timeline through stated methods — mark ANY such item type " +
      '"ai_suggested" so it\'s clearly flagged as a suggestion, not something already agreed to; everything else ' +
      'uses "fixed", "goal", "fitness", or "macros". ' +
      'Respond with ONLY JSON: {"blocks": [{"time": "HH:MM", "title": string, "detail": string, ' +
      '"type": "fixed"|"goal"|"fitness"|"macros"|"ai_suggested", "source": string | null}]}, ordered by time.',
    messages: [
      {
        role: 'user',
        content: `Fixed calendar events tomorrow:\n${fixedText}\n\nActive goals:\n${goalsText}\n\nFitness:\n${fitnessText}\n\nMacros:\n${macrosText}\n\nBuild tomorrow's full plan.`,
      },
    ],
  });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const parsed = JSON.parse(text.slice(start, end + 1)) as { blocks: GeneratedBlock[] };
  return parsed.blocks ?? [];
}

export default async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey || !vapidPublic || !vapidPrivate) {
    console.error('generate-daily-plan: missing required env vars');
    return new Response('Server misconfigured', { status: 500 });
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const subsRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, { headers });
  const subs = (await subsRes.json()) as PushSubRow[];
  if (!Array.isArray(subs) || subs.length === 0) return new Response('no subscriptions', { status: 200 });

  const now = nowInTimeZone(STORE_TIMEZONE);
  const today = dateOnly(now);
  const tomorrow = dateOnly(addDays(now, 1));
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  const sendToUser = async (userId: string, title: string, body: string) => {
    const userSubs = subs.filter((s) => s.user_id === userId);
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title, body }));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
        } else {
          console.error('push send failed', err);
        }
      }
    }
  };

  // ── Overnight generation (2:00-2:15am local) ─────────────────────────
  if (inWindow(now, 2, 0)) {
    for (const userId of userIds) {
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/daily_plans?user_id=eq.${userId}&plan_date=eq.${tomorrow}&select=id`, { headers });
      const existing = (await existingRes.json()) as { id: string }[];
      if (existing.length > 0) continue;

      const [eventsRes, goalsRes, fitnessRes, nutritionRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/events?user_id=eq.${userId}&event_date=eq.${tomorrow}&select=*`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/goals?user_id=eq.${userId}&committed_path=not.is.null&select=title,committed_path,deadline,check_in_cadence`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/custom_fitness_plans?user_id=eq.${userId}&active=eq.true&select=chosen_route,route_a,route_b`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/nutrition_targets?user_id=eq.${userId}&active=eq.true&select=daily_calories,daily_protein_g`, { headers }),
      ]);
      const events = (await eventsRes.json()) as EventRow[];
      const goals = (await goalsRes.json()) as GoalRow[];
      const fitnessPlans = (await fitnessRes.json()) as CustomPlanRow[];
      const nutritionTargets = (await nutritionRes.json()) as NutritionTargetRow[];
      const fitnessPlan = fitnessPlans[0];
      const fitnessRoute = fitnessPlan ? (fitnessPlan.chosen_route === 'a' ? fitnessPlan.route_a : fitnessPlan.chosen_route === 'b' ? fitnessPlan.route_b : null) : null;

      try {
        const blocks = await generatePlanBlocks(anthropic, { events, goals, fitnessRoute, nutrition: nutritionTargets[0] ?? null });
        await fetch(`${supabaseUrl}/rest/v1/daily_plans`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id: userId, plan_date: tomorrow, blocks, status: 'draft' }),
        });
      } catch (err) {
        console.error('generate-daily-plan: generation failed for user', userId, err);
      }
    }
  }

  // ── 8am "plan ready" push + 11am follow-up nudge ─────────────────────
  if (inWindow(now, 8, 0) || inWindow(now, 11, 0)) {
    const plansRes = await fetch(`${supabaseUrl}/rest/v1/daily_plans?plan_date=eq.${today}&select=*`, { headers });
    const plans = (await plansRes.json()) as DailyPlanRow[];

    for (const plan of plans) {
      if (inWindow(now, 8, 0) && !plan.notified_at) {
        await sendToUser(plan.user_id, "Today's plan is ready", 'Review and confirm your day — open Daily Plan.');
        await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ notified_at: new Date().toISOString() }),
        });
      }
      if (inWindow(now, 11, 0) && plan.status === 'draft' && plan.notified_at && !plan.nudged_at) {
        await sendToUser(plan.user_id, 'Still haven\'t confirmed today\'s plan', "It's still sitting there — take a look when you get a sec.");
        await fetch(`${supabaseUrl}/rest/v1/daily_plans?id=eq.${plan.id}`, {
          method: 'PATCH', headers, body: JSON.stringify({ nudged_at: new Date().toISOString() }),
        });
      }
    }
  }

  return new Response('ok', { status: 200 });
};

export const config: Config = {
  schedule: '*/15 * * * *',
};
