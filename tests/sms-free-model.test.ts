import { describe, it, expect } from 'vitest';
import { workersAiReply, FREE_SMS_MODEL } from '../worker/lib/sms';

describe('free texting model (Workers AI)', () => {
  it('replies through the AI binding with the system prompt and history', async () => {
    const calls: { model: string; input: Record<string, unknown> }[] = [];
    const AI = { run: async (model: string, input: Record<string, unknown>) => { calls.push({ model, input }); return { response: 'Sure, what time works?' }; } };
    const r = await workersAiReply({ AI }, 'Be brief.', [{ role: 'user', content: 'Can we talk?' }]);
    expect(r).toEqual({ text: 'Sure, what time works?', model: FREE_SMS_MODEL });
    const msgs = calls[0].input.messages as { role: string; content: string }[];
    expect(msgs[0]).toEqual({ role: 'system', content: 'Be brief.' });
    expect(msgs[1].content).toBe('Can we talk?');
  });
  it('can use a different model from the environment', async () => {
    const AI = { run: async () => 'plain string reply' };
    expect((await workersAiReply({ AI, WORKERS_AI_SMS_MODEL: '@cf/meta/llama-3.1-8b-instruct' }, 's', [])).model).toBe('@cf/meta/llama-3.1-8b-instruct');
  });
  it('says so when the AI binding is missing', async () => {
    await expect(workersAiReply({}, 's', [])).rejects.toThrow(/AI binding/);
  });
});
