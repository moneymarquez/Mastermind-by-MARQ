import { describe, it, expect } from 'vitest';
import { linkify } from '../src/data/linkify';

describe('linkify', () => {
  it('turns a long verification link into one tappable link and keeps the text around it', () => {
    const url = 'https://sentry.io/auth/signup/verify-email/password/eyJlbWFpbCI6ImFjY291bnRAbWFzdGVybWluZHNieW1hcnEuY29tIiwiZXhwaXJlc19hdCI6MTc5MzQw/';
    const parts = linkify(`Please click the link below:\n\n${url}\n\nThis link will expire in 2 hours.`);
    expect(parts.filter((p) => p.href)).toEqual([{ text: url, href: url }]);
    expect(parts.map((p) => p.text).join('')).toContain('Please click the link below:');
    expect(parts.map((p) => p.text).join('')).toContain('expire in 2 hours.');
  });
  it('leaves sentence punctuation outside the link', () => {
    expect(linkify('See https://example.com/a, then (https://example.com/b).').filter((p) => p.href).map((p) => p.href)).toEqual(['https://example.com/a', 'https://example.com/b']);
  });
  it('handles bare www and email addresses', () => {
    const l = linkify('Visit www.example.com or write account@mastermindsbymarq.com.').filter((p) => p.href);
    expect(l.map((p) => p.href)).toEqual(['https://www.example.com', 'mailto:account@mastermindsbymarq.com']);
  });
  it('never links javascript: or other schemes, and plain text passes through', () => {
    expect(linkify('javascript:alert(1) and data:text/html,hi').some((p) => p.href)).toBe(false);
    expect(linkify('just words')).toEqual([{ text: 'just words' }]);
  });
});
