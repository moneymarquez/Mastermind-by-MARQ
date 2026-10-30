import { describe, expect, it, vi } from 'vitest';
import { withOptionalSentry } from '../worker/lib/sentry';

describe('withOptionalSentry', () => {
  it('passes straight through to the plain handler when SENTRY_DSN is unset', async () => {
    const handler = {
      fetch: vi.fn(async () => new Response('ok')),
      scheduled: vi.fn(async () => {}),
      email: vi.fn(async () => {}),
    };
    const wrapped = withOptionalSentry(handler);
    const env = {};
    const res = await wrapped.fetch(new Request('https://x.test/'), env, undefined);
    expect(await res.text()).toBe('ok');
    await wrapped.scheduled({ cron: '*/5 * * * *' }, env, { waitUntil() {} });
    await wrapped.email({}, env, { waitUntil() {} });
    expect(handler.fetch).toHaveBeenCalledTimes(1);
    expect(handler.scheduled).toHaveBeenCalledTimes(1);
    expect(handler.email).toHaveBeenCalledTimes(1);
  });
});
