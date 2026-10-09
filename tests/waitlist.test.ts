import { describe, it, expect } from 'vitest';
import { cleanWaitlistInput, foundingOffer, parseMode, waitlistCsv, waitlistStats } from '../worker/lib/waitlist';
import { subscriberBody, launchCampaignBody, upsertSubscriber, ensureGroup } from '../worker/lib/mailerlite';
import { waitlistJoin, syncRow } from '../worker/handlers/waitlist';

describe('launch mode', () => {
  it('is the waitlist unless clearly open', () => {
    expect(parseMode('open')).toBe('open');
    for (const v of ['waitlist', '', null, undefined, 'OPEN', 1, {}]) expect(parseMode(v)).toBe('waitlist');
  });
});

describe('cleanWaitlistInput', () => {
  it('lower-cases the email, trims, and keeps a tidy code and UTM tags', () => {
    const r = cleanWaitlistInput({ email: ' Marq@Example.COM ', name: '  Marq\n', code: 'marq20', utm: { utm_source: 'tiktok', junk: 'x' } });
    expect(r).toMatchObject({ ok: true, value: { email: 'marq@example.com', name: 'Marq', code: 'MARQ20', source: 'tiktok', utm: { utm_source: 'tiktok' } } });
  });
  it('rejects bad emails and drops odd codes', () => {
    expect(cleanWaitlistInput({ email: 'nope' }).ok).toBe(false);
    expect(cleanWaitlistInput({ email: 'a@b' }).ok).toBe(false);
    expect(cleanWaitlistInput({ email: 'a'.repeat(250) + '@b.com' }).ok).toBe(false);
    const r = cleanWaitlistInput({ email: 'a@b.co', code: '<script>' });
    expect(r.ok && r.value.code).toBeNull();
  });
});

describe('foundingOffer', () => {
  it('is $19.99 locked for life for the first 100, minus the spots taken', () => {
    const o = foundingOffer(null, 37);
    expect(o).toMatchObject({ price_usd: 19.99, limit: 100, spots_left: 63 });
    expect(o.blurb).toContain('$19.99');
  });
  it('uses the owner\'s edited offer and never goes below zero', () => {
    const o = foundingOffer({ limit: 50, price_usd: 14.99, blurb: 'First {{limit}} pay {{price}}.' }, 80);
    expect(o).toMatchObject({ limit: 50, price_usd: 14.99, spots_left: 0, blurb: 'First 50 pay $14.99.' });
  });
});

describe('stats and CSV', () => {
  const rows = [
    { email: 'a@x.com', name: 'A', code: 'MARQ20', source: null, spot_number: 1, founding_spot: true, created_at: '2026-10-09T10:00:00Z' },
    { email: 'b@x.com', name: null, code: 'MARQ20', source: 'ig', spot_number: 2, founding_spot: true, created_at: '2026-10-08T10:00:00Z' },
    { email: '=cmd@x.com', name: 'He said "hi", ok', code: null, source: null, spot_number: 3, founding_spot: false, created_at: '2026-10-08T11:00:00Z' },
  ];
  it('counts totals, founding spots, per code and per day', () => {
    const s = waitlistStats(rows, 100, Date.parse('2026-10-09T12:00:00Z'));
    expect(s).toMatchObject({ total: 3, foundingUsed: 2, spotsLeft: 98, withCode: 2, byCode: [{ code: 'MARQ20', n: 2 }] });
    expect(s.days.at(-1)).toEqual({ date: '2026-10-09', n: 1 });
    expect(s.days.find((d) => d.date === '2026-10-08')?.n).toBe(2);
  });
  it('exports CSV, defusing formulas and quoting commas and quotes', () => {
    const csv = waitlistCsv(rows);
    expect(csv.split('\n')[0]).toBe('spot,email,name,founding,code,source,joined');
    expect(csv).toContain("'=cmd@x.com");
    expect(csv).toContain('"He said ""hi"", ok"');
  });
});

describe('MailerLite', () => {
  it('builds the subscriber with founding and code fields, in the waitlist group', () => {
    expect(subscriberBody({ email: 'a@x.com', name: 'Ann', founding: true, code: 'MARQ20' }, 'g1')).toEqual({ email: 'a@x.com', fields: { founding_member: 'yes', name: 'Ann', referral_code: 'MARQ20' }, groups: ['g1'], status: 'active' });
    expect(subscriberBody({ email: 'a@x.com', founding: false }, 'g1').fields).toEqual({ founding_member: 'no' });
  });
  it('finds the group by name, else creates it, then posts the subscriber', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: init.body as string | undefined });
      if (url.includes('/groups?')) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (url.endsWith('/groups')) return new Response(JSON.stringify({ data: { id: 'g9' } }), { status: 201 });
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    }) as unknown as typeof fetch;
    await upsertSubscriber({ MAILERLITE_API_KEY: 'k' }, { email: 'a@x.com', founding: false }, f);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toContain('POST /api/groups');
    expect(JSON.parse(calls.at(-1)!.body!).groups).toEqual(['g9']);
    void ensureGroup;
  });
  it('refuses with no API key, and the launch campaign is one draft to the whole group', async () => {
    await expect(upsertSubscriber({}, { email: 'a@x.com', founding: false })).rejects.toThrow(/MAILERLITE_API_KEY/);
    const b = launchCampaignBody({ groupId: 'g1', fromEmail: 'hello@mastermindsbymarq.com', link: 'https://mastermindsbymarq.com/?signup' }) as { groups: string[]; emails: { content: string; from: string }[] };
    expect(b.groups).toEqual(['g1']);
    expect(b.emails[0].content).toContain('$19.99/month for life');
    expect(b.emails[0].from).toBe('hello@mastermindsbymarq.com');
  });
});

describe('waitlist endpoint', () => {
  const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123456', DRY_RUN: '1' };
  const post = (b: unknown) => new Request('https://mastermindsbymarq.com/api/waitlist', { method: 'POST', body: JSON.stringify(b), headers: { 'cf-connecting-ip': '1.2.3.4' } });
  it('treats a filled honeypot as success without saving anything', async () => {
    const orig = globalThis.fetch; let hits = 0; globalThis.fetch = (async () => { hits++; return new Response('{}'); }) as typeof fetch;
    try {
      const r = await waitlistJoin(post({ email: 'bot@x.com', website: 'http://spam' }), env);
      expect((await r.json()) as { ok: boolean }).toMatchObject({ ok: true });
      expect(hits).toBe(0);
    } finally { globalThis.fetch = orig; }
  });
  it('rejects a bad email before touching the database', async () => {
    const r = await waitlistJoin(post({ email: 'nope' }), env);
    expect(r.status).toBe(400);
  });
  it('in test mode a signup is saved but not pushed to MailerLite', async () => {
    const sb = { patch: async () => { throw new Error('must not patch'); } } as never;
    expect(await syncRow(env, sb, { id: '1', email: 'a@x.com', name: null, code: null, founding_spot: true })).toBe('waiting');
  });
});
