import { useState } from 'react';
import { api } from '../../../lib/api';
import type { Brand } from '../../../data/ecom';
import { money } from '../../../data/ecom';
import { useSites } from '../../../data/useEcomOctober';
import type { OrderRow, SiteRow } from '../../../data/useEcomOctober';
import { siteStats } from '../../../data/ecomOctoberPure';
import { diagnoseFunnel } from '../../../../worker/lib/ecomWorkers';
import { E, Badge } from './ecomShared';

const DOMAIN_LABEL: Record<string, string> = { none: 'free pages.dev address', proposed: 'domain waiting in Inbox', awaiting_purchase: 'approved — buy it', purchased: 'bought — connect it', connecting: 'verifying', active: 'own domain', failed: 'domain failed' };
const FLAG_COLOR: Record<string, string> = { kill: 'var(--danger)', fix: 'var(--warning)', double_down: 'var(--success)', wait: 'var(--text-tertiary)' };
const host = (u: string | null) => (u ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Sites (addendum §2): every product's own website. All of them check out
 *  through the one Shopify store; each card shows its live URL, domain,
 *  attributed orders and revenue, conversion and funnel flag. */
export default function SitesPanel({ brands, orders }: { brands: Brand[]; orders: OrderRow[] }) {
  const s = useSites();
  if (s.missing) return <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sites need the schema_127 migration.</div>;
  const unattributed = orders.filter((o) => !o.site_id && Date.parse(o.placed_at) > Date.now() - 7 * 86400000).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>Sites</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>one site per product · one shared Shopify checkout{unattributed ? ` · ${unattributed} unattributed order${unattributed === 1 ? '' : 's'} this week` : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {s.sites.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No sites yet. When a brand's page is approved, the Launcher puts it live as its own site.</div>}
        {s.sites.map((site) => <SiteCard key={site.id} site={site} brand={brands.find((b) => b.id === site.brand_id)} orders={orders} days={s.days} onChange={s.reload} />)}
      </div>
    </div>
  );
}

function SiteCard({ site, brand, orders, days, onChange }: { site: SiteRow; brand?: Brand; orders: OrderRow[]; days: ReturnType<typeof useSites>['days']; onChange: () => void }) {
  const [domain, setDomain] = useState(site.domain ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const d7 = siteStats(site.id, orders, days, Date.now() - 7 * 86400000);
  const d30 = siteStats(site.id, orders, days, Date.now() - 30 * 86400000);
  const funnel = diagnoseFunnel({ views: d30.views, clicks: d30.clicks, add_to_carts: d30.clicks, purchases: d30.orders });
  const live = site.domain_status === 'active' && site.domain ? `https://${site.domain}` : site.deploy_url;
  const act = async (action: string) => {
    setBusy(true); setMsg('');
    const r = await api<{ detail?: string; error?: string }>('/api/ecom/site-domain', { body: { site_id: site.id, action, domain } });
    setMsg(r.detail ?? r.error ?? ''); setBusy(false); onChange();
  };
  const btn = { height: 32, fontSize: 13 } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, border: `1px solid ${funnel.flag === 'kill' ? 'color-mix(in srgb, var(--danger) 45%, var(--border))' : 'var(--border)'}`, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{brand?.name ?? site.slug}</span>
        <Badge color={site.status === 'live' ? E.green : site.status === 'failed' ? E.red : E.amber}>{site.status}</Badge>
      </div>
      {live ? <a href={live} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{host(live)}</a> : <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>not launched yet</span>}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
        <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{d7.orders}</strong> orders · 7d</span>
        <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{money(d7.revenue, 0)}</strong> revenue</span>
        <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{d30.conversion == null ? '—' : `${(d30.conversion * 100).toFixed(1)}%`}</strong> conversion · 30d</span>
      </div>
      <div style={{ fontSize: 12.5, color: FLAG_COLOR[funnel.flag] }}>Funnel: {funnel.diagnosis} — {funnel.why}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{d30.views.toLocaleString('en-US')} views · {d30.clicks} Buy clicks · {DOMAIN_LABEL[site.domain_status] ?? site.domain_status}{site.domain && site.domain_status !== 'none' ? `: ${site.domain}` : ''}</div>
      {site.last_error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{site.last_error}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(site.domain_status === 'none' || site.domain_status === 'failed') && <>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="brandname.com" aria-label="Domain" style={{ flex: '1 1 140px', minWidth: 0, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 }} />
          <button className="mm-btn" style={btn} disabled={busy || !domain.trim()} onClick={() => void act('request')}>Buy domain (~$10–15/yr)</button>
        </>}
        {site.domain_status === 'awaiting_purchase' && <>
          <a className="mm-btn" style={{ ...btn, textDecoration: 'none' }} href="https://dash.cloudflare.com/?to=/:account/domains/register" target="_blank" rel="noreferrer">Buy it at Cloudflare ↗</a>
          <button className="mm-btn mm-btn--primary" style={btn} disabled={busy} onClick={() => void act('purchased')}>I bought it</button>
        </>}
        {site.domain_status === 'purchased' && <button className="mm-btn mm-btn--primary" style={btn} disabled={busy} onClick={() => void act('connect')}>Connect {site.domain}</button>}
        {site.domain_status === 'connecting' && <button className="mm-btn" style={btn} disabled={busy} onClick={() => void act('check')}>Check domain</button>}
      </div>
      {msg && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{msg}</div>}
    </div>
  );
}
