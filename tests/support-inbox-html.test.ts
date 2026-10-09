import { describe, it, expect } from 'vitest';
import { stripHtml } from '../worker/handlers/support-inbox';

describe('stripHtml', () => {
  it('drops style, script and head contents instead of printing the CSS', () => {
    const html = '<html><head><title>x</title><style>.button__cell { background: #1990C6; }</style></head><body><script>alert(1)</script><p>Thank you for your order!</p></body></html>';
    const t = stripHtml(html);
    expect(t).toBe('Thank you for your order!');
    expect(t).not.toMatch(/button__cell|alert|#1990C6/);
  });
  it('keeps paragraph breaks and decodes entities', () => {
    expect(stripHtml('<p>Order&nbsp;#1001 &amp; more</p><p>Total: $1.00 &mdash; paid</p>')).toBe('Order #1001 & more\nTotal: $1.00 — paid');
  });
  it('handles comments and numeric entities', () => {
    expect(stripHtml('<!-- hi --><div>It&#39;s &#x2713;</div>')).toBe("It's ✓");
  });
});
