import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useEcomBrands, useEcomCounters, useApprovals } from '../../../data/useEcom';
import { useClients } from '../../../data/useClients';
import { money } from '../../../data/ecom';
import type { Brand } from '../../../data/ecom';
import { E, Pill, TeachingEmpty, Drawer, Badge, btn, field } from './ecomShared';
import BrandsTab from './BrandsTab';
import WorkersTab from './WorkersTab';
import ApprovalsTab from './ApprovalsTab';
import ProductSheetsTab from './ProductSheetsTab';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

type Tab = 'brands' | 'sheets' | 'workers' | 'performance' | 'approvals';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'brands', label: 'Brands', icon: '🏷️' },
  { id: 'sheets', label: 'Product Sheets', icon: '📈' },
  { id: 'workers', label: 'Workers', icon: '🤖' },
  { id: 'performance', label: 'Performance', icon: '📊' },
];
const DAILY_CAP_USD = 1;

/** The e-commerce shell (§3): top bar, status strip, four tabs, and the
 *  approvals inbox behind the strip. Same panel-in-the-dark-shell as
 *  LeadFlow, on purpose. */
export default function EcomScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const [tab, setTab] = useState<Tab>('brands');
  const [search, setSearch] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [newBrandOpen, setNewBrandOpen] = useState(false);
  const [openBrandId, setOpenBrandId] = useState<string | null>(null);
  const brands = useEcomBrands();
  const counters = useEcomCounters();
  const approvals = useApprovals();
  const clients = useClients();

  const panelStyle: CSSProperties = { background: E.bg, borderRadius: 'var(--radius-3xl)', border: '1px solid var(--border)', marginTop: 24, fontFamily: 'Inter, sans-serif', color: '#111', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 560 };
  const topBar: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '12px 16px', flexShrink: 0 };
  const iconBtn: CSSProperties = { ...btn('ghost'), padding: '8px 10px', position: 'relative' };
  const dot = (n: number, color: string) => n > 0 ? <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{n}</span> : null;
  const monthCap = DAILY_CAP_USD * 31;

  return (
    <div>
      <div style={homeHeadStyle}>E-commerce</div>
      <div style={homeSubStyle}>Brands, product sheets, workers and performance — you steer, workers do the work, money never moves without your tap.</div>

      <div style={panelStyle}>
        <div style={topBar}>
          {TABS.map((t) => <Pill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}><span>{t.icon}</span>{t.label}</Pill>)}
          <div style={{ flex: 1 }} />
          <input style={{ ...field, width: 180 }} placeholder="🔍 Search brands, products" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button style={iconBtn} title="Alerts" onClick={() => setAlertsOpen(true)}>🔔{dot(counters.unreadAlerts, E.red)}</button>
          <button style={iconBtn} title="Cost this month" onClick={() => setCostOpen(true)}>💲 <span style={{ fontFamily: 'var(--font-mono)' }}>{money(counters.spentMonth)}</span></button>
          <button style={btn('primary')} onClick={() => { setTab('brands'); setNewBrandOpen(true); }}>＋ New Brand</button>
        </div>

        {/* Status strip: what workers did since you last looked. Static in
            Phase 1 — no workers yet — but the counts are real. */}
        <div onClick={() => setTab('approvals')} style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0', padding: '8px 16px', fontSize: 'var(--text-body)', color: E.muted, cursor: 'pointer', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: E.faint }}>Since you last looked —</span>
          <span>no workers running yet (Phase 3)</span>
          <span>· <strong style={{ color: counters.pendingApprovals ? E.amber : E.text }}>{counters.pendingApprovals}</strong> need your approval</span>
          <span>· <strong style={{ color: counters.unreadAlerts ? E.red : E.text }}>{counters.unreadAlerts}</strong> alert{counters.unreadAlerts === 1 ? '' : 's'}</span>
          <span>· <span style={{ fontFamily: 'var(--font-mono)' }}>{money(counters.spentToday)}</span> spent today</span>
          <span style={{ marginLeft: 'auto', color: E.green, fontWeight: 600 }}>{tab === 'approvals' ? '' : 'Open approvals ▸'}</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
          {tab === 'brands' && <BrandsTab api={brands} clients={clients.clients} search={search} openBrandId={openBrandId} onOpenBrand={setOpenBrandId} newBrandOpen={newBrandOpen} onCloseNewBrand={() => setNewBrandOpen(false)} />}
          {tab === 'sheets' && <ProductSheetsTab search={search} onBuildBrand={async (input) => { const b = await brands.createBrand({ ...input, steps: input.steps as Brand['steps'] }); if (b) { setTab('brands'); setOpenBrandId(b.id); } return b?.id ?? null; }} />}
          {tab === 'workers' && <WorkersTab />}
          {tab === 'performance' && (
            <TeachingEmpty what="Performance — revenue, funnel by stage, flags and the Sunday checkup — fills from Shopify orders and post metrics." worker="Analytics + the Orchestrator's read loop" connection="Shopify custom app token, Instagram / TikTok" phase={7} />
          )}
          {tab === 'approvals' && <ApprovalsTab api={approvals} />}
        </div>
      </div>

      <Drawer open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Alerts" subtitle="Only things that need a human." width={440}>
        {approvals.alerts.length === 0
          ? <TeachingEmpty what="No alerts." worker="the Orchestrator — supplier price jumps, kill and double-down flags, worker failures, cost caps, store previews" phase={4} />
          : approvals.alerts.map((a) => (
            <div key={a.id} style={{ ...E.card, padding: 12, marginBottom: 8, opacity: a.read_at ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge color={a.severity === 'urgent' ? E.red : a.severity === 'warn' ? E.amber : '#2563eb'}>{a.severity}</Badge>
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
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (counters.spentMonth / monthCap) * 100)}%`, height: '100%', background: E.green }} /></div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Per-worker breakdown appears once workers run (Phase 3). E-comm, content and marketing are metered separately.</div>
        </div>
      </Drawer>
    </div>
  );
}
