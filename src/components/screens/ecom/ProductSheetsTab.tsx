import { useMemo, useState } from 'react';
import type { Channel } from '../../../data/ecom';
import { CHANNELS, money, ago } from '../../../data/ecom';
import type { Product, SheetFilters } from '../../../data/ecomProducts';
import { DEFAULT_FILTERS, filterProducts, rankSort, brandStepsFromProduct } from '../../../data/ecomProducts';
import { useEcomProducts, linkProductToBrand } from '../../../data/useEcom';
import { E, Pill, Badge, ConfidenceBadge, TeachingEmpty, btn, field, label } from './ecomShared';
import ProductDrawer from './ProductDrawer';
import RichProductCard from './RichProductCard';
import { cardView } from '../../../data/ecomCard';
import CsvImportDrawer from './CsvImportDrawer';
import { api as callApi } from '../../../lib/api';
import { runScout } from '../../../data/useEngine';

interface Props {
  search: string;
  onOpenApprovals?: () => void;
  /** Pipeline status per product (Products nav): researching / pitched / approved / rejected / building / live. */
  statusOf?: (productId: string) => { label: string; color: string } | null;
  onBuildBrand: (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null; steps: Record<string, unknown>; current_step: number }, productId: string) => Promise<string | null>;
}

/** §5 — the sheets: a channel per pill, top products ranked, cards with
 *  pictures (table is the optional toggle), the drawer with every section,
 *  CSV import as the v1 source adapter. */
