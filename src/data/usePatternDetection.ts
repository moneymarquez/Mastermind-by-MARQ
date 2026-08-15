import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { askClaude, extractJson, AiError } from '../lib/ai';
import { dateStr, weekStartOf } from './time';

export type Confidence = 'low' | 'medium' | 'high';

export interface PatternInsight {
  id: string;
  summary: string;
  confidence: Confidence;
  modules: string[];
  generated_at: string;
}

interface WeekBucket {
  weekStart: string;
  spend: number;
  income: number;
  streakBroken: boolean;
  calls: number;
  workouts: number;
}

const WEEKS_BACK = 10;

function addDays(d: string, n: number): string {
  const date = new Date(`${d}T00:00:00`);
  date.setDate(date.getDate() + n);
  return dateStr(date);
}

async function gatherWeeklySeries(): Promise<WeekBucket[]> {
  const today = dateStr(new Date());
  const windowStart = addDays(dateStr(weekStartOf(today)), -7 * WEEKS_BACK);

  const [txRes, benderRes, callsRes, workoutsRes] = await Promise.all([
    supabase.from('budget_transactions').select('type, amount, occurred_on').gte('occurred_on', windowStart),
    supabase.from('bender_sessions').select('started_at').gte('started_at', windowStart),
    supabase.from('call_outcomes').select('call_date').gte('call_date', windowStart),
    supabase.from('fitness_workouts').select('workout_date').gte('workout_date', windowStart),
  ]);

  const buckets: WeekBucket[] = [];
  for (let i = WEEKS_BACK - 1; i >= 0; i--) {
    const weekStart = addDays(dateStr(weekStartOf(today)), -7 * i);
    const weekEnd = addDays(weekStart, 7);
    const spend = (txRes.data ?? []).filter((t) => t.type === 'expense' && t.occurred_on >= weekStart && t.occurred_on < weekEnd).reduce((s, t) => s + Number(t.amount), 0);
    const income = (txRes.data ?? []).filter((t) => t.type === 'income' && t.occurred_on >= weekStart && t.occurred_on < weekEnd).reduce((s, t) => s + Number(t.amount), 0);
    const streakBroken = (benderRes.data ?? []).some((b) => dateStr(new Date(b.started_at)) >= weekStart && dateStr(new Date(b.started_at)) < weekEnd);
    const calls = (callsRes.data ?? []).filter((c) => c.call_date >= weekStart && c.call_date < weekEnd).length;
    const workouts = (workoutsRes.data ?? []).filter((w) => w.workout_date >= weekStart && w.workout_date < weekEnd).length;
    buckets.push({ weekStart, spend, income, streakBroken, calls, workouts });
  }
  return buckets;
}

export function usePatternDetection() {
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pattern_insights').select('*').order('generated_at', { ascending: false }).limit(10);
    setInsights((data ?? []) as PatternInsight[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setGenerating(true);
    setError('');
    try {
      const weeks = await gatherWeeklySeries();
      const activeWeeks = weeks.filter((w) => w.spend || w.income || w.calls || w.workouts || w.streakBroken).length;
      if (activeWeeks < 4) {
        setError(`Only ${activeWeeks} week${activeWeeks === 1 ? '' : 's'} of real activity so far — need at least 4 with some data logged before a correlation read means anything.`);
        setGenerating(false);
        return;
      }
      const table = weeks.map((w) =>
        `${w.weekStart}: spend $${w.spend.toFixed(0)}, income $${w.income.toFixed(0)}, sobriety streak ${w.streakBroken ? 'broke' : 'held'}, ${w.calls} calls, ${w.workouts} workouts`
      ).join('\n');
      const text = await askClaude({
        system:
          'You are Nova, looking for real correlations across Cristopher\'s own weekly data inside Mastermind by MARQ — spending vs. sobriety, call volume vs. income, workouts vs. call volume, and any other real pattern in the numbers given. ' +
          'Only report a correlation you can actually see repeated in the data — do not invent one. Be explicit that correlation is not causation; never claim one thing caused another, only that they moved together. ' +
          'Respond with ONLY a JSON object: {"insights": [{"summary": string, "confidence": "low"|"medium"|"high", "modules": string[]}]} — modules should be short labels like "budgeting", "sobriety", "dialing", "fitness". Return an empty array if nothing real stands out.',
        messages: [{ role: 'user', content: `${WEEKS_BACK} weeks of my real data, oldest first:\n\n${table}\n\nWhat correlations do you actually see?` }],
        maxTokens: 700,
      });
      const parsed = extractJson<{ insights: { summary: string; confidence: Confidence; modules: string[] }[] }>(text);
      if (parsed.insights.length === 0) {
        setError('No real correlation stood out in your data yet — that\'s an honest read, not a failure. Check back after a few more weeks of activity.');
      } else {
        await supabase.from('pattern_insights').insert(
          parsed.insights.map((i) => ({ summary: i.summary, confidence: i.confidence, modules: i.modules }))
        );
        await load();
      }
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not run pattern detection.');
    } finally {
      setGenerating(false);
    }
  };

  const dismiss = async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    await supabase.from('pattern_insights').delete().eq('id', id);
  };

  return { insights, loading, generating, error, refresh, dismiss };
}
