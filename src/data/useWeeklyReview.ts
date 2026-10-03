import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { askClaude, extractJson, AiError } from '../lib/ai';
import { computeInvoiceTotal } from './invoiceAmount';
import { dateStr, weekStartOf } from './time';

export interface WeeklyReview {
  id: string;
  week_start: string;
  summary: string;
  recommended_actions: string[];
  generated_at: string;
  // schema_118 — the self-written review. Absent until that's run.
  went_well?: string | null;
  didnt?: string | null;
  one_change?: string | null;
  rating?: number | null;
  submitted_at?: string | null;
}

export type SelfReview = { went_well: string; didnt: string; one_change: string; rating: number | null };

interface ReviewResult {
  summary: string;
  recommended_actions: string[];
}

async function gatherWeekData(startStr: string, endStr: string) {
  const [txRes, invRes, callsRes, benderRes, goalsRes, decisionsRes] = await Promise.all([
    supabase.from('budget_transactions').select('type, amount').gte('occurred_on', startStr).lt('occurred_on', endStr),
    supabase.from('client_documents').select('label, data').eq('doc_type', 'invoice').eq('status', 'paid').gte('paid_at', startStr).lt('paid_at', endStr),
    supabase.from('call_outcomes').select('outcome').gte('call_date', startStr).lt('call_date', endStr),
    supabase.from('bender_sessions').select('id, started_at').gte('started_at', startStr).lt('started_at', endStr),
    supabase.from('goals').select('title, progress_pct, deadline').lt('progress_pct', 100),
    supabase.from('decisions').select('title, outcome_rating').eq('status', 'reviewed').gte('reviewed_at', startStr).lt('reviewed_at', endStr),
  ]);

  const income = (txRes.data ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    + (invRes.data ?? []).reduce((s, i) => s + computeInvoiceTotal(i.data as Record<string, unknown>), 0);
  const expense = (txRes.data ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const calls = callsRes.data ?? [];
  const appointmentsSet = calls.filter((c) => c.outcome === 'appointment_set').length;
  const streakBroken = (benderRes.data ?? []).length > 0;
  const goals = goalsRes.data ?? [];
  const decisions = decisionsRes.data ?? [];

  return {
    income, expense, net: income - expense,
    callsMade: calls.length, appointmentsSet,
    streakBroken,
    goals: goals.map((g) => `"${g.title}" at ${Math.round(Number(g.progress_pct))}%${g.deadline ? `, due ${g.deadline}` : ''}`),
    decisions: decisions.map((d) => `"${d.title}" — ${d.outcome_rating}`),
  };
}

export function useWeeklyReview() {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('weekly_reviews').select('*').order('week_start', { ascending: false });
    setReviews((data ?? []).map((r) => ({ ...r, recommended_actions: r.recommended_actions as string[] })) as WeeklyReview[]);
  }, []);

  const generateFor = useCallback(async (weekStartStr: string): Promise<boolean> => {
    const weekEnd = new Date(`${weekStartStr}T00:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = dateStr(weekEnd);
    const data = await gatherWeekData(weekStartStr, weekEndStr);

    const text = await askClaude({
      system:
        "You are Nova, writing Cristopher's self-writing weekly review inside Mastermind by MARQ, pulling across every module. " +
        'Be a straight read: what actually moved, what stalled, what he avoided. Accuracy over encouragement — do not flatter or soften. ' +
        'Respond with ONLY a JSON object: {"summary": string (a direct paragraph-or-two review), "recommended_actions": string[] (3-5 specific, concrete actions for the coming week, derived from the data — not generic advice)}',
      messages: [{
        role: 'user',
        content:
          `This week's data (${weekStartStr} to ${weekEndStr}):\n` +
          `- Money: $${data.income.toFixed(0)} in, $${data.expense.toFixed(0)} out, net $${data.net.toFixed(0)}\n` +
          `- Calls: ${data.callsMade} made, ${data.appointmentsSet} appointments set\n` +
          `- Sobriety streak: ${data.streakBroken ? 'broke this week' : 'held all week'}\n` +
          `- Active goals: ${data.goals.length ? data.goals.join('; ') : 'none tracked'}\n` +
          `- Decisions reviewed: ${data.decisions.length ? data.decisions.join('; ') : 'none'}`,
      }],
      maxTokens: 900,
    });
    const parsed = extractJson<ReviewResult>(text);
    const { error: err } = await supabase.from('weekly_reviews').upsert(
      { week_start: weekStartStr, summary: parsed.summary, recommended_actions: parsed.recommended_actions, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,week_start' }
    );
    return !err;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      // Auto-generate the most recently COMPLETED week's review the first
      // time it's visited after that week ends — "every week, the AI
      // automatically generates a review" without the user having to ask.
      // Only ever targets a finished week (never the in-progress one), so
      // it's always a read on a complete 7 days, not a partial one.
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
      const lastCompleteWeekStart = dateStr(weekStartOf(dateStr(sevenAgo)));
      const { data: existing } = await supabase.from('weekly_reviews').select('id').eq('week_start', lastCompleteWeekStart).maybeSingle();
      if (!existing) {
        try {
          await generateFor(lastCompleteWeekStart);
          await load();
        } catch {
          // Silent — the manual "Generate" button covers this if the
          // automatic attempt fails (e.g. AI not configured yet).
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCurrentWeek = async () => {
    setGenerating(true);
    setError('');
    try {
      const currentWeekStart = dateStr(weekStartOf(dateStr(new Date())));
      await generateFor(currentWeekStart);
      await load();
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not generate the review.');
    } finally {
      setGenerating(false);
    }
  };

  /** Nova's draft for a given week (Sunday start). */
  const draftFor = async (weekStartStr: string) => {
    setGenerating(true);
    setError('');
    try {
      await generateFor(weekStartStr);
      await load();
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not draft the review.');
    } finally {
      setGenerating(false);
    }
  };

  /** Saves your own answers and rating for a week. Leaves Nova's draft as is. */
  const saveSelf = async (weekStartStr: string, r: SelfReview): Promise<string | null> => {
    const existing = reviews.find((x) => x.week_start === weekStartStr);
    const { error: err } = await supabase.from('weekly_reviews').upsert(
      { week_start: weekStartStr, summary: existing?.summary ?? '', ...r, submitted_at: new Date().toISOString() },
      { onConflict: 'user_id,week_start' }
    );
    if (err) return /column|schema cache/i.test(err.message) ? 'Saving your own review needs supabase/schema_118_weekly_review_self.sql run first.' : err.message;
    await load();
    return null;
  };

  return { reviews, loading, generating, error, generateCurrentWeek, draftFor, saveSelf };
}
