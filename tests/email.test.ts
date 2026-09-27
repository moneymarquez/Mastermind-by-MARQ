import { test } from 'vitest';
import assert from 'node:assert/strict';
import { deliveryHtml, safeUrl, EMAIL_RE } from '../worker/handlers/deliver-email';

test('B-03 delivery email escaping', async () => {
  const h = deliveryHtml({ to: 'a@b.com', clientName: '<script>x</script>', projectName: 'P "1"', previewUrl: 'javascript:alert(1)', videoUrl: 'https://v.com/a?b=1&c=2', invoiceSummary: '<img src=x onerror=1>' });
  assert.ok(!h.includes('<script>') && h.includes('&lt;script&gt;'));
  assert.ok(!h.includes('javascript:'), 'non-http link dropped');
  assert.ok(h.includes('https://v.com/a?b=1&amp;c=2'));
  assert.ok(!h.includes('<img'));
  assert.equal(safeUrl('data:text/html,x'), null);
  assert.ok(EMAIL_RE.test('name@business.com')); assert.ok(!EMAIL_RE.test('a@b.com, c@d.com')); assert.ok(!EMAIL_RE.test('x'));

});
