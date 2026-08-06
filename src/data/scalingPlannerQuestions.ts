import { askClaude } from '../lib/ai';

export interface Question {
  key: string;
  prompt: string;
  /** Optional curriculum grounding (used by Business Audits) — the
   *  Scaling Planner's questions don't set these. */
  phase?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  insight?: string;
  study?: string;
}

export const SCALING_PLANNER_QUESTIONS: Question[] = [
  { key: 'name', prompt: "What's the business or idea called?" },
  { key: 'oneLiner', prompt: 'Describe it in one sentence.' },
  { key: 'why', prompt: 'Why does this matter to you personally?' },
  { key: 'customer', prompt: "Who's the target customer?" },
  { key: 'problem', prompt: 'What problem are you actually solving for them?' },
  { key: 'brand', prompt: 'What branding direction feels right — bold, minimal, premium, playful, something else?' },
  { key: 'ambition', prompt: 'Growth ambition: a lifestyle business you run solo, or something you want to scale aggressively?' },
  { key: 'revenue', prompt: 'How does it make money?' },
  { key: 'resources', prompt: 'What resources — time, money, people — do you have to put behind this right now?' },
  { key: 'timeline', prompt: "What's your target timeline to launch or go live?" },
  { key: 'risk', prompt: "What's the biggest risk or unknown standing in the way?" },
  { key: 'success', prompt: 'What does success look like 12 months from now?' },
  { key: 'nextStep', prompt: "What's the very next action you could take this week?" },
];

/** Real Nova synthesis — sends the questionnaire answers to Claude and gets
 *  back a genuine business plan, not a template fill-in. */
export async function generatePlanText(answers: Record<string, string>): Promise<string> {
  const qa = SCALING_PLANNER_QUESTIONS.map((q) => `${q.prompt}\n${answers[q.key]?.trim() || '(no answer)'}`).join('\n\n');
  return askClaude({
    system:
      "You are Nova, Cristopher's business-scaling strategist inside Mastermind by MARQ. He just answered a " +
      "guided questionnaire about a business idea — turn his answers into a real, useful scaling plan document. " +
      'Use markdown headers (##), be specific and actionable, call out weak spots in his answers rather than just ' +
      "restating them, and end with a concrete immediate next step. Don't pad with generic business-plan filler.",
    messages: [{ role: 'user', content: qa }],
    maxTokens: 1800,
  });
}
