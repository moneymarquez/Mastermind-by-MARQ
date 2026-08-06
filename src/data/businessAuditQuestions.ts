import type { Question } from './scalingPlannerQuestions';

// Sourced from Cristopher's "Scaling 101" curriculum (8 phases / 30 topics:
// Foundation, Funnel Mastery, Traffic & Acquisition, Retention & LTV, Data &
// Analytics, Systems & Operations, Advanced Scaling, Elite Level).
//
// Not every topic in that curriculum is something a single question can
// audit — several (The Scaling Mindset, Psychology of Scaling Leaders,
// Cohort Analysis, Attribution modeling, RevOps, Brand Building, PE
// valuation mechanics) are frameworks to *learn*, not things you can
// diagnose with one prompt. This set keeps to the CRITICAL/HIGH-priority
// topics that map to a concrete, answerable diagnostic question, one per
// topic, grouped by the curriculum's own phases. That's the judgment call
// worth checking: 16 questions across 7 phases, not all 30 topics.
export const BUSINESS_AUDIT_QUESTIONS: Question[] = [
  // Phase 1 — The Foundation
  {
    key: 'unitEconomics',
    phase: 'The Foundation',
    priority: 'CRITICAL',
    prompt: "What's your CAC (cost to acquire one customer) and LTV (lifetime value per customer) — does LTV clear at least 3x CAC?",
    insight: "Most businesses fail to scale because they're scaling a loss. If LTV < CAC, no amount of hustle fixes it.",
    study: "Alex Hormozi's $100M Offers",
  },
  {
    key: 'icp',
    phase: 'The Foundation',
    priority: 'HIGH',
    prompt: 'Can you describe your ideal customer in one specific sentence — the exact person who buys fastest, pays most, and churns least?',
    insight: 'The riches are in the niches. Narrow your ICP until it feels too small — that’s where the money is.',
    study: "April Dunford's Obviously Awesome",
  },
  {
    key: 'bottleneck',
    phase: 'The Foundation',
    priority: 'HIGH',
    prompt: "What's the ONE thing slowing everything else down right now?",
    insight: 'Systems thinking vs. hustle thinking — you build machines, not just grind harder.',
    study: 'Zero to One by Peter Thiel',
  },

  // Phase 2 — Funnel Mastery
  {
    key: 'funnelVisibility',
    phase: 'Funnel Mastery',
    priority: 'CRITICAL',
    prompt: "Do you know exactly where prospects drop off between 'stranger' and 'paying customer'? Where's the biggest leak?",
    insight: 'A 1% improvement at the bottom of the funnel beats 100% more traffic at the top.',
    study: "Russell Brunson's DotCom Secrets",
  },
  {
    key: 'offerStrength',
    phase: 'Funnel Mastery',
    priority: 'CRITICAL',
    prompt: 'How strong is your core offer — guarantee, risk reversal, value stack? Would a stranger feel silly saying no?',
    insight: "Engineer your offer, don't just set a price.",
    study: '$100M Offers by Alex Hormozi',
  },
  {
    key: 'conversionRate',
    phase: 'Funnel Mastery',
    priority: 'CRITICAL',
    prompt: "What's your current conversion rate at your main funnel step, and are you actively testing to improve it?",
    insight: 'CRO is free money — doubling conversion rate doubles revenue with zero extra ad spend.',
    study: 'ConversionXL blog',
  },

  // Phase 3 — Traffic & Acquisition
  {
    key: 'primaryChannel',
    phase: 'Traffic & Acquisition',
    priority: 'CRITICAL',
    prompt: "What's your primary acquisition channel today, and what's your CAC or ROAS on it?",
    insight: 'Master ONE channel before adding the second — dilution kills momentum.',
    study: 'Meta Blueprint (free)',
  },
  {
    key: 'organicAsset',
    phase: 'Traffic & Acquisition',
    priority: 'HIGH',
    prompt: 'Do you have any organic, compounding channel running — SEO, content, short-form video?',
    insight: 'Organic is slow but it compounds. Paid dies the moment you stop paying.',
    study: 'Backlinko (Brian Dean)',
  },
  {
    key: 'referralEngine',
    phase: 'Traffic & Acquisition',
    priority: 'HIGH',
    prompt: 'Do you have a referral or word-of-mouth engine, and roughly what share of new customers comes from it?',
    insight: 'Dropbox grew 3,900% in 15 months on a referral program alone.',
    study: "Nir Eyal's Hooked",
  },

  // Phase 4 — Retention & LTV
  {
    key: 'churn',
    phase: 'Retention & LTV',
    priority: 'CRITICAL',
    prompt: 'What’s your churn rate, and do you actually know why customers leave — or are you guessing?',
    insight: 'A 5% increase in retention increases profits by 25–95%.',
    study: "David Skok's SaaS metrics blog",
  },
  {
    key: 'onboarding',
    phase: 'Retention & LTV',
    priority: 'HIGH',
    prompt: 'Do new customers have a defined path to a quick win in their first 30 days?',
    insight: "The first 30 days predict lifetime. No quick win, and they're mentally gone even if still paying.",
    study: 'Never Lose a Customer Again by Joey Coleman',
  },

  // Phase 5 — Data & Analytics
  {
    key: 'northStar',
    phase: 'Data & Analytics',
    priority: 'CRITICAL',
    prompt: "What's your North Star Metric, and do you review your core numbers on a fixed weekly rhythm?",
    insight: "You cannot scale what you're not watching, every single week.",
    study: 'a16z metrics guide',
  },

  // Phase 6 — Systems & Operations
  {
    key: 'sops',
    phase: 'Systems & Operations',
    priority: 'CRITICAL',
    prompt: 'What percentage of your business runs on documented SOPs versus tribal knowledge that only lives in your head?',
    insight: "McDonald's runs on teenagers following SOPs. Your business should work regardless of who's in the seat.",
    study: 'The E-Myth Revisited',
  },
  {
    key: 'founderBottleneck',
    phase: 'Systems & Operations',
    priority: 'HIGH',
    prompt: 'Is there a critical process right now that only works because you personally do it?',
    insight: 'You can only scale as fast as you can delegate. Your ceiling is tied to your willingness to let go.',
    study: 'Traction by Gino Wickman',
  },
  {
    key: 'runway',
    phase: 'Systems & Operations',
    priority: 'HIGH',
    prompt: 'How many months of runway do you have if revenue dropped for 2 months straight?',
    insight: 'Most businesses fail not from bad ideas but from running out of cash.',
    study: 'CFI free courses',
  },

  // Phase 7 — Advanced Scaling / Elite Level
  {
    key: 'moat',
    phase: 'Advanced Scaling',
    priority: 'HIGH',
    prompt: "What's stopping the next person from copying exactly what you do?",
    insight: "Build your moat before you scale — it's what makes the growth defensible.",
    study: 'Good Strategy Bad Strategy by Richard Rumelt',
  },
];

/** Deterministic template synthesis grouped by curriculum phase, with a thin-
 *  answer gap check — a stand-in for a real scored audit until the Nova LLM
 *  layer exists (see BusinessAuditsScreen). */
export function generateAuditSummary(answers: Record<string, string>): string {
  let out = '# Business Audit Summary\n\nStructured around the Scaling 101 curriculum — Foundation, Funnel, Traffic, Retention, Data, Systems, Advanced Scaling.\n';

  let currentPhase = '';
  for (const q of BUSINESS_AUDIT_QUESTIONS) {
    if (q.phase !== currentPhase) {
      currentPhase = q.phase ?? '';
      out += `\n## ${currentPhase}\n`;
    }
    const answer = answers[q.key]?.trim() || '— not answered —';
    out += `\n${q.prompt}\n${answer}\n`;
  }

  const gaps = BUSINESS_AUDIT_QUESTIONS.filter((q) => (answers[q.key]?.trim().length ?? 0) < 8);
  out += '\n## Where the gaps are\n';
  out += gaps.length
    ? gaps.map((g) => `- [${g.priority}] ${g.prompt}\n  ${g.insight}`).join('\n')
    : 'No thin answers — every question got a real answer. Good sign.';

  return out;
}
