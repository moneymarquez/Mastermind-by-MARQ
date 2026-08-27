import { askClaude } from '../lib/ai';
import {
  generateInternalAnalysis,
  matchServicesWith,
  type AnalysisQuestion,
  type AnalysisAnswers,
  type AnalysisConfidence,
} from './analysisEngine';
import type { AuditQuestion, Service, SuggestedService } from './types';

// The browser-side entry points into the analysis engine. The prompts and
// all the mode logic live in ./analysisEngine — this file only supplies the
// transport (askClaude, which needs the signed-in owner's Supabase session)
// and keeps the call signatures the CRM already uses.
//
// The public site cannot come through here: a prospect has no session, so
// askClaude throws for them. Its path is worker/handlers/audit.ts, which
// calls the SAME engine with a direct Anthropic transport instead. That
// split is why the engine takes an `ask` function rather than importing one.

/** The analysis engine, internal mode — takes a client's audit answers
 *  (grouped by the editable audit_questions bank, not a hardcoded set) and
 *  produces a proposal in the five-section format proven for client work:
 *  Where Things Stand Today / What Sets Them Apart / The Plan / Investment
 *  / Next Steps. Investment is deliberately left as a placeholder —
 *  pricing lives in the Package & Pricing Builder (client_pricing_items),
 *  not invented by the model. Cristopher reviews and hand-edits the output
 *  before anything is sent; "Regenerate" re-runs this against whatever the
 *  current answers are. */
export async function generateClientAnalysis(
  businessName: string,
  questions: AuditQuestion[],
  answers: Record<string, string>,
  confidence: Record<string, string> = {},
): Promise<string> {
  return generateInternalAnalysis(
    askClaude,
    businessName,
    questions as AnalysisQuestion[],
    answers as AnalysisAnswers,
    confidence as AnalysisConfidence,
  );
}

/** The Service Matcher — the branch that runs alongside the written
 *  analysis. Given the same audit answers plus the master catalog, Claude
 *  flags which services this business actually needs and why. Internal
 *  only: its output names real priced services and is never exposed to the
 *  public site. */
export async function matchServices(
  businessName: string,
  questions: AuditQuestion[],
  answers: Record<string, string>,
  confidence: Record<string, string>,
  catalog: Service[],
): Promise<SuggestedService[]> {
  return matchServicesWith(
    askClaude,
    businessName,
    questions as AnalysisQuestion[],
    answers as AnalysisAnswers,
    confidence as AnalysisConfidence,
    catalog,
  );
}
