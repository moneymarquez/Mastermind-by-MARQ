import { checkDkim, checkDmarc, checkSpf, dkimSelectors } from './core';

export type DnsCheck = { ok: boolean; detail: string };
export interface DomainChecks { spf: DnsCheck; dkim: DnsCheck; dmarc: DnsCheck; checked_at: string }

async function txt(name: string, f: typeof fetch): Promise<string[]> {
  try {
    const res = await f(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: 'application/dns-json' } });
    const j = (await res.json()) as { Answer?: { type: number; data: string }[] };
    return (j.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data);
  } catch { return []; }
}
/** SPF, DKIM and DMARC for the outreach domain, read from public DNS. */
export async function checkDomain(domain: string, provider: string | null, f: typeof fetch = fetch): Promise<DomainChecks> {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const [root, dmarc] = await Promise.all([txt(d, f), txt(`_dmarc.${d}`, f)]);
  let dkim = { ok: false, detail: 'No DKIM key found.' };
  for (const sel of dkimSelectors(provider)) { const r = checkDkim(await txt(`${sel}._domainkey.${d}`, f)); if (r.ok) { dkim = { ok: true, detail: `${r.detail} (selector ${sel})` }; break; } }
  return { spf: checkSpf(root, provider), dkim, dmarc: checkDmarc(dmarc), checked_at: new Date().toISOString() };
}
