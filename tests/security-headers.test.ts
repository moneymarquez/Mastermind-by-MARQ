import { describe, expect, it } from 'vitest';
import { REPORT_ONLY_CSP, securityHeaderList, withSecurityHeaders } from '../worker/lib/securityHeaders';

describe('security headers', () => {
  it('sends HSTS, framing, nosniff, referrer policy, and a report-only CSP on https', () => {
    const headers = Object.fromEntries(securityHeaderList('https://mastermindsbymarq.com/'));
    expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy-report-only']).toBe(REPORT_ONLY_CSP);
    expect(headers['content-security-policy']).toBeUndefined();
  });

  it('leaves HSTS off for non-https responses', () => {
    const names = securityHeaderList('http://127.0.0.1:5173/').map(([name]) => name);
    expect(names).not.toContain('strict-transport-security');
  });

  it('allows the origins the app actually loads, and blocks framing', () => {
    expect(REPORT_ONLY_CSP).toContain("frame-ancestors 'none'");
    expect(REPORT_ONLY_CSP).toContain('https://*.supabase.co');
    expect(REPORT_ONLY_CSP).toContain('wss://*.supabase.co');
    expect(REPORT_ONLY_CSP).toContain('https://js.stripe.com');
    expect(REPORT_ONLY_CSP).toContain('https://api.stripe.com');
    expect(REPORT_ONLY_CSP).toContain('https://hooks.stripe.com');
    expect(REPORT_ONLY_CSP).toContain('https://fonts.googleapis.com');
    expect(REPORT_ONLY_CSP).toContain('https://fonts.gstatic.com');
    expect(REPORT_ONLY_CSP).toContain('https://world.openfoodfacts.org');
    expect(REPORT_ONLY_CSP).toContain("'unsafe-inline'");
  });

  it('attaches the headers without changing status or body', async () => {
    const request = new Request('https://madebymarquez.com/home');
    const response = withSecurityHeaders(request, new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html></html>');
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('content-security-policy-report-only')).toContain("default-src 'self'");
  });

  it('keeps 204 responses body-less', () => {
    const request = new Request('https://mastermindsbymarq.com/api/ecom/beacon');
    const response = withSecurityHeaders(request, new Response(null, { status: 204 }));
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
