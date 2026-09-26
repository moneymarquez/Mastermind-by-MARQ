import { useMemo, useState } from 'react';
import type { Brand, Health } from '../../../data/ecom';
import { STEPS, doneSteps, nextStep, nextAction, deriveHealth, money, ago } from '../../../data/ecom';
import type { ClientListItem } from '../../../data/useClients';
import { E, HealthBadge, Badge, ProgressRing, Pill, TeachingEmpty, Drawer, btn, field, label } from './ecomShared';
import BrandDetail from './BrandDetail';
import type { useEcomBrands } from '../../../data/useEcom';

type Sort = 'health' | 'revenue' | 'activity';
type Filter = 'all' | 'mine' | 'client';
const HEALTH_ORDER: Health[] = ['growing', 'testing', 'building', 'stalled', 'killed'];

interface Props {
  api: ReturnType<typeof useEcomBrands>;
  clients: ClientListItem[];
  search: string;
  openBrandId: string | null;
  onOpenBrand: (id: string | null) => void;
  newBrandOpen: boolean;
  onCloseNewBrand: () => void;
}

/** §4 — the home screen: brand cards with logo, positioning, owner, step
 *  ring, KPIs (or Connect Shopify), health, and the one next action. */
export default function BrandsTab({ api, clients, search, openBrandId, onOpenBrand, newBrandOpen, onCloseNewBrand }: Props) {
  const [sort, setSort] = useState<Sort>('activity');
  const [filter, setFilter] = useState<Filter>('all');
  const now = new Date();
  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.business_name ?? null : null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return api.brands
      .map((b) => ({ b, health: deriveHealth(b, api.orders30d[b.id]?.count ?? 0, now), orders: api.orders30d[b.id] }))
      .filter(({ b }) => (filter === 'all' || b.owner_type === filter) && (!q || b.name.toLowerCase().includes(q) || (b.positioning ?? '').toLowerCase().includes(q) || (clientName(b.client_id) ?? '').toLowerCase().includes(q)))
      .sort((x, y) => sort === 'health' ? HEALTH_ORDER.indexOf(x.health) - HEALTH_ORDER.indexOf(y.health)
        : sort === 'revenue' ? (y.orders?.total ?? 0) - (x.orders?.total ?? 0)
        : y.b.last_activity_at.localeCompare(x.b.last_activity_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.brands, api.orders30d, filter, sort, search, clients]);

  const open = api.brands.find((b) => b.id === openBrandId) ?? null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'mine', 'client'] as Filter[]).map((f) => <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'mine' ? 'Mine' : 'Client'}</Pill>)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={label}>Sort</span>
          <select style={{ ...field, width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="activity">Last activity</option><option value="health">Health</option><option value="revenue">Revenue</option>
          </select>
        </div>
      </div>

      {!api.loading && api.brands.length === 0 && (
        <TeachingEmpty what="No brands yet." worker="you, for now — later the Orchestrator proposes brands from winning products" action={<span style={{ fontSize: 'var(--text-body)', color: E.muted }}>Tap <strong>＋ New Brand</strong> up top, or start one from a product in Product Sheets.</span>} />
      )}
      {api.error && <div style={{ color: E.red, fontSize: 'var(--text-body)', marginBottom: 10 }}>{api.error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {rows.map(({ b, health, orders }) => (
          <BrandCard key={b.id} b={b} health={health} orders={orders} products={api.productCounts[b.id] ?? 0} clientName={clientName(b.client_id)} onOpen={() => onOpenBrand(b.id)} />
        ))}
      </div>

      <BrandDetail
        brand={open}
        clientName={open ? clientName(open.client_id) : null}
        orders30d={open ? api.orders30d[open.id] : undefined}
        productsLive={open ? api.productCounts[open.id] ?? 0 : 0}
        health={open ? deriveHealth(open, api.orders30d[open.id]?.count ?? 0, now) : 'building'}
        onClose={() => onOpenBrand(null)}
        onSaveStep={api.saveStep}
        onRemove={api.removeBrand}
      />

      <NewBrandDrawer open={newBrandOpen} clients={clients} onClose={onCloseNewBrand} onCreate={async (input) => { const b = await api.createBrand(input); onCloseNewBrand(); if (b) onOpenBrand(b.id); }} />
    </div>
  );
}

function BrandCard({ b, health, orders, products, clientName, onOpen }: { b: Brand; health: Health; orders: { count: number; total: number; last: string | null } | undefined; products: number; clientName: string | null; onOpen: () => void }) {
  const done = doneSteps(b);
  const step = nextStep(b);
  return (
    <div onClick={onOpen} style={{ ...E.card, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {b.logo_url
          ? <img src={b.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: `1px solid ${E.border}`, flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef2ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{b.name.slice(0, 2).toUpperCase()}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-subhead)', color: E.text }}>{b.name}</span>
            <HealthBadge h={health} />
          </div>
          <div style={{ fontSize: 'var(--text-body)', color: E.faint, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.positioning || 'No positioning yet — Step 5 writes it.'}</div>
          <div style={{ marginTop: 6 }}>
            {b.owner_type === 'client' ? <Badge color="#7c3aed">Client · {clientName ?? 'unassigned'}</Badge> : <Badge color="#2563eb">Mine</Badge>}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <ProgressRing done={done} total={10} />
          <div style={{ fontSize: 10, color: E.faint, marginTop: 2 }}>Step {step}</div>
        </div>
      </div>

      {b.shopify_store ? (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 'var(--text-body)' }}>
          <span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: E.text }}>{money(orders?.total ?? 0, 0)}</span> <span style={{ color: E.faint }}>30d</span></span>
          <span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: E.text }}>{orders?.count ?? 0}</span> <span style={{ color: E.faint }}>orders</span></span>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--text-caption)', color: E.amber, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>Connect Shopify for revenue, orders, conversion</div>
      )}

      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span>{products} product{products === 1 ? '' : 's'} live</span>
        <span>· last order {orders?.last ? ago(orders.last) : 'none'}</span>
        <span>· changed {ago(b.last_activity_at)}</span>
      </div>

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, fontSize: 'var(--text-body)', color: E.text, fontWeight: 600 }}>
        <span style={{ color: E.green }}>▸</span> {nextAction(b)}
        <span style={{ color: E.faint, fontWeight: 400 }}> · {STEPS[step - 1].title}</span>
      </div>
    </div>
  );
}

