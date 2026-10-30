import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHUNK_RELOAD_KEY, chunkReloadPlan } from '../src/lib/chunkReload';
import { assetNotFound, missingBuiltAsset, serveStatic } from '../worker/lib/staticAssets';

const html = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
const js = () => new Response('export default 1', { status: 200, headers: { 'content-type': 'application/javascript' } });

describe('missing /assets files', () => {
  it('treats an HTML body for a hashed asset as the SPA fallback', () => {
    expect(missingBuiltAsset('/assets/main-DIWtWgve.js', html())).toBe(true);
    expect(missingBuiltAsset('/assets/main-DIWtWgve.js', new Response('nope', { status: 404 }))).toBe(true);
    expect(missingBuiltAsset('/assets/main-DIWtWgve.js', js())).toBe(false);
    expect(missingBuiltAsset('/home', html())).toBe(false);
    expect(missingBuiltAsset('/', html())).toBe(false);
  });

  it('returns a real 404 for a missing chunk and leaves real files and pages alone', async () => {
    const fetchAsset = async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/assets/')) return html();
      return html();
    };
    const missing = await serveStatic(new Request('https://mastermindsbymarq.com/assets/old-AAAAAAAA.js'), { fetch: fetchAsset });
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-type')).toContain('text/plain');
    expect(missing.headers.get('cache-control')).toBe('no-store');
    expect(await missing.text()).toBe('Not found');

    const page = await serveStatic(new Request('https://mastermindsbymarq.com/does-not-exist'), { fetch: fetchAsset });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('html');

    const found = await serveStatic(new Request('https://mastermindsbymarq.com/assets/main-DIWtWgve.js'), { fetch: async () => js() });
    expect(found.status).toBe(200);
    expect(await found.text()).toContain('export default');
  });

  it('builds a plain 404', () => {
    expect(assetNotFound().status).toBe(404);
  });
});

describe('chunk reload', () => {
  it('reloads once, then surfaces the error', () => {
    expect(chunkReloadPlan(null)).toBe('reload');
    expect(chunkReloadPlan('1')).toBe('surface');
    expect(chunkReloadPlan('')).toBe('reload');
  });

  it('keeps the inline entry-script handler on the same key as the lazy loader', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const loader = readFileSync(new URL('../src/lib/lazyScreen.ts', import.meta.url), 'utf8');
    expect(html).toContain(CHUNK_RELOAD_KEY);
    expect(html).toContain("/assets/");
    expect(loader).toContain('chunkReloadPlan');
    expect(loader).toContain('CHUNK_RELOAD_KEY');
  });
});
