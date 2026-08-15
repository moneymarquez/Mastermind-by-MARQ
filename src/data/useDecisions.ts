import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { askClaude, AiError } from '../lib/ai';

export type DecisionMode = 'emotional' | 'analytical' | 'mixed';
export type OutcomeRating = 'good' | 'mixed' | 'bad';

export interface Decision {
  id: string;
  title: string;
  reasoning: string;
  expected_outcome: string;
  confidence: number | null;
  mode: DecisionMode | null;
  review_date: string;
  status: 'pending' | 'reviewed';
  actual_outcome: string | null;
  outcome_rating: OutcomeRating | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface DecisionContext {
  netBudgetChange: number;
  sobrietyStreakHeld: boolean;
  callsLogged: number;
}

/** Pulls real, generic cross-module signal for the window since a decision
 *  was logged — not tailored to what the decision was specifically about
 *  (this app has no way to know that without asking Claude to classify
 *  free text, which is more machinery than a review-time context strip
 *  needs), but genuinely real numbers from the same window, not filler. */
export async function getDecisionContext(sinceIso: string): Promise<DecisionContext> {
  const sinceDate = sinceIso.slice(0, 10);
  const [txRes, benderRes, callsRes] = await Promise.all([
    supabase.from('budget_transactions').select('type, amount').gte('occurred_on', sinceDate),
    supabase.from('bender_sessions').select('id').gte('started_at', sinceIso).limit(1),
    supabase.from('call_outcomes').select('id', { count: 'exact', head: true }).gte('call_date', sinceDate),
  ]);
  const netBudgetChange = (txRes.data ?? []).reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  return {
    netBudgetChange,
    sobrietyStreakHeld: (benderRes.data ?? []).length === 0,
    callsLogged: callsRes.count ?? 0,
  };
}

export function useDecisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [pattern, setPattern] = useState<{ text: string; basedOnCount: number } | null>(null);
  const [generatingPattern, setGeneratingPattern] = useState(false);
  const [patternError, setPatternError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [decRes, patRes] = await Promise.all([
      supabase.from('decisions').select('*').order('review_date', { ascending: true }),
      supabase.from('decision_patterns').select('pattern_text, based_on_count').maybeSingle(),
    ]);
    setDecisions((decRes.data ?? []) as Decision[]);
    if (patRes.data) setPattern({ text: patRes.data.pattern_text, basedOnCount: patRes.data.based_on_count });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addDecision = async (input: { title: string; reasoning: string; expected_outcome: string; confidence: number | null; mode: DecisionMode | null; review_date: string }) => {
    await supabase.from('decisions').insert(input);
    await load();
  };

  const reviewDecision = async (id: string, actual_outcome: string, outcome_rating: OutcomeRating) => {
    await supabase.from('decisions').update({
      actual_outcome, outcome_rating, status: 'reviewed', reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    await load();
  };

  const removeDecision = async (id: string) => {
    await supabase.from('decisions').delete().eq('id', id);
    await load();
  };

  // Builds a genuine pattern read from the user's own reviewed decisions —
  // asks Claude to look for real correlations (confidence vs. outcome,
  // emotional vs. analytical vs. outcome) and to say plainly if there's
  // not yet enough history for a real read, rather than inventing one.
  const refreshPattern = async () => {
    const reviewed = decisions.filter((d) => d.status === 'reviewed');
    if (reviewed.length < 3) {
      setPatternError('Log outcomes for at least 3 decisions before asking for a pattern read — anything sooner would just be guessing.');
      return;
    }
    setGeneratingPattern(true);
    setPatternError('');
    try {
      const summary = reviewed.map((d) =>
        `- "${d.title}" — confidence ${d.confidence ?? 'n/a'}/5, ${d.mode ?? 'unspecified'} — expected: ${d.expected_outcome} — actual: ${d.actual_outcome} — rated ${d.outcome_rating}`
      ).join('\n');
      const text = await askClaude({
        system:
          "You are Nova, analyzing Cristopher's own logged-and-reviewed decisions inside Mastermind by MARQ's Decision Log. " +
          'Find real patterns in HIS judgment specifically — where his confidence tracked reality, where emotional vs. analytical calls diverged in outcome, what conditions correlate with his good calls. ' +
          "Be direct and specific, citing the actual decisions. If the sample is too thin or too uniform to say anything real, say that plainly instead of overclaiming. Keep it to 4-6 sentences.",
        messages: [{ role: 'user', content: `Here are my reviewed decisions:\n\n${summary}\n\nWhat patterns do you see in how I decide?` }],
        maxTokens: 500,
      });
      await supabase.from('decision_patterns').upsert(
        { pattern_text: text, based_on_count: reviewed.length, generated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      setPattern({ text, basedOnCount: reviewed.length });
    } catch (e) {
      setPatternError(e instanceof AiError ? e.message : 'Could not generate a pattern read.');
    } finally {
      setGeneratingPattern(false);
    }
  };

  return { decisions, loading, pattern, generatingPattern, patternError, addDecision, reviewDecision, removeDecision, refreshPattern };
}
