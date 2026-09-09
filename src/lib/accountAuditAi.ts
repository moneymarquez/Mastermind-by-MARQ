import { askClaude, extractJson } from './ai';
import type { ContentGrowthPlan } from '../data/useContentGrowth';

export type PrimaryGap = 'no_clear_viewer' | 'too_many_pillars' | 'weak_hooks' | 'inconsistent_posting';

const PRIMARY_GAPS: PrimaryGap[] = ['no_clear_viewer', 'too_many_pillars', 'weak_hooks', 'inconsistent_posting'];

export interface AuditPost {
  caption: string;
  performance_note: string;
}

export interface AccountAuditInput {
  handle: string;
  statedViewer: string;
  posts: AuditPost[];
}

export interface AccountAuditResult {
  observed_pillars: string[];
  top_performers: { note: string }[];
  bottom_performers: { note: string }[];
  primary_gap: PrimaryGap;
  keep: string[];
  kill: string[];
  test: string[];
}

/** Compares what the operator SAYS they're posting for against what
 *  they're ACTUALLY posting, per the addendum's Screen 0. A genuine
 *  judgment call over free-text captions — unlike the slate's purpose
 *  branch (a hard, deterministically-verifiable dispatch), there's no
 *  categorical rule for "is this viewer unclear," so this is an LLM
 *  call, not a template, same reasoning as Marketing's build-out. The
 *  four-gap taxonomy and the "one gap, not four" framing are enforced
 *  in the prompt and re-checked against the fixed enum after the call
 *  returns, since this environment can't verify actual model output
 *  content directly. */
export async function generateAccountAudit(input: AccountAuditInput, plan: ContentGrowthPlan): Promise<AccountAuditResult> {
  const text = await askClaude({
    system:
      "You are auditing a real existing social account for a small-business operator inside Mastermind by MARQ's Content Creation module. " +
      "Compare what they SAY they're posting for (their stated viewer) against what they're ACTUALLY posting (the real captions and their own performance notes) and name the gap. " +
      'It is almost always exactly one of four: no_clear_viewer (posts address different people, so the platform can\'t tell who to show it to), too_many_pillars (more than five, nothing compounds), weak_hooks (the first 1-3 seconds don\'t earn the rest), or inconsistent_posting (volume too low or erratic to learn anything). ' +
      'Name exactly ONE primary_gap, not several — if multiple genuinely apply, pick whichever one unblocks the others (usually no_clear_viewer, then weak_hooks). ' +
      'Output exactly three lists — keep, kill, test — each item one line and actionable this week, not a report. ' +
      'Never recommend or imply buying followers or engagement, in any framing. Never promise a follower outcome from these fixes — say what changes and what to watch instead. ' +
      'observed_pillars is what they are ACTUALLY posting about, inferred from the real captions — not their stated pillars, and not invented topics absent from the pasted posts. ' +
      'top_performers/bottom_performers must only reflect what the operator told you about their own posts\' performance — never invent a number or a result they didn\'t report. ' +
      'Respond with ONLY JSON: {"observed_pillars": [string, ...], "top_performers": [{"note": string}, ...], "bottom_performers": [{"note": string}, ...], "primary_gap": "no_clear_viewer" | "too_many_pillars" | "weak_hooks" | "inconsistent_posting", "keep": [string, ...], "kill": [string, ...], "test": [string, ...]}',
    messages: [{
      role: 'user',
      content: [
        `Handle: ${input.handle}`,
        `Platform: ${plan.platform}`,
        `Stated viewer (who they SAY they're trying to reach): ${input.statedViewer || 'not stated'}`,
        '',
        `Last ${input.posts.length} posts (caption — operator's own performance note):`,
        ...input.posts.map((p, i) => `${i + 1}. "${p.caption}" — ${p.performance_note || 'no note given'}`),
        '',
        'Diagnose the gap and produce the keep/kill/test lists.',
      ].join('\n'),
    }],
    maxTokens: 1500,
    effort: 'medium',
  });
  const parsed = extractJson<AccountAuditResult>(text);
  if (!PRIMARY_GAPS.includes(parsed.primary_gap)) {
    throw new Error('Audit came back with an unrecognized gap — try again.');
  }
  return parsed;
}
