import { askClaude, extractJson } from './ai';
import type { Goal, GoalAction } from '../data/types';

export interface GoalIntake {
  title: string;
  why: string;
  category: string;
  targetDescription: string;
  deadline: string;
  constraints: string;
}

interface GeneratedPath {
  title: string;
  description: string;
  actions: GoalAction[];
  is_recommended: boolean;
}

export interface GoalReverseEngineering {
  target_metric: string;
  target_metric_value: number;
  reverse_engineered_summary: string;
  conflict_notes: string | null;
  check_in_cadence: 'daily' | 'weekly' | 'monthly';
  paths: GeneratedPath[];
}

function otherGoalsContext(otherGoals: Goal[]): string {
  if (otherGoals.length === 0) return '(no other active goals)';
  return otherGoals
    .map((g) => {
      const target = g.target_metric_value != null ? `${g.target_metric_value} ${g.target_metric ?? ''}`.trim() : g.target_cost != null ? `$${g.target_cost}` : 'no numeric target set';
      const committed = g.committed_path ? ` — committed to: ${g.committed_path.title}` : ' — not yet committed to a path';
      return `- ${g.title} (target: ${target}, deadline: ${g.deadline ?? 'none set'})${committed}`;
    })
    .join('\n');
}

// One Claude call does everything the spec calls for a new goal: reverse-
// engineer it into hard numbers, cross-check it against other active goals
// for real conflicts (don't just block — explain the tradeoff and let him
// decide), pick a sensible check-in cadence for the timeline, and generate
// 2-3 real paths (one clearly recommended) — each a full daily/weekly
// action list, not vague advice.
export async function generateGoalPlan(intake: GoalIntake, otherGoals: Goal[]): Promise<GoalReverseEngineering> {
  const text = await askClaude({
    system:
      "You are Nova, Cristopher's accountability coach. Every goal is a living contract — reverse-engineer it into " +
      'exact numbers and specific daily/weekly actions, stripping out the emotional weight of getting there. Be ' +
      'brutally specific, never vague. Before committing, cross-check the new goal against his other active goals ' +
      'below — if there\'s a real conflict (competing time, competing money, contradictory outcomes), name it ' +
      "plainly in conflict_notes and explain the tradeoff; don't just block it, he decides. If there's no real " +
      'conflict, conflict_notes should be null. Pick check_in_cadence based on the timeline: short-term goals ' +
      '(days/weeks) get "daily" or "weekly", long-term goals (months/years) get "monthly". ' +
      'Then generate exactly 2 or 3 distinct paths to get there — each with a real action list ' +
      '(description + frequency, e.g. "100 calls" / "daily"), proving it\'s achievable. Mark exactly one ' +
      'is_recommended: true. If one of the actions is literally making cold calls that Cristopher tracks in his ' +
      'Dialing section, set that action\'s auto_tracked_source to "dialing_calls" so its progress reads from real ' +
      'call data instead of manual checkboxes — only use that value for actual dialing/calling actions, omit the ' +
      'field otherwise. ' +
      'Respond with ONLY JSON matching exactly: {"target_metric": string (unit, e.g. "dollars saved", "calls per ' +
      'day", "lbs lost"), "target_metric_value": number, "reverse_engineered_summary": string (2-4 sentences, plain ' +
      'numbers and deadline, no fluff), "conflict_notes": string | null, "check_in_cadence": "daily"|"weekly"|"monthly", ' +
      '"paths": [{"title": string, "description": string (2-3 sentences), "actions": [{"description": string, ' +
      '"frequency": string, "auto_tracked_source": "dialing_calls" (omit if not applicable)}], "is_recommended": boolean}]}',
    messages: [
      {
        role: 'user',
        content:
          `Goal: ${intake.title}\nWhy it matters: ${intake.why || '(not given)'}\nCategory: ${intake.category || '(not given)'}\n` +
          `Target: ${intake.targetDescription || '(not given — infer something reasonable)'}\nDeadline: ${intake.deadline || '(not given — infer something reasonable)'}\n` +
          `Constraints: ${intake.constraints || '(none given)'}\n\nHis other active goals:\n${otherGoalsContext(otherGoals)}\n\nGenerate the plan.`,
      },
    ],
    maxTokens: 1800,
  });
  return extractJson<GoalReverseEngineering>(text);
}

// Live recalculation for a check-in — not just "how's it going," an actual
// pace read against the deadline and what today needs to look like.
export async function recalculateGoalPace(goal: Goal, recentCheckins: string[]): Promise<string> {
  const stepsStatus = goal.steps.map((s) => `- [${s.done ? 'x' : ' '}] ${s.description}${s.frequency ? ` (${s.frequency})` : ''}`).join('\n') || '(no steps)';
  return askClaude({
    system:
      "You are Nova, running a live check-in on one of Cristopher's committed goals. Do actual pace math: given the " +
      "target, deadline, and what's been completed, is he behind, on pace, or ahead? If behind, tell him plainly " +
      'what today needs to look like to catch up. If ahead, you can suggest pushing toward a stretch version of the ' +
      'goal. Not generic cheerleading — a real read. Plain text, 2-4 sentences.',
    messages: [
      {
        role: 'user',
        content:
          `Goal: ${goal.title}\nTarget: ${goal.target_metric_value ?? goal.target_cost ?? '?'} ${goal.target_metric ?? ''}\n` +
          `Deadline: ${goal.deadline ?? 'none set'}\nCurrent progress: ${goal.progress_pct}%\nSteps:\n${stepsStatus}\n\n` +
          `Recent check-ins:\n${recentCheckins.join('\n') || '(none yet)'}`,
      },
    ],
    maxTokens: 350,
  });
}