function NewBrandDrawer({ open, clients, onClose, onCreate }: { open: boolean; clients: ClientListItem[]; onClose: () => void; onCreate: (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState<'mine' | 'client'>('mine');
  const [clientId, setClientId] = useState('');
  const [positioning, setPositioning] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = name.trim() && (owner === 'mine' || clientId);
  return (
    <Drawer open={open} onClose={onClose} title="New brand" subtitle="A working name is fine — Step 5 names it properly, from the buyer." width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><div style={{ ...label, marginBottom: 4 }}>Working name</div><input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Posture project" autoFocus /></div>
        <div>
          <div style={{ ...label, marginBottom: 6 }}>Owner</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill active={owner === 'mine'} onClick={() => setOwner('mine')}>Mine</Pill>
            <Pill active={owner === 'client'} onClick={() => setOwner('client')}>Client</Pill>
          </div>
        </div>
        {owner === 'client' && (
          <div>
            <div style={{ ...label, marginBottom: 4 }}>Client (from the CRM)</div>
            <select style={field} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Pick a client…</option>
              {clients.filter((c) => c.client_type !== 'self').map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4 }}>Clients live in the CRM; this links the build to them, it doesn't copy them.</div>
          </div>
        )}
        <div><div style={{ ...label, marginBottom: 4 }}>One-line positioning (optional)</div><input style={field} value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Who it's for and why they'd pick you" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...btn('primary'), opacity: ok && !busy ? 1 : 0.6 }} disabled={!ok || busy} onClick={async () => { setBusy(true); await onCreate({ name: name.trim(), owner_type: owner, client_id: owner === 'client' ? clientId : null, positioning: positioning.trim() || null }); setBusy(false); setName(''); setPositioning(''); }}>{busy ? 'Creating…' : 'Create and open Step 1'}</button>
          <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Drawer>
  );
}
