import { askClaude, extractJson } from './ai';
import type { MarketingBrief } from '../data/useMarketingBriefs';
import type { MarketingPlay } from '../data/useMarketingPlays';

export interface BuildOutVariant {
  headline: string;
  body: string;
}

export interface BuildOutResult {
  /** What kind of primary asset this actually is for the picked play —
   *  "Search ad copy," "GBP post," "Talking points for the pitch," etc.
   *  The build prompt names several possible asset kinds (ad copy,
   *  headlines, GBP description, captions); which ones actually apply
   *  depends on the play, so the model names its own lead asset instead
   *  of every kit being forced into the same shape. */
  primary_asset_label: string;
  /** Exactly three variants of the primary asset — the build prompt's
   *  own requirement. */
  variants: BuildOutVariant[];
  /** A social caption to pair with the primary asset — null when the
   *  play isn't a social/visual channel. */
  caption: string | null;
  /** A Google Business Profile description — only when the business
   *  actually has a local/service-area presence. */
  gbp_description: string | null;
  /** Concrete photo/video instructions — real, shootable shots, not
   *  vague direction. */
  shot_list: string[];
  /** 2-4 sentences of creative direction tying the shots back to the
   *  positioning statement and the play's own rationale. */
  creative_direction: string;
}

/** Generates the build-out for one already-picked play. Unlike the slate
 *  engine (deterministic, rule-based — its output has pass/fail
 *  validation cases), this is genuinely a creative-generation task where
 *  an LLM call is the right tool: there's no fixed correct answer to
 *  three ad copy variants, only better or worse ones. */
export async function generateBuildOut(play: MarketingPlay, brief: MarketingBrief, clientName: string): Promise<BuildOutResult> {
  const text = await askClaude({
    system:
      "You are building out ONE already-picked marketing play for a real small-business client inside Mastermind by MARQ's Marketing module. " +
      'The operator already chose this play from a slate — your job is not to suggest alternatives, only to build this one out in full. ' +
      'Rules: never predict outcomes or invent numbers/results in the copy (no "increase sales by 20%" type claims) — write copy that sells the offer, not a fabricated result. ' +
      "Use the client's actual positioning statement and target audience when given; if either is missing, write generically rather than inventing specifics about the business. " +
      "Respect any \"must avoid\" constraints exactly. Match the primary asset to what this specific play actually needs (a search ad needs headline+description pairs; a GBP or social play needs a caption and maybe a GBP description; an offline/outreach play needs talking points, not ad copy). " +
      'Only include gbp_description when the play is genuinely local/service-area relevant — otherwise null. Only include caption when a caption actually applies — otherwise null. ' +
      'shot_list must be concrete and shootable (e.g. "Close-up of the [specific dish] being handed through the truck window, natural light, no flash") — never vague ("nice lifestyle photo"). ' +
      'Respond with ONLY JSON: {"primary_asset_label": string, "variants": [{"headline": string, "body": string}, {"headline": string, "body": string}, {"headline": string, "body": string}], "caption": string | null, "gbp_description": string | null, "shot_list": [string, ...], "creative_direction": string}',
    messages: [{
      role: 'user',
      content: [
        `Client: ${clientName || 'this client'}`,
        `Business model: ${brief.business_model ?? 'not set'}`,
        `Play to build out: ${play.title} (${play.category})`,
        `Why this play: ${play.rationale}`,
        `Positioning statement: ${brief.positioning_statement ?? 'not set'}`,
        `Target audience: ${brief.target_audience ?? 'not set'}`,
        `Must avoid: ${brief.must_avoid ?? 'none noted'}`,
        `Diagnosed leak: ${brief.primary_leak ?? 'not set'}${brief.leak_note ? ` — ${brief.leak_note}` : ''}`,
        '',
        'Build this play out in full.',
      ].join('\n'),
    }],
    maxTokens: 2000,
    effort: 'medium',
  });
  return extractJson<BuildOutResult>(text);
}
