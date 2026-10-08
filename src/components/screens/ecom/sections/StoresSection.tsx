import { useMemo } from 'react';
import type { useEcomBrands } from '../../../../data/useEcom';
import type { Brand } from '../../../../data/ecom';
import { STEPS, nextStep, money } from '../../../../data/ecom';
import { useOrders, useBuilds } from '../../../../data/useEcomOctober';
import { useFlags, sortBySeverity } from '../../../../data/useFlags';
import FlagDot from '../../../mm/FlagDot';
import { E, Badge } from '../ecomShared';
import BrandsTab from '../BrandsTab';
import type { ClientListItem } from '../../../../data/useClients';

/** Stores (brief §2.1): one card per brand — where it is in the 10 steps,
 *  the live URL, 7-day orders and revenue, the funnel flag — sorted red,
 *  amber, then the rest. The full brand view (and Performance) sits below. */
export default function StoresSection({ api, clients, search, openBrandId, onOpenBrand, newBrandOpen, onCloseNewBrand }: { api: ReturnType<typeof useEcomBrands>; clients: ClientListItem[]; search: string; openBrandId: string | null; onOpenBrand: (id: string | null) => void; newBrandOpen: boolean; onCloseNewBrand: () => void }) {
  const orders = useOrders(7);
  const builds = useBuilds();
  const flags = useFlags(true);
  const cards = useMemo(() => sortBySeverity(api.brands, (b: Brand) => flags.flagFor('brand', b.id)?.severity), [api.brands, flags]);
  if (openBrandId || newBrandOpen) return <div style={{ background: E.bg, borderRadius: 16, border: '1px solid var(--border)', color: E.text, padding: 16 }}><BrandsTab api={api} clients={clients} search={search} openBrandId={openBrandId} onOpenBrand={onOpenBrand} newBrandOpen={newBrandOpen} onCloseNewBrand={onCloseNewBrand} /></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {cards.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No stores yet. Approve a Product Pitch (Products) and the brand starts here.</div>}
        {cards.map((b) => {
          const o = orders.rows.filter((x) => x.brand_id === b.id);
          const build = builds.find((x) => x.brand_id === b.id && x.live_url);
          const flag = flags.flagFor('brand', b.id);
          const step = nextStep(b);
          return (
            <button key={b.id} onClick={() => onOpenBrand(b.id)} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, border: `1px solid ${flag?.severity === 'red' ? 'color-mix(in srgb, var(--danger) 45%, var(--border))' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlagDot flag={flag} />
                <span style={{ fontSize: 16, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
                <Badge color={build ? E.green : E.amber}>{build ? 'live' : `step ${step}`}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>{STEPS.map((s) => <span key={s.n} title={s.title} style={{ flex: 1, height: 5, borderRadius: 3, background: s.n < step || build ? 'var(--accent)' : s.n === step ? 'color-mix(in srgb, var(--accent) 45%, var(--surface-2))' : 'var(--surface-2)' }} />)}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{o.length}</strong> orders · 7d</span>
                <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{money(o.reduce((s, x) => s + Number(x.total), 0), 0)}</strong> revenue</span>
              </div>
              {build?.live_url && <span style={{ fontSize: 12.5, color: 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{build.live_url.replace(/^https:\/\//, '')}</span>}
              {flag && <span style={{ fontSize: 12.5, color: flag.severity === 'red' ? 'var(--danger)' : 'var(--warning)' }}>{flag.message}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ background: E.bg, borderRadius: 16, border: '1px solid var(--border)', color: E.text, padding: 16 }}>
        <BrandsTab api={api} clients={clients} search={search} openBrandId={openBrandId} onOpenBrand={onOpenBrand} newBrandOpen={newBrandOpen} onCloseNewBrand={onCloseNewBrand} />
      </div>
    </div>
  );
}
