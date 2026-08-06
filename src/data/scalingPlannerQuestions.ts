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

/** Deterministic template synthesis — a stand-in for real Nova-generated
 *  synthesis until the LLM layer exists (see ScalingPlannerScreen). */
export function generatePlanText(answers: Record<string, string>): string {
  const a = (k: string) => answers[k]?.trim() || '—';
  return `# ${a('name') !== '—' ? a('name') : 'Untitled Business'} — Scaling Plan

## Overview
${a('oneLiner')}

## Why It Matters
${a('why')}

## Target Customer & Problem
Customer: ${a('customer')}
Problem being solved: ${a('problem')}

## Brand Direction
${a('brand')}

## Growth Strategy
Ambition: ${a('ambition')}
Revenue model: ${a('revenue')}

## Resources & Timeline
Resources available: ${a('resources')}
Target timeline: ${a('timeline')}

## Biggest Risk
${a('risk')}

## Definition of Success (12 months)
${a('success')}

## Immediate Next Step
${a('nextStep')}
`;
}
