import type { Http } from './types';

/** fetch with a minimum gap between calls (rate limiting) and retries with backoff on 429/5xx/network errors. */
export function makeHttp(f: typeof fetch = fetch, opts: { gapMs?: number; retries?: number; sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {}): Http {
  const gap = opts.gapMs ?? 120, retries = opts.retries ?? 3, timeout = opts.timeoutMs ?? 12000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last = 0;
  return async (url, init) => {
    let lastErr: unknown = null;
    for (let i = 0; i <= retries; i++) {
      const wait = Math.max(0, last + gap - Date.now());
      if (wait) await sleep(wait);
      last = Date.now();
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
        const res = await f(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`HTTP ${res.status}`); if (i < retries) { await sleep(2 ** i * 400); continue; } }
        return res;
      } catch (e) { lastErr = e; if (i < retries) await sleep(2 ** i * 400); }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
}
