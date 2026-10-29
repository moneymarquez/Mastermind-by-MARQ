import { describe, it, expect } from 'vitest';
import { daysOverdue, reminderStage, reminderEmail, runInvoiceTick } from '../worker/lib/invoiceReminders';
import { availableModes, pickMime, uploadProblem, videoEmail, shareUrl, MAX_SECONDS, VIDEO_BITRATE, MAX_BYTES } from '../src/data/clientVideo';
import { smsConsent } from '../worker/lib/madeby';
import { sendTwilioSms } from '../worker/lib/twilio';

describe('invoice reminders', () => {
  it('counts days overdue', () => {
    expect(daysOverdue('2026-10-20', '2026-10-28')).toBe(8);
    expect(daysOverdue('2026-10-28', '2026-10-28')).toBe(0);
    expect(daysOverdue(null, '2026-10-28')).toBe(0);
  });
  it('reminds at 3 and 7 days, once each', () => {
    expect(reminderStage('2026-10-27', '2026-10-28', 0)).toBe(null);
    expect(reminderStage('2026-10-25', '2026-10-28', 0)).toBe(3);
    expect(reminderStage('2026-10-25', '2026-10-28', 3)).toBe(null);
    expect(reminderStage('2026-10-21', '2026-10-28', 3)).toBe(7);
    expect(reminderStage('2026-10-21', '2026-10-28', 0)).toBe(7); // skip straight to 7, never two cards at once
    expect(reminderStage('2026-10-01', '2026-10-28', 7)).toBe(null);
  });
  it('the email carries the pay link when there is one', () => {
    const m = reminderEmail({ firstName: 'Rosa', label: 'invoice #12', amount: 500, due: '2026-10-21', days: 7, payUrl: 'https://pay.example/x', sender: 'Marq', stage: 7 });
    expect(m.subject).toContain('Following up');
    expect(m.body).toContain('https://pay.example/x');
    expect(m.body).toContain('$500.00');
    expect(reminderEmail({ firstName: 'Rosa', label: 'x', amount: 1, due: 'd', days: 3, payUrl: null, sender: 'M', stage: 3 }).body).toContain('payment link');
  });
  it('the timer drafts approval cards and sends nothing', async () => {
    const inserts: { t: string; row: Record<string, unknown> }[] = [];
    const patches: { t: string; f: string; b: Record<string, unknown> }[] = [];
    const sb = {
      get: async (q: string) => {
        if (q.startsWith('client_invoices?status=eq.sent&due_date=lt')) return [{ id: 'c1' }];
        if (q.startsWith('client_invoices?status=in.(sent,overdue)')) return [{ id: 'c1', user_id: 'u', client_id: 'cl', description: 'Website', invoice_number: 12, amount: 500, due_date: '2000-01-01', reminder_stage: 3, stripe_invoice_url: 'https://invoice.stripe.com/x', crm_clients: { business_name: 'Joe Tacos', contact_name: 'Rosa Diaz', contact_email: 'rosa@joe.example' } }];
        if (q.startsWith('biz_invoices')) return [{ id: 'b1', user_id: 'u', number: 'MB-1', to_name: 'Sam Lee', to_email: null, amount_usd: 90, due_date: '2000-01-01', reminder_stage: 7, pay_url: null, client_id: null, contact_id: null }];
        return [];
      },
      insert: async (t: string, row: Record<string, unknown>) => { inserts.push({ t, row }); return []; },
      patch: async (t: string, f: string, b: Record<string, unknown>) => { patches.push({ t, f, b }); },
    } as never;
    const r = await runInvoiceTick(sb);
    expect(r).toEqual({ overdue: 1, drafted: 1 });
    expect(patches.some((p) => p.t === 'client_invoices' && p.b.status === 'overdue')).toBe(true);
    expect(patches.some((p) => p.f === 'id=eq.c1' && p.b.reminder_stage === 7)).toBe(true);
    const card = inserts.find((i) => i.t === 'ai_approvals')!;
    expect(card.row.type).toBe('invoice_reminder');
    expect((card.row.payload as Record<string, unknown>).to).toBe('rosa@joe.example');
    expect((card.row.payload as Record<string, string>).body).toContain('https://invoice.stripe.com/x');
    expect(inserts.filter((i) => i.t === 'comm_messages')).toHaveLength(0); // nothing sent
  });
});

describe('client video', () => {
  it('iPad (no screen capture) gets camera or upload', () => {
    expect(availableModes({ getDisplayMedia: false, getUserMedia: true, mediaRecorder: true })).toEqual(['camera', 'upload']);
    expect(availableModes({ getDisplayMedia: true, getUserMedia: true, mediaRecorder: true })).toEqual(['screen', 'camera', 'upload']);
    expect(availableModes({ getDisplayMedia: false, getUserMedia: false, mediaRecorder: false })).toEqual(['upload']);
  });
  it('picks a container the browser can record', () => {
    expect(pickMime((t) => t === 'video/mp4')).toBe('video/mp4');
    expect(pickMime((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickMime(() => false)).toBe('');
  });
  it('a full-length recording fits under the storage cap', () => {
    expect((MAX_SECONDS * (VIDEO_BITRATE + 128_000)) / 8).toBeLessThan(MAX_BYTES);
  });
  it('rejects non-video and oversize uploads', () => {
    expect(uploadProblem({ size: 10, type: 'image/png' })).toMatch(/isn't a video/);
    expect(uploadProblem({ size: MAX_BYTES + 1, type: 'video/mp4' })).toMatch(/50 MB/);
    expect(uploadProblem({ size: 1000, type: 'video/quicktime' })).toBe(null);
  });
  it('the email draft carries the share link', () => {
    const link = shareUrl('https://app.example/', 'abc');
    expect(link).toBe('https://app.example/v/abc');
    expect(videoEmail({ firstName: 'Rosa', title: 'Your site', link, sender: 'Marq' }).body).toContain(link);
  });
});

describe('texting rules', () => {
  it('no cold texts; replies and opt-ins are fine; STOP wins', () => {
    expect(smsConsent({ repliedIn: false, optedIn: false, optedOut: false })).toMatch(/No cold texts/);
    expect(smsConsent({ repliedIn: true, optedIn: false, optedOut: false })).toBe(null);
    expect(smsConsent({ repliedIn: false, optedIn: true, optedOut: false })).toBe(null);
    expect(smsConsent({ repliedIn: true, optedIn: true, optedOut: true })).toMatch(/STOP/);
  });
  it('DRY_RUN simulates texts unless texting has its own live switch', async () => {
    expect((await sendTwilioSms({ DRY_RUN: '1' }, '+18165550100', 'hi')).dryRun).toBe(true);
    const off = await sendTwilioSms({}, '+18165550100', 'hi');
    expect(off.sent).toBe(false);
    expect(off.error).toMatch(/TWILIO_LIVE/);
    const live = await sendTwilioSms({ DRY_RUN: '1', TWILIO_LIVE: '1' }, '+18165550100', 'hi');
    expect(live.dryRun).toBeFalsy();
    expect(live.error).toMatch(/isn't connected/); // live path reached; no credentials in tests
  });
});
