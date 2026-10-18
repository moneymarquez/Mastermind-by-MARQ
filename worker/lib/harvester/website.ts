import type { Adapter, HarvestJob } from './types';

export interface SiteFacts {
  url: string; reachable: boolean; status: number | null; https: boolean; viewport: boolean; title: string; ms: number | null;
  hasCta: boolean; hasTel: boolean; copyrightYear: number | null; socials: string[]; ordering: string[]; error?: string;
}
const ORDERING = ['doordash.com', 'ubereats.com', 'grubhub.com', 'toasttab.com', 'order.online', 'square.site', 'opentable.com', 'resy.com', 'seamless.com', 'postmates.com', 'chownow.com', 'clover.com', 'slice.com', 'booksy.com', 'vagaro.com', 'fresha.com', 'calendly.com', 'acuityscheduling.com', 'squareup.com/appointments'];
const SOCIAL = ['facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'youtube.com', 'linkedin.com', 'yelp.com'];
const CTA = /\b(order online|order now|book (now|online|an? appointment)|schedule (a |an )?(call|appointment|visit|service)|call (us|now|today)|get (a )?(free )?(quote|estimate)|reserve|make a reservation|request (a )?(quote|appointment)|contact us)\b/i;

/** Facts from one homepage's HTML. Pure, so it's tested without the network. */
export function analyzeHtml(html: string, finalUrl: string, status: number, ms: number | null = null): SiteFacts {
  const h = html.slice(0, 400000);
  const lower = h.toLowerCase();
  const links = [...h.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].toLowerCase());
  const years = [...h.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,24}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map((m) => Number(m[2] ?? m[1]));
  const hit = (list: string[]) => list.filter((d) => links.some((l) => l.includes(d)) || lower.includes(d)).map((d) => d.replace(/\.com$/, ''));
  return {
    url: finalUrl, reachable: status >= 200 && status < 400, status, https: finalUrl.startsWith('https://'),
    viewport: /<meta[^>]+name\s*=\s*["']viewport["']/i.test(h), title: (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
    ms, hasCta: CTA.test(h) || links.some((l) => l.startsWith('tel:')), hasTel: links.some((l) => l.startsWith('tel:')),
    copyrightYear: years.length ? Math.max(...years) : null, socials: hit(SOCIAL), ordering: hit(ORDERING),
  };
}
export const normalizeUrl = (u: string): string | null => {
  const s = u.trim(); if (!s) return null;
  try { const url = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`); return /\./.test(url.hostname) ? url.toString() : null; } catch { return null; }
};
export const domainOf = (u: string): string | null => { try { return new URL(/^https?:\/\//i.test(u) ? u : `http://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

export const website: Adapter = {
  id: 'website',
  defaultCacheDays: 14,
  cacheKey: (j) => { const u = normalizeUrl(String(j.params?.url ?? j.query)); return u ? `d:${domainOf(u)}` : null; },
  estimate: () => 0,
  async run(job: HarvestJob, ctx) {
    const url = normalizeUrl(String(job.params?.url ?? job.query));
    if (!url) throw new Error('No usable website address.');
    const t0 = Date.now();
    try {
      const res = await ctx.http(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; MastermindsBot/1.0; +https://mastermindsbymarq.com)', accept: 'text/html' } });
      const ct = res.headers.get('content-type') ?? '';
      const html = ct.includes('text/html') || ct === '' ? await res.text() : '';
      const facts = analyzeHtml(html, res.url || url, res.status, Date.now() - t0);
      return { items: [{ key: domainOf(url) ?? url, data: facts as unknown as Record<string, unknown> }], calls: 1, cost: 0 };
    } catch (e) {
      const facts: SiteFacts = { url, reachable: false, status: null, https: url.startsWith('https://'), viewport: false, title: '', ms: null, hasCta: false, hasTel: false, copyrightYear: null, socials: [], ordering: [], error: e instanceof Error ? e.message : String(e) };
      return { items: [{ key: domainOf(url) ?? url, data: facts as unknown as Record<string, unknown> }], calls: 1, cost: 0 };
    }
  },
};
