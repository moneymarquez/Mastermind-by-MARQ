// Every Claude call a server-side job makes goes through here, so the cost
// cap (master build rule B4) is enforced in one place: before the call we
// sum today's ai_cost_ledger for the domain and refuse if it's at the cap;
// after, we write what it actually cost.
import Anthropic from '@anthropic-ai/sdk';
import type { Sb } from './sb';

/** $ per million tokens [input, output]. Conservative (list, not intro). */
const PRICE: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5': [3, 15],
  'claude-opus-5': [5, 25],
  'claude-fable-5-1': [10, 50],
};
export function costOf(model: string, tokensIn: number, tokensOut: number, searches = 0): number {
  const [i, o] = PRICE[model] ?? [10, 50];
  return (tokensIn * i + tokensOut * o) / 1_000_000 + searches * 0.01;
}

export const DEFAULT_DAILY_CAP_USD = 1;

export async function spentToday(sb: Sb, userId: string, domain: string, date: string): Promise<number> {
  const rows = await sb.get<{ cost_usd: number }>(`ai_cost_ledger?user_id=eq.${userId}&domain=eq.${domain}&date=eq.${date}&select=cost_usd`);
  return rows.reduce((s, r) => s + Number(r.cost_usd), 0);
}

export class CapReached extends Error {}

export interface AskInput {
  model: string; system: string; user: string; maxTokens?: number;
  domain: string; userId: string; date: string; workerId?: string | null; capUsd?: number;
  tools?: Anthropic.Messages.ToolUnion[];
}
export interface AskResult { text: string; tokensIn: number; tokensOut: number; costUsd: number; searches: number }

export async function ask(apiKey: string | undefined, sb: Sb, input: AskInput): Promise<AskResult> {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set as a Worker secret.');
  const cap = input.capUsd ?? DEFAULT_DAILY_CAP_USD;
  const spent = await spentToday(sb, input.userId, input.domain, input.date);
  if (spent >= cap) throw new CapReached(`Daily cap reached for ${input.domain}: $${spent.toFixed(2)} of $${cap.toFixed(2)}.`);
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: input.model,
    max_tokens: input.maxTokens ?? 1200,
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
    ...(input.tools ? { tools: input.tools } : {}),
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  const usage = res.usage as unknown as { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number } };
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  const costUsd = costOf(input.model, usage.input_tokens, usage.output_tokens, searches);
  await sb.insert('ai_cost_ledger', { user_id: input.userId, date: input.date, domain: input.domain, worker_id: input.workerId ?? null, cost_usd: Number(costUsd.toFixed(5)) }).catch((e) => console.error('ledger', e));
  return { text, tokensIn: usage.input_tokens, tokensOut: usage.output_tokens, costUsd, searches };
}
