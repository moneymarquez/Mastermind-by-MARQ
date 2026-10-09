import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CSSProperties } from 'react';
import { useEcomBrands, useEcomCounters, useApprovals } from '../../../data/useEcom';
import { useClients } from '../../../data/useClients';
import { money } from '../../../data/ecom';
import type { Brand } from '../../../data/ecom';
import { E, TeachingEmpty, Drawer, Badge, btn } from './ecomShared';
import EcomOverview from './EcomOverview';
import { Page, field as mmField, useModule } from '../../mm/Page';
import OfficeView from '../../office/OfficeView';
import { useFlags } from '../../../data/useFlags';
import ProductsSection from './sections/ProductsSection';
import StoresSection from './sections/StoresSection';
import OrdersSection from './sections/OrdersSection';
import OfficeSection from './sections/OfficeSection';
import InboxSection from './sections/InboxSection';
import ClientStoresSection from './sections/ClientStoresSection';

export type EcomSection = 'overview' | 'products' | 'stores' | 'orders' | 'office' | 'inbox' | 'clients';
interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  section?: EcomSection;
}

/** The split nav (brief §2.1): each section is its own screen in the
 *  E-commerce portal; 'overview' is the landing page with counts. */
export const SECTIONS: { id: Exclude<EcomSection, 'overview'>; screen: string; label: string; sub: string }[] = [
  { id: 'products', screen: 'ecom-products', label: 'Products', sub: 'Tonight\'s pitch, the research queue, and every product the bots found.' },
  { id: 'stores', screen: 'ecom-stores', label: 'Sites', sub: 'Every product\'s own website — all checking out through your one Shopify store.' },
  { id: 'orders', screen: 'ecom-orders', label: 'Orders', sub: 'Shopify orders, margins and supplier status.' },
  { id: 'office', screen: 'ecom-office', label: 'Office', sub: 'Who\'s working, what they did, and the kill switch.' },
  { id: 'inbox', screen: 'ecom-inbox', label: 'Inbox', sub: 'Approvals, store mail and order problems.' },
  { id: 'clients', screen: 'ecom-clients', label: 'Client Stores', sub: 'Every subscriber\'s stores, revenue and flags.' },
];
/** Which section an open flag belongs to, from its deep link. */
export function sectionOfFlag(link: string | null, entityType: string): Exclude<EcomSection, 'overview'> {
  const l = link ?? '';
  for (const s of SECTIONS) if (l.includes(s.screen)) return s.id;
  if (entityType === 'worker') return 'office';
  if (entityType === 'order') return 'orders';
  if (entityType === 'product' || entityType === 'pitch') return 'products';
  if (entityType === 'approval') return 'inbox';
  return 'stores';
}
const DAILY_CAP_USD = 1;
const SEEN_KEY = 'ecom_last_seen';
const OPEN_KEY = 'ecom_open_brand';

interface SinceLook { since: string; added: Record<string, number>; runs: { name: string; summary: string | null }[]; failed: number }
/** "What workers did since you last looked" — runs and products since the
 *  last visit to this screen (kept per browser). */
function useSinceLastLook(): { data: SinceLook | null; reload: () => void } {
  const [data, setData] = useState<SinceLook | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let since = new Date(Date.now() - 86400000).toISOString();
    try { since = localStorage.getItem(SEEN_KEY) ?? since; } catch { /* private mode */ }
    let live = true;
    (async () => {
      const [p, r, w] = await Promise.all([
        supabase.from('ecom_products').select('channel').gte('created_at', since),
        supabase.from('ai_worker_runs').select('worker_id,status,summary').eq('domain', 'ecom').gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        supabase.from('ai_workers').select('id,name').eq('domain', 'ecom'),
      ]);
      const added: Record<string, number> = {};
      for (const x of (p.data ?? []) as { channel: string }[]) added[x.channel] = (added[x.channel] ?? 0) + 1;
      const names = Object.fromEntries(((w.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
      const runs = ((r.data ?? []) as { worker_id: string; status: string; summary: string | null }[]);
      if (live) setData({ since, added, runs: runs.filter((x) => x.status === 'done').map((x) => ({ name: names[x.worker_id] ?? 'Worker', summary: x.summary })), failed: runs.filter((x) => x.status === 'failed').length });
    })();
    return () => { live = false; try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* fine */ } };
  }, [tick]);
  return { data, reload: () => setTick((t) => t + 1) };
}

