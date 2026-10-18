import { useEffect, useState } from 'react';
import { OFFER_DEFAULTS, spotsLeft } from '../data/madeby';

// Launch offer cards (brief §5.9 / Phase 7). Read from Marketing → Our
// Brands → Launch offers through public_launch_offers() — no prices are
// hardcoded on the site. Nothing renders until Marq enables an offer.
interface Offer { key: 'founding' | 'annual' | 'guarantee'; config: Record<string, unknown>; claimed: number }

export function useOffers(): Offer[] {
  const [rows, setRows] = useState<Offer[]>([]);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/rpc/public_launch_offers`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : [])).then((j) => setRows(Array.isArray(j) ? j : [])).catch(() => setRows([]));
  }, []);
  return rows;
}

const fill = (s: string, c: Record<string, unknown>) => s.replace('{{limit}}', String(c.limit ?? '')).replace('{{price}}', `$${c.price_usd ?? ''}`);
export default function Offers({ dark }: { dark?: boolean }) {
  const rows = useOffers();
  if (!rows.length) return null;
  const order = ['founding', 'annual', 'guarantee'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12, width: '100%' }}>
      {[...rows].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((o) => {
        const d = OFFER_DEFAULTS[o.key] as Record<string, unknown>;
        const c = { ...d, ...o.config };
        return (
          <div key={o.key} style={{ borderRadius: 14, padding: 18, border: `1px solid ${dark ? '#34343f' : '#e3e3ea'}`, background: dark ? '#1f1f2a' : '#fff', color: dark ? '#ededf3' : '#100f12', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <span style={{ fontSize: 11, letterSpacing: '.12em', fontWeight: 600, color: '#5266eb' }}>{String(c.headline ?? '').toUpperCase()}</span>
            {o.key === 'founding' && <span style={{ fontSize: 28, fontWeight: 500 }}>${String(c.price_usd)}<span style={{ fontSize: 14, opacity: 0.7 }}>/mo for life</span></span>}
            {o.key === 'annual' && <span style={{ fontSize: 28, fontWeight: 500 }}>${String(c.price_usd)}<span style={{ fontSize: 14, opacity: 0.7 }}>/year</span></span>}
            <span style={{ fontSize: 14.5, lineHeight: 1.5, opacity: 0.85 }}>{fill(String(c.blurb ?? ''), c)}</span>
            {o.key === 'founding' && <span style={{ fontSize: 13, fontWeight: 600 }}>{spotsLeft(Number(c.limit ?? 100), o.claimed)} spots left</span>}
          </div>
        );
      })}
    </div>
  );
}
