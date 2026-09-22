import { askClaude, extractJson } from '../lib/ai';
import type { CampaignContext, StepId } from './campaignBuilder';
import { STEPS } from './campaignBuilder';

const SYSTEM = 'You help build a marketing campaign inside Masterminds by MARQ, a small-business tool. Be concrete, plain, short. Never invent numbers or facts that were not given.';

function situation(ctx: CampaignContext): string {
  const parts = [`Campaign for: ${ctx.isInternal ? 'Made by MARQ (the user\'s own agency, cold-calling local businesses)' : ctx.clientName}`];
  if (ctx.industry) parts.push(`Industry: ${ctx.industry}`);
  if (ctx.businessModel) parts.push(`Business model: ${ctx.businessModel}`);
  if (ctx.budgetAmount != null) parts.push(`Budget on file: $${ctx.budgetAmount}${ctx.budgetPeriod ? ` / ${ctx.budgetPeriod}` : ''}`);
  for (const s of STEPS) {
    const a = ctx.answers[s.id];
    if (!a) continue;
    const text = [a.choice, ...(a.choices ?? []), a.custom].filter(Boolean).join(', ');
    if (text) parts.push(`${s.title}: ${text}`);
  }
  return parts.join('\n');
}

/** Reads a free-text answer back in one line so the user sees what the
 *  builder understood. Informational; the answer is saved either way. */
export async function interpretAnswer(stepTitle: string, text: string, ctx: CampaignContext): Promise<string> {
  const out = await askClaude({
    system: SYSTEM,
    messages: [{ role: 'user', content: `${situation(ctx)}\n\nFor the "${stepTitle}" step the user wrote:\n"""${text}"""\n\nIn at most 22 words, restate what this means for the campaign, as a decision. No preamble, no quotes.` }],
    maxTokens: 80,
  });
  return out.trim().replace(/^["“]|["”]$/g, '');
}

/** Pulls step answers out of a discovery-call transcript. Returns only
 *  the steps it could actually find; everything comes back as free text
 *  the user still confirms step by step. */
export async function prefillFromTranscript(transcript: string, ctx: CampaignContext): Promise<Partial<Record<StepId, string>>> {
  const out = await askClaude({
    system: SYSTEM,
    effort: 'medium',
    messages: [{ role: 'user', content:
      `${situation(ctx)}\n\nHere is a call transcript:\n"""${transcript.slice(0, 24000)}"""\n\n` +
      'Extract, ONLY where the transcript actually says so, one short plain sentence for each of these campaign steps: objective (what the campaign is for), audience (who specifically), offer (what is offered and why anyone cares), hook (the angle or opening line), channels (where it should run), budget (money available), measurement (what success looks like as a number). ' +
      'Reply with a JSON object whose keys are a subset of: objective, audience, offer, hook, channels, budget, measurement. Omit keys the transcript does not support. No other text.' }],
    maxTokens: 700,
  });
  const parsed = extractJson<Record<string, unknown>>(out);
  const allowed: StepId[] = ['objective', 'audience', 'offer', 'hook', 'channels', 'budget', 'measurement'];
  const result: Partial<Record<StepId, string>> = {};
  for (const k of allowed) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim()) result[k] = v.trim();
  }
  return result;
}

/** Rewrites the generated plan as a tighter one-pager. Same facts, better
 *  prose; the deterministic version stays one click away. */
export async function polishPlan(markdown: string, ctx: CampaignContext): Promise<string> {
  const out = await askClaude({
    system: SYSTEM,
    effort: 'medium',
    messages: [{ role: 'user', content: `${situation(ctx)}\n\nHere is a campaign plan in markdown:\n\n${markdown}\n\nRewrite it as a tight one-page plan someone else could run tomorrow. Keep every section and every number exactly; keep the checklist as checkboxes; make each section 1–4 sentences of plain instruction. Return markdown only.` }],
    maxTokens: 1400,
  });
  const fenced = out.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : out).trim();
}
