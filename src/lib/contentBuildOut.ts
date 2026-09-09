import { askClaude, extractJson } from './ai';
import type { ContentGrowthPlan } from '../data/useContentGrowth';
import type { ContentIdea } from '../data/useContentIdeas';

export interface ContentBuildOutResult {
  /** Exactly three ways to open — "the hook written three ways so the
   *  operator can test which opening lands." */
  hook_variants: string[];
  script: string;
  shot_list: string;
  caption: string;
}

/** Generates the build-out for one already-picked content idea. Real
 *  creative generation, same reasoning as Marketing's build-out
 *  (marketingBuildOut.ts): unlike the slate's purpose branch, there's no
 *  fixed correct answer to a script or a shot list — only better or
 *  worse ones — so an LLM call is the right tool here, not a template. */
export async function generateContentBuildOut(idea: ContentIdea, plan: ContentGrowthPlan, clientName: string): Promise<ContentBuildOutResult> {
  const text = await askClaude({
    system:
      "You are building out ONE already-picked content idea for a real operator inside Mastermind by MARQ's Content Creation module. " +
      'The idea was already chosen from a slate — your job is not to suggest alternatives, only to build this one out in full. ' +
      'Rules: never promise a follower/view outcome anywhere in the script or caption (no "this will blow up," no invented numbers). ' +
      'Write for retention, not likes — the first line has to earn the next three seconds, and the script should keep giving a reason to keep watching, not front-load everything and coast. ' +
      'Never suggest or reference purchased followers, views, or engagement of any kind. ' +
      `This page's purpose is ${plan.page_purpose === 'audience_for_offer' ? "the operator's own audience-building page — lifestyle and build-in-public framing is on-strategy" : 'a client\'s lead-generation page — keep it narrow, local/business-specific, and conversion-focused, never build-in-public or personal-brand framing'}. ` +
      'shot_list must be concrete and shootable, in filming order (e.g. "Shot 1: close-up of hands doing X, natural light" — never vague "nice b-roll"). ' +
      'Respond with ONLY JSON: {"hook_variants": [string, string, string], "script": string, "shot_list": string, "caption": string}',
    messages: [{
      role: 'user',
      content: [
        `Account: ${clientName || 'this account'}`,
        `Platform: ${plan.platform}`,
        `Viewer: ${plan.niche_viewer ?? 'not set'}`,
        `Idea: ${idea.title}`,
        `Chosen hook line: ${idea.hook_line}`,
        `Pillar: ${idea.pillar ?? 'not set'}`,
        `Format: ${idea.format ?? 'not set'}`,
        `Why this idea: ${idea.rationale}`,
        '',
        'Build this idea out in full.',
      ].join('\n'),
    }],
    maxTokens: 1800,
    effort: 'medium',
  });
  return extractJson<ContentBuildOutResult>(text);
}
