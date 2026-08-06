import type { Question } from './scalingPlannerQuestions';

// Generic, broadly-applicable audit questions — a placeholder structure.
// Swap this list out once the Scaling 101 material is provided; see
// BusinessAuditsScreen for the flag.
export const BUSINESS_AUDIT_QUESTIONS: Question[] = [
  { key: 'revenueTrend', prompt: 'How has revenue trended over the last 3–6 months?' },
  { key: 'topCosts', prompt: 'What are your 2–3 biggest cost centers right now?' },
  { key: 'acquisition', prompt: 'Where do most new customers actually come from today?' },
  { key: 'acquisitionCost', prompt: 'Roughly what does it cost you — time or money — to land one new customer?' },
  { key: 'retention', prompt: 'What percentage of customers stick around or come back?' },
  { key: 'churnReason', prompt: "When someone leaves or doesn't come back, what's the most common reason?" },
  { key: 'bottleneck', prompt: "What's the single biggest bottleneck slowing this business down right now?" },
  { key: 'teamGaps', prompt: 'Where are you (or your team) stretched thinnest?' },
  { key: 'process', prompt: "What's one process that's still manual and shouldn't be?" },
  { key: 'competitivePressure', prompt: 'Who is the competitor you think about most, and why?' },
  { key: 'differentiation', prompt: 'What makes you genuinely different from them?' },
  { key: 'pricing', prompt: "Do you feel like you're priced right — too low, too high, or about right?" },
  { key: 'cashRunway', prompt: 'How much runway or cash cushion do you have if revenue dropped for 2 months?' },
  { key: 'biggestWin', prompt: 'What was the biggest win from the last quarter?' },
  { key: 'focusNext', prompt: 'If you could only fix one thing in the next 90 days, what would it be?' },
];

/** Deterministic template synthesis — a stand-in for a real audit scored
 *  against the Scaling 101 framework, once that material is provided. */
export function generateAuditSummary(answers: Record<string, string>): string {
  const a = (k: string) => answers[k]?.trim() || '—';
  return `# Business Audit Summary

## Revenue & Costs
Revenue trend: ${a('revenueTrend')}
Biggest cost centers: ${a('topCosts')}

## Acquisition & Retention
Primary acquisition channel: ${a('acquisition')}
Cost to acquire a customer: ${a('acquisitionCost')}
Retention: ${a('retention')}
Most common churn reason: ${a('churnReason')}

## Operations
Biggest bottleneck: ${a('bottleneck')}
Team gaps: ${a('teamGaps')}
Manual process to fix: ${a('process')}

## Competitive Position
Top competitor: ${a('competitivePressure')}
Differentiation: ${a('differentiation')}
Pricing sense-check: ${a('pricing')}

## Resilience
Cash runway: ${a('cashRunway')}

## Momentum
Biggest recent win: ${a('biggestWin')}
Top priority for the next 90 days: ${a('focusNext')}
`;
}
