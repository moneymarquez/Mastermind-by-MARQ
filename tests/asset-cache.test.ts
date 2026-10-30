import { describe, expect, it } from 'vitest';
import { IMMUTABLE_ASSET_CACHE, cacheControlForPath, withAssetCache } from '../worker/lib/assetCache';

describe('hashed asset cache', () => {
  it('marks Vite hashed files immutable and leaves everything else alone', () => {
    expect(cacheControlForPath('/assets/main-DIWtWgve.js')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(cacheControlForPath('/assets/BrainV2-C2MZ-QVx.js')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(cacheControlForPath('/assets/DailyPlanV2--0hPs_R6.js')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(cacheControlForPath('/assets/PeptidesScreen-D_dOEJ-q.js')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(cacheControlForPath('/assets/geist-cyrillic-ext-wght-normal-DjL33-gN.woff2')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(cacheControlForPath('/assets/logo.png')).toBeNull();
    expect(cacheControlForPath('/icons/favicon-32.png')).toBeNull();
    expect(cacheControlForPath('/')).toBeNull();
  });

  it('replaces max-age=0 on a real hashed file', () => {
    const response = withAssetCache(
      new Response('export {}', { status: 200, headers: { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=0, must-revalidate' } }),
      '/assets/main-DIWtWgve.js',
    );
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE_ASSET_CACHE);
    expect(response.headers.get('content-type')).toContain('javascript');
  });

  it('does not pin the SPA html fallback under an asset URL', () => {
    const response = withAssetCache(
      new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0' } }),
      '/assets/old-AAAAAAAA.js',
    );
    expect(response.headers.get('cache-control')).toBe('public, max-age=0');
  });
});
