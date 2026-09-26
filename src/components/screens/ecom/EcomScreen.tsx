import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
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
const SEEN_KEY = 'ecom_last_seen';

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
  const since = useSinceLastLook();
  const breakdown = useCostBreakdown(costOpen);
  const refreshAll = () => { counters.reload(); approvals.reload(); since.reload(); };

  const panelStyle: CSSProperties = { background: E.bg, borderRadius: 'var(--radius-3xl)', border: '1px solid var(--border)', marginTop: 24, color: E.text, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 560 };
  const topBar: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: E.surface, borderBottom: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0 };
  const iconBtn: CSSProperties = { ...btn('ghost'), padding: '8px 10px', position: 'relative' };
  const dot = (n: number, color: string) => n > 0 ? <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: color, color: E.onAccent, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{n}</span> : null;
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
        <div onClick={() => setTab('approvals')} style={{ background: E.sunk, borderBottom: '1px solid var(--border)', padding: '8px 16px', fontSize: 'var(--text-body)', color: E.muted, cursor: 'pointer', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: E.faint }}>Since {since.data ? new Date(since.data.since).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'you last looked'} —</span>
          <span>{since.data && Object.keys(since.data.added).length
            ? `Scout added ${Object.values(since.data.added).reduce((a, b) => a + b, 0)} (${Object.entries(since.data.added).map(([c, n]) => `${n} ${c}`).join(', ')})`
            : since.data?.runs.length ? `${since.data.runs.length} run${since.data.runs.length === 1 ? '' : 's'} finished` : 'no worker runs'}{since.data?.failed ? ` · ${since.data.failed} failed` : ''}</span>
          <span>· <strong style={{ color: counters.pendingApprovals ? E.amber : E.text }}>{counters.pendingApprovals}</strong> need your approval</span>
          <span>· <strong style={{ color: counters.unreadAlerts ? E.red : E.text }}>{counters.unreadAlerts}</strong> alert{counters.unreadAlerts === 1 ? '' : 's'}</span>
          <span>· <span style={{ fontFamily: 'var(--font-mono)' }}>{money(counters.spentToday)}</span> spent today</span>
          <span style={{ marginLeft: 'auto', color: E.green, fontWeight: 600 }}>{tab === 'approvals' ? '' : 'Open approvals ▸'}</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }}>
          {tab === 'brands' && <BrandsTab api={brands} clients={clients.clients} search={search} openBrandId={openBrandId} onOpenBrand={setOpenBrandId} newBrandOpen={newBrandOpen} onCloseNewBrand={() => setNewBrandOpen(false)} />}
          {tab === 'sheets' && <ProductSheetsTab search={search} onBuildBrand={async (input) => { const b = await brands.createBrand({ ...input, steps: input.steps as Brand['steps'] }); if (b) { setTab('brands'); setOpenBrandId(b.id); } return b?.id ?? null; }} />}
          {tab === 'workers' && <WorkersTab onRan={refreshAll} />}
          {tab === 'performance' && (
            <TeachingEmpty what="Performance — revenue, funnel by stage, flags and the Sunday checkup — fills from Shopify orders and post metrics." worker="Analytics + the Orchestrator's read loop" connection="Shopify custom app token, Instagram / TikTok" phase={7} />
          )}
          {tab === 'approvals' && <ApprovalsTab api={approvals} onDecided={refreshAll} />}
        </div>
      </div>

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
    </div>
  );
}