/** Month-to-date spend per worker for the cost drawer. */
function useCostBreakdown(open: boolean) {
  const [rows, setRows] = useState<{ domain: string; worker: string; cost: number }[]>([]);
  useEffect(() => {
    if (!open) return;
    const d = new Date(); const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    Promise.all([
      supabase.from('ai_cost_ledger').select('domain,worker_id,cost_usd').gte('date', monthStart),
      supabase.from('ai_workers').select('id,name'),
    ]).then(([l, w]) => {
      const names = Object.fromEntries(((w.data ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
      const agg: Record<string, { domain: string; worker: string; cost: number }> = {};
      for (const r of (l.data ?? []) as { domain: string; worker_id: string | null; cost_usd: number }[]) {
        const k = `${r.domain}:${r.worker_id ?? '-'}`;
        agg[k] ??= { domain: r.domain, worker: r.worker_id ? names[r.worker_id] ?? 'Worker' : r.domain === 'digest' ? 'Morning Digest' : 'Other', cost: 0 };
        agg[k].cost += Number(r.cost_usd);
      }
      setRows(Object.values(agg).sort((a, b) => b.cost - a.cost));
    });
  }, [open]);
  return rows;
}

/** The e-commerce shell (§3): top bar, status strip, four tabs, and the
 *  approvals inbox behind the strip. Same panel-in-the-dark-shell as
 *  LeadFlow, on purpose. */
export default function EcomScreen({ section = 'overview' }: Props) {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const flags = useFlags(true);
  const [search, setSearch] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [openBrandId, setOpenBrandId] = useState<string | null>(null);
  useEffect(() => {
    if (section !== 'stores') return;
    try {
      const v = sessionStorage.getItem(OPEN_KEY);
      if (v) { sessionStorage.removeItem(OPEN_KEY); const o = JSON.parse(v) as { id: string | null; create: boolean }; setOpenBrandId(o.id); setNewBrandOpen(o.create); }
    } catch { /* private mode */ }
  }, [section]);
  const brands = useEcomBrands();
  const counters = useEcomCounters();
  const approvals = useApprovals();
  const clients = useClients();
  const since = useSinceLastLook();
  const breakdown = useCostBreakdown(costOpen);
  const refreshAll = () => { counters.reload(); approvals.reload(); since.reload(); };

  const iconBtn: CSSProperties = { height: 34, padding: '0 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, position: 'relative' };
  const dot = (n: number, color: string) => n > 0 ? <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: color, color: E.onAccent, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{n}</span> : null;
  const monthCap = DAILY_CAP_USD * 31;
  const sinceText = since.data && Object.keys(since.data.added).length
    ? `Scout added ${Object.values(since.data.added).reduce((a, b) => a + b, 0)} (${Object.entries(since.data.added).map(([c, n]) => `${n} ${c}`).join(', ')})`
    : since.data?.runs.length ? `${since.data.runs.length} run${since.data.runs.length === 1 ? '' : 's'} finished` : 'no worker runs';

  const meta = SECTIONS.find((x) => x.id === section);
  const counts = (id: string) => { const f = flags.flags.filter((x) => x.domain === 'ecommerce' && sectionOfFlag(x.link, x.entity_type) === id); return { red: f.filter((x) => x.severity === 'red').length, amber: f.filter((x) => x.severity === 'amber').length }; };
  // Sections are separate screens, so "open this brand" crosses a remount.
  const openInStores = (id: string | null, create = false) => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify({ id, create })); } catch { /* private mode */ } if (section === 'stores') { setOpenBrandId(id); setNewBrandOpen(create); } else nav('ecom-stores'); };
  const buildBrand = async (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null; steps: Record<string, unknown>; current_step: number }) => { const b = await brands.createBrand({ ...input, steps: input.steps as Brand['steps'] }); if (b) openInStores(b.id); return b?.id ?? null; };

  return (
    <Page title={meta?.label ?? 'E-commerce'} sub={meta?.sub ?? 'Products, sites, orders and the office. Money never moves without your tap.'}
      backTo={meta ? 'ecommerce' : 'modules'} back={meta ? 'E-commerce' : 'All modules'}
      fab={section === 'stores' || section === 'overview' ? { t: 'Brand', onClick: () => openInStores(null, true) } : undefined}
      menu={[{ t: 'Floor plan view', onClick: () => setOfficeOpen(true) }]}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(section === 'products' || section === 'stores' || section === 'overview') && <input style={{ ...mmField, height: 34, borderRadius: 999, flex: '1 1 140px', maxWidth: phone ? undefined : 320, fontSize: 14 }} placeholder="Search brands, products" value={search} onChange={(e) => setSearch(e.target.value)} />}
        <div style={{ flex: 1 }} />
        <button className="mm-btn" style={iconBtn} onClick={() => setAlertsOpen(true)}>Alerts{dot(counters.unreadAlerts, E.red)}</button>
        <button className="mm-btn" style={iconBtn} onClick={() => setCostOpen(true)}>Spend {money(counters.spentMonth)}</button>
      </div>
      {section === 'overview' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Since {since.data ? new Date(since.data.since).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'you last looked'}: {sinceText}{since.data?.failed ? `, ${since.data.failed} failed` : ''} · {money(counters.spentToday)} spent today
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(3,minmax(0,1fr))', gap: 10 }}>
            {SECTIONS.map((x) => {
              const c = counts(x.id);
              const extra = x.id === 'inbox' ? counters.pendingApprovals : 0;
              return (
                <button key={x.id} className="mm-btn" onClick={() => nav(x.screen)} style={{ height: 'auto', padding: 14, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left' }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                    <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{x.label}</span>
                    {c.red > 0 && <Badge color={E.red}>{c.red}</Badge>}
                    {c.amber > 0 && <Badge color={E.amber}>{c.amber}</Badge>}
                    {extra > 0 && <Badge color={E.blue}>{extra} waiting</Badge>}
                  </span>
                  {!phone && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{x.sub}</span>}
                </button>
              );
            })}
          </div>
          <EcomOverview brands={brands.brands} orders30d={brands.orders30d} approvals={approvals.approvals} onOpenBrand={(id) => openInStores(id)} onOpenApprovals={() => nav('ecom-inbox')} />
        </>
      )}
      {section === 'products' && <ProductsSection approvals={approvals} search={search} onBuildBrand={buildBrand} onDecided={refreshAll} />}
      {section === 'stores' && (
        <div style={{ background: E.bg, borderRadius: 16, border: '1px solid var(--border)', color: E.text, padding: phone ? 14 : 20, minWidth: 0 }}>
          <StoresSection api={brands} clients={clients.clients} search={search} openBrandId={openBrandId} onOpenBrand={setOpenBrandId} newBrandOpen={newBrandOpen} onCloseNewBrand={() => setNewBrandOpen(false)} />
        </div>
      )}
      {section === 'orders' && <OrdersSection brands={brands.brands} />}
      {section === 'office' && <OfficeSection onRan={refreshAll} />}
      {section === 'inbox' && <InboxSection approvals={approvals} brands={brands.brands} onDecided={refreshAll} />}
      {section === 'clients' && <ClientStoresSection />}

      <Drawer open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Alerts" subtitle="Only things that need a human." width={440}>
        {approvals.alerts.length === 0
          ? <TeachingEmpty what="No alerts." worker="the Orchestrator — supplier price jumps, kill and double-down flags, worker failures, cost caps, store previews" phase={4} />
          : approvals.alerts.map((a) => (
            <div key={a.id} style={{ ...E.card, padding: 12, marginBottom: 8, opacity: a.read_at ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge color={a.severity === 'urgent' ? E.red : a.severity === 'warn' ? E.amber : E.blue}>{a.severity}</Badge>
                <span style={{ fontWeight: 600, color: E.text, flex: 1 }}>{a.title}</span>
                {!a.read_at && <button style={{ ...btn('ghost'), padding: '4px 8px', fontSize: 12 }} onClick={() => approvals.markAlertRead(a.id)}>Read</button>}
              </div>
              {a.body && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>{a.body}</div>}
            </div>
          ))}
      </Drawer>

      <Drawer open={costOpen} onClose={() => setCostOpen(false)} title="Cost this month" subtitle={`Cap: ${money(DAILY_CAP_USD)} a day per domain — workers stop when it's hit.`} width={440}>
        <div style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.muted }}>Month to date</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{money(counters.spentMonth)} / {money(monthCap, 0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.muted }}>Today</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{money(counters.spentToday)} / {money(DAILY_CAP_USD)}</span></div>
          <div style={{ height: 6, background: E.border, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (counters.spentMonth / monthCap) * 100)}%`, height: '100%', background: E.green }} /></div>
          {breakdown.length === 0
            ? <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No spend yet this month. Every worker call is metered here; e-comm, content, marketing and the digest each have their own daily cap (Setup → Start the company).</div>
            : breakdown.map((b) => (
              <div key={`${b.domain}-${b.worker}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-body)', borderTop: `1px solid ${E.border}`, paddingTop: 6 }}>
                <span style={{ color: E.muted }}>{b.worker} <span style={{ color: E.faint }}>· {b.domain}</span></span>
                <span style={{ fontFamily: 'var(--font-mono)', color: E.text }}>{money(b.cost, 3)}</span>
              </div>
            ))}
        </div>
      </Drawer>
      {officeOpen && <OfficeView domain="ecom" onClose={() => { setOfficeOpen(false); refreshAll(); }} />}
    </Page>
  );
}
