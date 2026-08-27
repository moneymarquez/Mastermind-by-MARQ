import { askClaude } from '../lib/ai';
import type { AuditQuestion } from './types';

/** The analysis engine (Part 2 of the Client Audit/Analysis/Invoicing
 *  build) — takes a client's audit answers (grouped by the editable
 *  audit_questions bank, not a hardcoded set) and produces a proposal in
 *  the exact five-section format already proven for client work: Where
 *  Things Stand Today / What Sets Them Apart / The Plan / Investment /
 *  Next Steps. Investment is deliberately left as a placeholder — pricing
 *  itself lives in the Package & Pricing Builder (client_pricing_items),
 *  not invented by the model. Cristopher reviews and hand-edits the
 *  output before anything is sent; "Regenerate" just re-runs this against
 *  whatever the current answers are. */
export async function generateClientAnalysis(
  businessName: string,
  questions: AuditQuestion[],
  answers: Record<string, string>,
): Promise<string> {
  let currentCategory = '';
  let qa = '';
  for (const q of questions) {
    if (q.category !== currentCategory) {
      currentCategory = q.category;
      qa += `\n### ${currentCategory}\n`;
    }
    qa += `\n${q.prompt}\nAnswer: ${answers[q.key]?.trim() || '(not answered)'}\n`;
  }

  return askClaude({
    system:
      `You are Nova, writing a marketing audit and proposal for Cristopher (Made by Marq) to send to a prospective ` +
      `client, "${businessName}". He just ran a discovery conversation covering rapport, vision, positioning, unit ` +
      'economics, marketing/acquisition, lifetime value, and the core bottleneck — the answers below are grouped by ' +
      'category, in his own words (or the client\'s, if this came from the public questionnaire). ' +
      'Write the proposal in exactly this structure, using these five markdown ## headers in this exact order: ' +
      '"Where Things Stand Today", "What Sets Them Apart", "The Plan", "Investment", "Next Steps". ' +
      '## Where Things Stand Today — an honest, specific read of their current position based on the answers, no ' +
      'generic filler. ## What Sets Them Apart — pull out genuine differentiators from what they actually told you, ' +
      'even if they did not frame it that way themselves. ## The Plan — a concrete, phased marketing plan that ' +
      'directly addresses their stated bottleneck and acquisition gaps. ## Investment — write one short placeholder ' +
      'paragraph noting the specific pricing is attached separately as its own proposal; do not invent dollar ' +
      'amounts here, Cristopher fills those in from his own pricing builder. ## Next Steps — 2 to 4 concrete next ' +
      'actions. Be direct and specific, grounded only in what they actually said — never invent numbers or facts ' +
      'they did not give you, and never leave a section blank.',
    messages: [{ role: 'user', content: qa }],
    maxTokens: 2000,
  });
}
