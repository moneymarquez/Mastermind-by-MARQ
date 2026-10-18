import { describe, it, expect } from 'vitest';
import { generate } from '../worker/lib/visual';

function capture() {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ request_id: 'r1', status_url: 'x' }), { status: 200 }); }) as unknown as typeof fetch;
  return { calls, f };
}

describe('Higgsfield adapter', () => {
  it('uses the current API: Key id:secret auth, prompt in the body, async request id', async () => {
    const { calls, f } = capture();
    const r = await generate({ HIGGSFIELD_API_KEY: 'id', HIGGSFIELD_API_SECRET: 'sec' }, 'a mug', 'hero', f);
    expect(calls[0].url).toBe('https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Key id:sec');
    expect(JSON.parse(calls[0].init.body as string).prompt).toBe('a mug');
    expect(r).toMatchObject({ ok: true, jobId: 'r1' });
  });
  it('keeps the legacy platform URL shape when configured', async () => {
    const { calls, f } = capture();
    await generate({ HIGGSFIELD_API_KEY: 'id', HIGGSFIELD_API_URL: 'https://platform.higgsfield.ai' }, 'a mug', 'hero', f);
    expect(calls[0].url).toBe('https://platform.higgsfield.ai/v1/text2image');
    expect((calls[0].init.headers as Record<string, string>)['hf-api-key']).toBe('id');
  });
  it('never guesses a video endpoint', async () => {
    const { calls, f } = capture();
    const r = await generate({ HIGGSFIELD_API_KEY: 'id' }, 'spin', 'video', f);
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it('does nothing in DRY_RUN', async () => {
    const { calls, f } = capture();
    const r = await generate({ HIGGSFIELD_API_KEY: 'id', DRY_RUN: '1' }, 'a mug', 'hero', f);
    expect(r.dryRun).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
