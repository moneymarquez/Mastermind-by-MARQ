import { describe, it, expect } from 'vitest';
import { senderFor } from '../worker/lib/senders';

const both = { RESEND_FROM_EMAIL: 'Masterminds <hello@mastermindsbymarq.com>', MADEBYMARQUEZ_FROM_EMAIL: 'hello@madebymarquez.com' };

describe('senderFor', () => {
  it('app mail comes from hello@ on the Masterminds domain', () => {
    expect(senderFor(both, 'account')).toBe('Masterminds by MARQ <hello@mastermindsbymarq.com>');
    expect(senderFor(both, 'dispatch')).toBe('Masterminds by MARQ <hello@mastermindsbymarq.com>');
  });
  it('agency mail comes from its own mailbox on the Made by Marq domain', () => {
    expect(senderFor(both, 'invoice')).toBe('Made by Marq <invoice@madebymarquez.com>');
    expect(senderFor(both, 'receipt')).toBe('Made by Marq <invoice@madebymarquez.com>');
    expect(senderFor(both, 'contract')).toBe('Made by Marq <hello@madebymarquez.com>');
  });
  it('falls back to the app address until the agency domain is set', () => {
    expect(senderFor({ RESEND_FROM_EMAIL: 'hello@mastermindsbymarq.com' }, 'invoice')).toBe('Masterminds by MARQ <hello@mastermindsbymarq.com>');
  });
  it('returns null when email is not set up', () => {
    expect(senderFor({}, 'account')).toBeNull();
  });
});
