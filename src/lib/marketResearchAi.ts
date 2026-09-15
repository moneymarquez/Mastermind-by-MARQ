import { askClaude, extractJson } from './ai';
import type { ResearchSource } from '../data/marketResearchSources';
import type { MarketingBrief } from '../data/useMarketingBriefs';

/** Generates the industry-specific swap-in sources for an industry with
 *  no pre-written entry in marketResearchSources.ts's INDUSTRY_SOURCES —
 *  "generate checklist on the fly for unlisted industries," per the
 *  build prompt. Only ever asked for 2-3 sources, matching the
 *  pre-written sets' own shape, so the total stays in the same 5-8 range
 *  regardless of whether an industry was pre-written or generated. */
export async function generateIndustrySources(industry: string): Promise<ResearchSource[]> {
  const text = await askClaude({
    system:
      'You generate market-research source checklists for a small-business marketing operator. ' +
      'Given one specific industry, produce 2-3 REAL, genuinely checkable research sources specific to that industry — not the generic demographic sources already covered elsewhere (Census, Google Trends, Meta Ads Manager) — things like industry-specific review platforms, permit/licensing registries, trade directories, seasonal search patterns, or competitive density signals that a real operator could actually go look up today. ' +
      'Each source needs a real, working link where reasonably possible (a real domain, not a fabricated URL) — if no single authoritative site exists, link to a sensible search query instead. ' +
      'Respond with ONLY JSON: {"sources": [{"key": string (snake_case), "title": string, "link": string, "lookFor": string, "whyItMatters": string}]}',
    messages: [{ role: 'user', content: `Industry: ${industry}\n\nGenerate 2-3 industry-specific research sources.` }],
    maxTokens: 800,
  });
  const parsed = extractJson<{ sources: ResearchSource[] }>(text);
  return parsed.sources ?? [];
}

/** Interprets one pasted-in research number into a short, actionable
 *  read — the build prompt's own worked example: "Median income 12%
 *  below metro — lead with value and portion size, not premium
 *  framing." Deliberately terse (1-2 sentences) and creative/placement-
 *  focused, never a demographic-ad-targeting suggestion — the panel's
 *  own caution banner (platforms restrict several attributes) has to be
 *  true of what this function actually produces, not just a UI label. */
export async function interpretResearchValue(sourceTitle: string, lookFor: string, valueEntered: string, brief: MarketingBrief, clientName: string): Promise<string> {
  const text = await askClaude({
    system:
      "You read one real research number an operator just looked up and pasted in, for a specific small-business client, and give a short, actionable read — 1-2 sentences, in the exact style of: \"Median income 12% below metro — lead with value and portion size, not premium framing.\" " +
      'Only talk about how this should shape CREATIVE, MESSAGING, or PLACEMENT decisions — never suggest using this number to target an ad by demographic attribute (age, income, race, etc.) on an ad platform; several of those are restricted or illegal to target on directly, and that is not what this data is for. ' +
      "Never invent numbers or predict outcomes — you're interpreting what they entered, not adding new claims. If the value doesn't clearly mean anything actionable, say that plainly instead of forcing an insight.",
    messages: [{
      role: 'user',
      content: [
        `Client: ${clientName || 'this client'}`,
        `Business model: ${brief.business_model ?? 'not set'}`,
        `Positioning statement: ${brief.positioning_statement ?? 'not set'}`,
        `Source: ${sourceTitle}`,
        `What to look for: ${lookFor}`,
        `Value entered: ${valueEntered}`,
      ].join('\n'),
    }],
    maxTokens: 200,
  });
  return text.trim();
}
