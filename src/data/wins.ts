import { supabase } from '../lib/supabase';
import { isStreakMilestone } from './feed';
import type { WinInput } from './feed';
import { dateStr } from './time';

/** Real wins from the person's own data, newest first. */
export async function findWins(): Promise<WinInput[]> {
  const today = dateStr(new Date());
  const out: WinInput[] = [];
  const [goals, workouts, meals, targets, money] = await Promise.all([
    supabase.from('goals').select('title,progress_pct').gte('progress_pct', 100).limit(3),
    supabase.from('fitness_workouts').select('workout_type,duration_min,workout_date').eq('workout_date', today).limit(1),
    supabase.from('meals').select('calories,protein_g').eq('meal_date', today),
    supabase.from('nutrition_targets').select('daily_calories,daily_protein_g').eq('active', true).limit(1),
    supabase.from('money_moves').select('earned_usd').not('earned_usd', 'is', null).order('updated_at', { ascending: false }).limit(1),
  ]);
  for (const g of (goals.data ?? []) as { title: string }[]) out.push({ kind: 'goal', goal: g.title });
  const w = (workouts.data ?? [])[0] as { workout_type: string; duration_min: number | null } | undefined;
  if (w) out.push({ kind: 'workout', workout: w.workout_type, minutes: w.duration_min ?? undefined });
  const t = (targets.data ?? [])[0] as { daily_calories: number; daily_protein_g: number } | undefined;
  const ms = (meals.data ?? []) as { calories: number | null; protein_g: number | null }[];
  if (t && ms.length) { const cal = ms.reduce((s, m) => s + Number(m.calories ?? 0), 0), pro = ms.reduce((s, m) => s + Number(m.protein_g ?? 0), 0); if (pro >= t.daily_protein_g * 0.95 && Math.abs(cal - t.daily_calories) <= t.daily_calories * 0.1) out.push({ kind: 'macros', calories: cal, protein_g: pro }); }
  const m = (money.data ?? [])[0] as { earned_usd: number } | undefined;
  if (m) out.push({ kind: 'money', amount_usd: Number(m.earned_usd) });
  const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('done', true).gte('done_at', `${today}T00:00:00`);
  if ((count ?? 0) >= 3) out.push({ kind: 'manual', title: `${count} tasks done today` });
  // Streak: consecutive days with a confirmed Daily Plan.
  const { data: plans } = await supabase.from('daily_plans').select('plan_date,status').eq('status', 'confirmed').order('plan_date', { ascending: false }).limit(400);
  let streak = 0; let d = today;
  const set = new Set(((plans ?? []) as { plan_date: string }[]).map((p) => p.plan_date));
  while (set.has(d)) { streak++; d = new Date(Date.parse(`${d}T12:00:00Z`) - 86400000).toISOString().slice(0, 10); }
  if (isStreakMilestone(streak)) out.push({ kind: 'streak', days: streak });
  return out;
}

