import Anthropic from '@anthropic-ai/sdk';

// The Worker-native Claude transport. Mirrors what netlify/functions/claude.ts
// did, but runs here instead — Netlify is no longer part of the stack, and
// the public Made by Marq site needs a Claude path that does NOT require a
// signed-in Supabase session (a prospect has none).
//
// Same model and settings as the Netlify function it replaces, so nothing
// about existing AI features changes behaviourally. nodejs_compat is
// already on in wrangler.jsonc for the Stocks bot, which is what lets the
// SDK run here at all.
export const CLAUDE_MODEL = 'claude-opus-5';

export interface AskOptions {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  image?: { mediaType: string; data: string };
  maxTokens?: number;
}

/** Builds an `ask` function bound to a key — the shape src/data/analysisEngine.ts
 *  expects, so the Worker and the browser drive identical prompts through
 *  different transports. */
export function makeAsk(apiKey: string): (opts: AskOptions) => Promise<string> {
  const anthropic = new Anthropic({ apiKey });

  return async (opts: AskOptions): Promise<string> => {
    const messages: Anthropic.MessageParam[] = opts.messages.map((m, i) => {
      const isLastUser = i === opts.messages.length - 1 && m.role === 'user';
      if (isLastUser && opts.image) {
        return {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: opts.image.data,
              },
            },
            { type: 'text', text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 1200,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: opts.system,
      messages,
    });

    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  };
}