export default function ProductSheetsTab({ search, onBuildBrand, statusOf, onOpenApprovals }: Props) {
  const [scouting, setScouting] = useState(false);
  const [scoutMsg, setScoutMsg] = useState('');
  const api = useEcomProducts();
  const [channel, setChannel] = useState<Channel>('tiktok');
  const [filters, setFilters] = useState<SheetFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [openId, setOpenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [limit, setLimit] = useState(20);

  const inChannel = useMemo(() => (channel === 'rising' ? api.products.filter((p) => p.velocity === 'rising') : api.products.filter((p) => p.channel === channel)), [api.products, channel]);
  const categories = useMemo(() => [...new Set(inChannel.map((p) => p.category).filter((c): c is string => !!c))].sort(), [inChannel]);
  const rows = useMemo(() => filterProducts(inChannel, filters, search).sort(rankSort), [inChannel, filters, search]);
  const open = api.products.find((p) => p.id === openId) ?? null;

  const buildBrand = async (p: Product) => {
    const chLabel = CHANNELS.find((c) => c.id === p.channel)?.label ?? p.channel;
    const id = await onBuildBrand({ name: p.name, owner_type: 'mine', client_id: null, positioning: null, steps: brandStepsFromProduct(p, chLabel), current_step: 2 }, p.id);
    if (id) { await linkProductToBrand(id, p.id); setOpenId(null); }
  };

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState('');
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const rejectOne = async (p: Product, reason: string) => {
    setBusyId(p.id); setBusyKind('reject');
    const r = await callApi<{ ok?: boolean; error?: string }>('/api/engine/reject-product', { body: { product_id: p.id, reason } });
    setBusyId(null); setBusyKind('');
    setTestMsg((m) => ({ ...m, [p.id]: r.error ?? `Rejected: ${reason}. Scout will read that next run.` }));
    void api.reload();
  };
  const enrichOne = async (p: Product) => {
    setBusyId(p.id); setBusyKind('enrich');
    const r = await callApi<{ ok?: boolean; error?: string; summary?: string }>('/api/engine/enrich', { body: { product_id: p.id } });
    setBusyId(null); setBusyKind('');
    setTestMsg((m) => ({ ...m, [p.id]: r.error ?? r.summary ?? 'Done.' }));
    void api.reload();
  };
  const testOne = async (p: Product) => {
    setTestMsg((m) => ({ ...m, [p.id]: 'Starting…' }));
    const r = await callApi<{ ok?: boolean; error?: string; note?: string; existing?: boolean }>('/api/engine/test-product', { body: { product_id: p.id } });
    setTestMsg((m) => ({ ...m, [p.id]: r.error ?? `${r.existing ? '' : 'Brand started: directions and shipping plan are being drafted. '}${r.note ?? ''}` }));
  };

  const counts = Object.fromEntries(CHANNELS.map((c) => [c.id, c.id === 'rising' ? api.products.filter((p) => p.velocity === 'rising').length : api.products.filter((p) => p.channel === c.id).length]));

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHANNELS.map((c) => <Pill key={c.id} active={channel === c.id} onClick={() => { setChannel(c.id); setLimit(20); }}>{c.label}{counts[c.id] ? <span style={{ opacity: 0.7, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{counts[c.id]}</span> : null}</Pill>)}
        <div style={{ flex: 1 }} />
        <button style={btn('ghost')} onClick={() => setView(view === 'cards' ? 'table' : 'cards')}>{view === 'cards' ? '☰ Table' : '▦ Cards'}</button>
        <button style={btn('primary')} onClick={() => setImportOpen(true)}>📥 Import CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, fontSize: 'var(--text-body)' }}>
        <select style={{ ...field, width: 'auto' }} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}><option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select style={{ ...field, width: 'auto' }} value={filters.priceBand} onChange={(e) => setFilters((f) => ({ ...f, priceBand: e.target.value as SheetFilters['priceBand'] }))}><option value="any">Any price</option><option value="under20">Under $20</option><option value="20to50">$20–50</option><option value="50to100">$50–100</option><option value="over100">$100+</option></select>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={label}>Margin ≥</span><input style={{ ...field, width: 64, fontFamily: 'var(--font-mono)' }} inputMode="numeric" value={filters.minMargin || ''} placeholder="0" onChange={(e) => setFilters((f) => ({ ...f, minMargin: Number(e.target.value) || 0 }))} />%</span>
        <select style={{ ...field, width: 'auto' }} value={filters.difficulty} onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value as SheetFilters['difficulty'] }))}><option value="any">Any content difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={label}>Trending ≥</span><input style={{ ...field, width: 56, fontFamily: 'var(--font-mono)' }} inputMode="numeric" value={filters.minDays || ''} placeholder="0" onChange={(e) => setFilters((f) => ({ ...f, minDays: Number(e.target.value) || 0 }))} />d</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: E.muted, cursor: 'pointer' }}><input type="checkbox" checked={filters.hideSaturated} onChange={(e) => setFilters((f) => ({ ...f, hideSaturated: e.target.checked }))} />Hide saturated</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: E.muted, cursor: 'pointer' }} title="A sample plus its domain costs $50 or less"><input type="checkbox" checked={!!filters.fitsBudget} onChange={(e) => setFilters((f) => ({ ...f, fitsBudget: e.target.checked }))} />Fits $50 budget</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: E.muted, cursor: 'pointer' }} title="At least $10 profit per order and a 35% margin"><input type="checkbox" checked={!!filters.marginFloor} onChange={(e) => setFilters((f) => ({ ...f, marginFloor: e.target.checked }))} />$10 &amp; 35% floor</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: E.muted, cursor: 'pointer' }}><input type="checkbox" checked={filters.watchedOnly} onChange={(e) => setFilters((f) => ({ ...f, watchedOnly: e.target.checked }))} />☆ Watched</label>
        <span style={{ marginLeft: 'auto', color: E.faint, fontSize: 'var(--text-caption)' }}>{rows.length} of {inChannel.length} · showing top {Math.min(limit, rows.length)}</span>
      </div>

      {!api.loading && inChannel.length === 0 && (
        <div style={{ marginTop: 14 }}>
          <TeachingEmpty what={`No ${CHANNELS.find((c) => c.id === channel)?.label} products yet.`} worker="Product Scout (web search over public pages; FastMoss / Jungle Scout later) — or a CSV from any tool" connection="Anthropic key (Setup)"
            action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={btn('primary')} disabled={scouting} onClick={async () => { setScouting(true); setScoutMsg(''); const r = await runScout(channel, 10); setScouting(false); setScoutMsg(r.ok ? `Scout found ${r.count}.` : r.error ?? 'Scout failed.'); }}>{scouting ? 'Scouting… (30–90s)' : 'Run Product Scout'}</button>
              <button style={btn('ghost')} onClick={() => setImportOpen(true)}>Import a CSV</button>
              {scoutMsg && <span style={{ fontSize: 'var(--text-caption)', color: scoutMsg.startsWith('Scout found') ? E.green : E.red }}>{scoutMsg}{scoutMsg.startsWith('Scout found') && onOpenApprovals && <> <button type="button" onClick={onOpenApprovals} style={{ background: 'none', border: 0, padding: 0, color: E.blue, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Review them in Approvals →</button></>}</span>}
            </div>} />
        </div>
      )}
      {api.error && <div style={{ color: E.red, fontSize: 'var(--text-body)', marginTop: 10 }}>{api.error}</div>}

      {view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 12, marginTop: 14, alignItems: 'start' }}>
          {rows.slice(0, limit).map((p) => (
            <div key={p.id} data-demo="product-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <RichProductCard p={{ ...p, rank: p.rank }} statusChip={statusOf?.(p.id)} busy={busyId === p.id ? busyKind : ''} message={testMsg[p.id]}
                notes={p.detail.notes} onNotes={(v) => void api.updateProduct(p.id, { detail: { ...p.detail, notes: v } })}
                onApprove={() => void testOne(p)} onWatch={() => void api.toggleWatch(p)} onReject={(r) => void rejectOne(p, r)} onEnrich={() => void enrichOne(p)} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...btn('ghost'), minHeight: 32, fontSize: 13 }} onClick={() => setOpenId(p.id)}>Edit numbers / research</button>
                <button style={{ ...btn('ghost'), minHeight: 32, fontSize: 13 }} onClick={() => buildBrand(p)}>Build a brand (skip pipeline)</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...E.card, marginTop: 14, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--text-body)' }}>
            <thead><tr style={{ background: E.sunk }}>{['#', 'Product', 'Verdict', 'Price', 'Profit/order', 'Margin', 'Ship days', 'Days', 'Velocity', 'Score', 'Content', 'Conf.', 'As of'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: E.faint, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, limit).map((p) => (
                <tr key={p.id} onClick={() => setOpenId(p.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.rank ?? ''}</td>
                  <td style={{ padding: '8px 10px', color: E.text, fontWeight: 600 }}>{p.watched ? '★ ' : ''}{p.name}{statusOf?.(p.id) && <> <Badge color={statusOf(p.id)!.color}>{statusOf(p.id)!.label}</Badge></>}</td>
                  {(() => { const v = cardView(p); return (<>
                    <td style={{ padding: '8px 10px' }}><Badge color={v.verdict === 'GO' ? E.green : v.verdict === 'MAYBE' ? E.amber : E.red} title={v.verdictWhy}>{v.verdict}</Badge></td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.sell_price != null ? money(p.sell_price) : 'Not found'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: v.floorOk ? E.green : E.text }}>{v.bd ? money(v.bd.profit) : 'Not found'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: v.floorOk ? E.green : E.text }}>{v.bd ? `${v.bd.marginPct.toFixed(0)}%` : 'Not found'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{v.shipMax != null ? `${v.shipMin ?? v.shipMax}–${v.shipMax}` : 'Not found'}</td>
                  </>); })()}
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.days_trending ?? 'Not found'}</td>
                  <td style={{ padding: '8px 10px' }}>{p.velocity ?? 'Not found'}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.score ?? 'Not found'}</td>
                  <td style={{ padding: '8px 10px' }}>{p.content_difficulty ?? 'Not found'}</td>
                  <td style={{ padding: '8px 10px' }}><ConfidenceBadge c={p.confidence} /></td>
                  <td style={{ padding: '8px 10px', color: E.faint, whiteSpace: 'nowrap' }}>{ago(p.as_of)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && <div style={{ marginTop: 12 }}><button style={btn('ghost')} onClick={() => setLimit((l) => l + 10)}>Show 10 more (top {limit + 10})</button></div>}

      <ProductDrawer product={open} snapshots={open ? api.snapshots[open.id] ?? [] : []} onClose={() => setOpenId(null)} onSave={api.updateProduct} onToggleWatch={api.toggleWatch} onBuildBrand={buildBrand} onRemove={api.removeProduct} />
      <CsvImportDrawer open={importOpen} channel={channel} onClose={() => setImportOpen(false)} onImport={api.importRows} />
    </div>
  );
}
