// Two-way texting (master prompt Phase 3, October brief §1.6): a text to
// the Masterminds number that isn't one of the digest's fixed commands gets
// a reply from Grok (or Claude, per SMS_PROVIDER in models.ts) in the voice
// set in sms_settings — lead response by default. Every text in and out is
// logged in sms_messages, like digest_log. Pure parts tested in
// tests/sms.test.ts.

export type SmsMode = 'lead_response' | 'support' | 'custom';

export const SMS_PROMPTS: Record<Exclude<SmsMode, 'custom'>, string> = {
  lead_response: [
    'You answer texts sent to Made by Marq / Masterminds by MARQ. Most people texting are potential clients: local business owners who saw an ad, a post or a cold call, or people curious about the Masterminds app.',
    'Goal: be quick, warm and human, learn what they need (business name, what they want help with), and book a short call with Marq. Ask one question at a time.',
    'Facts you may use: Made by Marq builds websites, social content and marketing for local businesses. Masterminds by MARQ is a $19.99/mo app that plans your day, reverse-engineers your goals and tracks your calls, macros and training.',
    'Never quote prices for client work, promise results, or make up availability — say Marq will confirm. Never claim to be human if asked; you are Marq\'s assistant. Under 320 characters, no emoji spam, no links unless asked.',
  ].join('\n'),
  support: [
    'You are the support line for Masterminds by MARQ, a personal operating-system app (daily plan, goals, tasks, macros, fitness, schedule, cold calling).',
    'Help with how-to questions in one or two short sentences. For billing, bugs or account problems, say Marq will follow up and ask for their account email. Never invent features. Under 320 characters.',
  ].join('\n'),
};

export function systemPromptFor(mode: SmsMode, custom: string | null | undefined): string {
  if (mode === 'custom' && custom?.trim()) return custom.trim().slice(0, 4000);
  return SMS_PROMPTS[mode === 'custom' ? 'lead_response' : mode];
}

export interface SmsTurn { direction: 'in' | 'out'; body: string }
/** Conversation history in chat-completion order (oldest first), last N turns. */
export function historyMessages(turns: SmsTurn[], max = 12): { role: 'user' | 'assistant'; content: string }[] {
  return turns.slice(-max).map((t) => ({ role: t.direction === 'in' ? 'user' : 'assistant', content: t.body.slice(0, 1600) }));
}

/** Texts are short: trim to two SMS segments and strip markdown the model may add. */
export function cleanReply(text: string, max = 320): string {
  const t = text.replace(/\*\*|__|`|#+\s/g, '').replace(/\s+\n/g, '\n').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}

/** Standard opt-out words carriers expect us to honor (Twilio also handles them). */
export const isOptOut = (body: string) => /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i.test(body);

export interface XaiEnv { XAI_API_KEY?: string; XAI_MODEL?: string }
/** Grok via xAI's chat-completions API. */
export async function grokReply(env: XaiEnv, system: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }> {
  if (!env.XAI_API_KEY) throw new Error('XAI_API_KEY is not set. Add it in Setup → Grok (xAI).');
  const model = env.XAI_MODEL || 'grok-4';
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.XAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 300, temperature: 0.6, messages: [{ role: 'system', content: system }, ...history] }),
  });
  const j = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; error?: { message?: string } | string };
  if (!res.ok) throw new Error(`xAI ${res.status}: ${typeof j.error === 'string' ? j.error : j.error?.message ?? 'request failed'}`);
  return { text: j.choices?.[0]?.message?.content ?? '', tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0, model };
}
