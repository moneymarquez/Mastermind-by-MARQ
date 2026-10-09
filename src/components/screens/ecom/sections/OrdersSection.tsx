import { useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import type { Brand } from '../../../../data/ecom';
import { money } from '../../../../data/ecom';
import { useOrders, useSites } from '../../../../data/useEcomOctober';
import Stat from '../../../mm/Stat';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import type { ChipKind } from '../../../mm/Chip';
import { Empty } from '../../../mm/States';
import { useModule } from '../../../mm/Page';

const SUPPLIER: Record<string, { l: string; k: ChipKind }> = { to_place: { l: 'Ready to place', k: 'warn' }, needs_approval: { l: 'Approve to ship', k: 'bad' }, placed: { l: 'Placed', k: 'accent' }, shipped: { l: 'Shipped', k: 'good' }, delivered: { l: 'Delivered', k: 'good' }, problem: { l: 'Problem', k: 'bad' }, not_needed: { l: '—', k: 'neutral' } };

/** Totals for a window. Pure. */
export { orderTotals } from '../../../../data/ecomOctoberPure';
import { orderTotals } from '../../../../data/ecomOctoberPure';

/** Orders (brief §2.1): every Shopify order across stores with its margin
 *  and supplier state. Placing the supplier order goes through checkSpend:
 *  normal costs show "Ready to place"; over the threshold waits in Inbox. */
export default function OrdersSection({ brands }: { brands: Brand[] }) {
  const phone = useModule().device === 'phone';
  const o = useOrders(30);
  const sites = useSites();
  const siteOf = (id: string | null | undefined) => (id ? sites.sites.find((x) => x.id === id)?.slug ?? 'site' : 'Unattributed');
  const [msg, setMsg] = useState('');
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const t = useMemo(() => ({ today: orderTotals(o.rows, day.getTime()), d7: orderTotals(o.rows, Date.now() - 7 * 86400000), d30: orderTotals(o.rows, Date.now() - 30 * 86400000) }), [o.rows, day]);
  const nameOf = (id: string | null) => brands.find((b) => b.id === id)?.name ?? 'Unattributed';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: phone ? 10 : 16 }}>
        <Stat label="Today" value={money(t.today.revenue, 0)} pill={`${t.today.count} order${t.today.count === 1 ? '' : 's'}`} k={t.today.count ? 'good' : 'neutral'} />
        <Stat label="7 days" value={money(t.d7.revenue, 0)} pill={`${t.d7.count} orders`} />
        <Stat label="30 days" value={money(t.d30.revenue, 0)} pill={`${t.d30.count} orders`} />
        <Stat label="Profit · 30 days" value={money(t.d30.profit, 0)} pill={t.d30.profitKnown ? 'after supplier + fees' : 'some margins unknown'} k={t.d30.profit > 0 ? 'good' : 'neutral'} />
      </div>
      <Card title="Every order" meta="from your Shopify store, with the site that made each sale" flush action={<button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={async () => { setMsg('Connecting…'); const r = await api<{ ok?: boolean; error?: string; warning?: string }>('/api/ecom/register-webhooks', { body: {} }); setMsg(r.error ? `Couldn't connect sale alerts: ${r.error}` : `Done. Shopify will send every new order here.${r.warning ? ` Note: ${r.warning}` : ''}`); }}>Connect sale alerts</button>}>
        {msg && <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '0 0 8px' }}>{msg}</div>}
        {o.rows.length === 0 ? <Empty text={o.loading ? 'Loading…' : 'No orders yet. When a site sells, Shopify sends the order here with the site that made it (and texts you 💸).'} /> : o.rows.map((r, i) => {
          const s = SUPPLIER[r.supplier_status] ?? { l: r.supplier_status, k: 'neutral' as ChipKind };
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr) auto' : 'minmax(0,2fr) minmax(0,1fr) 90px 90px 140px', gap: 10, alignItems: 'center', padding: '11px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}>
              <span style={{ minWidth: 0 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.order_number ?? `#${String(r.external_id ?? r.id).slice(-6)}`} · {r.product_title ?? 'order'}</span><span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: 12.5 }}>{nameOf(r.brand_id)} · <span style={{ color: r.site_id ? 'var(--text-secondary)' : 'var(--warning)' }}>{siteOf(r.site_id)}</span> · {new Date(r.placed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{r.customer_name ? ` · ${r.customer_name}` : ''}</span>{r.problem && <span style={{ display: 'block', color: 'var(--warning)', fontSize: 12.5 }}>{r.problem}</span>}</span>
              {!phone && <span style={{ color: 'var(--text-secondary)' }}>{r.fulfillment_status ?? r.status}</span>}
              <span style={{ textAlign: 'right', fontWeight: 600 }}>{money(Number(r.total))}</span>
              {!phone && <span style={{ textAlign: 'right', color: r.margin_usd != null && r.margin_usd > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>{r.margin_usd != null ? money(r.margin_usd) : '—'}</span>}
              {!phone && <span style={{ textAlign: 'right' }}><Chip k={s.k}>{s.l}</Chip></span>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
