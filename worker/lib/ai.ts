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

/** The domain's cap: ai_domain_caps row if set, else the $1 default. */
export async function capFor(sb: Sb, userId: string, domain: string): Promise<number> {
  const rows = await sb.get<{ daily_cap_usd: number }>(`ai_domain_caps?user_id=eq.${userId}&domain=eq.${domain}&select=daily_cap_usd`);
  return rows[0] ? Number(rows[0].daily_cap_usd) : DEFAULT_DAILY_CAP_USD;
}

export interface AskInput {
  model: string; system: string; user: string; maxTokens?: number;
  domain: string; userId: string; date: string; workerId?: string | null; capUsd?: number;
  tools?: Anthropic.Messages.ToolUnion[];
}
export interface AskResult { text: string; tokensIn: number; tokensOut: number; costUsd: number; searches: number; sources: { url: string; title: string }[] }

export async function ask(apiKey: string | undefined, sb: Sb, input: AskInput): Promise<AskResult> {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set as a Worker secret.');
  const cap = input.capUsd ?? (await capFor(sb, input.userId, input.domain));
  const spent = await spentToday(sb, input.userId, input.domain, input.date);
  if (spent >= cap) throw new CapReached(`Daily cap reached for ${input.domain}: $${spent.toFixed(2)} of $${cap.toFixed(2)}.`);
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: input.user }];
  let tokensIn = 0, tokensOut = 0, searches = 0;
  const texts: string[] = [];
  const sources: { url: string; title: string }[] = [];
  // Server tools (web search) can stop with pause_turn mid-loop; hand the
  // turn back until it finishes, at most a few times.
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1200,
      system: input.system,
      messages,
      ...(input.tools ? { tools: input.tools } : {}),
    });
    const usage = res.usage as unknown as { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number } };
    tokensIn += usage.input_tokens; tokensOut += usage.output_tokens; searches += usage.server_tool_use?.web_search_requests ?? 0;
    for (const b of res.content) {
      if (b.type === 'text') texts.push(b.text);
      const r = b as unknown as { type: string; content?: { type: string; url?: string; title?: string }[] };
      if (r.type === 'web_search_tool_result' && Array.isArray(r.content)) for (const c of r.content) if (c.url) sources.push({ url: c.url, title: c.title ?? c.url });
    }
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }
  const costUsd = costOf(input.model, tokensIn, tokensOut, searches);
  await sb.insert('ai_cost_ledger', { user_id: input.userId, date: input.date, domain: input.domain, worker_id: input.workerId ?? null, cost_usd: Number(costUsd.toFixed(5)) }).catch((e) => console.error('ledger', e));
  return { text: texts.join('\n').trim(), tokensIn, tokensOut, costUsd, searches, sources };
}
