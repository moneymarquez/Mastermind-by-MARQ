import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Channel } from '../../../data/ecom';
import { CHANNELS, money, ago } from '../../../data/ecom';
import type { Product, SheetFilters } from '../../../data/ecomProducts';
import { DEFAULT_FILTERS, filterProducts, rankSort, sparklinePath, rankTrend, marginHealthy, isSaturated, brandStepsFromProduct } from '../../../data/ecomProducts';
import { useEcomProducts, linkProductToBrand } from '../../../data/useEcom';
import { E, Pill, Badge, ConfidenceBadge, TeachingEmpty, btn, field, label } from './ecomShared';
import ProductDrawer from './ProductDrawer';
import CsvImportDrawer from './CsvImportDrawer';

interface Props {
  search: string;
  onBuildBrand: (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null; steps: Record<string, unknown>; current_step: number }, productId: string) => Promise<string | null>;
}

/** §5 — the sheets: a channel per pill, top products ranked, cards with
 *  pictures (table is the optional toggle), the drawer with every section,
 *  CSV import as the v1 source adapter. */
export default function ProductSheetsTab({ search, onBuildBrand }: Props) {
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: E.muted, cursor: 'pointer' }}><input type="checkbox" checked={filters.watchedOnly} onChange={(e) => setFilters((f) => ({ ...f, watchedOnly: e.target.checked }))} />☆ Watched</label>
        <span style={{ marginLeft: 'auto', color: E.faint, fontSize: 'var(--text-caption)' }}>{rows.length} of {inChannel.length} · showing top {Math.min(limit, rows.length)}</span>
      </div>

      {!api.loading && inChannel.length === 0 && (
        <div style={{ marginTop: 14 }}>
          <TeachingEmpty what={`No ${CHANNELS.find((c) => c.id === channel)?.label} products yet.`} worker="Product Scout (web search over public pages; FastMoss / Jungle Scout later) — or a CSV from any tool right now" phase={3}
            action={<button style={btn('primary')} onClick={() => setImportOpen(true)}>Import a CSV</button>} />
        </div>
      )}
      {api.error && <div style={{ color: E.red, fontSize: 'var(--text-body)', marginTop: 10 }}>{api.error}</div>}

      {view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 14 }}>
          {rows.slice(0, limit).map((p) => (
            <ProductCard key={p.id} p={p} ranks={(api.snapshots[p.id] ?? []).map((s) => s.rank)} onOpen={() => setOpenId(p.id)} onWatch={() => api.toggleWatch(p)} onBuild={() => buildBrand(p)} />
          ))}
        </div>
      ) : (
        <div style={{ ...E.card, marginTop: 14, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--text-body)' }}>
            <thead><tr style={{ background: E.sunk }}>{['#', 'Product', 'Category', 'Price', 'Landed', 'Margin', 'Days', 'Velocity', 'Score', 'Content', 'Conf.', 'As of'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: E.faint, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, limit).map((p) => (
                <tr key={p.id} onClick={() => setOpenId(p.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.rank ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: E.text, fontWeight: 600 }}>{p.watched ? '★ ' : ''}{p.name}</td>
                  <td style={{ padding: '8px 10px', color: E.muted }}>{p.category ?? '—'}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{money(p.sell_price)}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{money(p.landed_cost)}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: marginHealthy(p.sell_price, p.landed_cost) ? E.green : E.text }}>{p.margin_pct != null ? `${p.margin_pct.toFixed(0)}%` : '—'}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.days_trending ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{p.velocity ?? '—'}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>{p.score ?? '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{p.content_difficulty ?? '—'}</td>
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

function ProductCard({ p, ranks, onOpen, onWatch, onBuild }: { p: Product; ranks: (number | null)[]; onOpen: () => void; onWatch: () => void; onBuild: () => void }) {
  const path = sparklinePath(ranks);
  const trend = rankTrend(ranks);
  const healthy = marginHealthy(p.sell_price, p.landed_cost);
  const num: CSSProperties = { fontFamily: 'var(--font-mono)', fontWeight: 600, color: E.text };
  return (
    <div style={{ ...E.card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', background: E.border, height: 160 }}>
          {p.images.length === 0
            ? <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: E.faint, fontSize: 12 }}>No photo yet</div>
            : p.images.map((u) => <img key={u} src={u} alt="" loading="lazy" style={{ width: '100%', height: 160, objectFit: 'cover', flex: '0 0 100%', scrollSnapAlign: 'start' }} />)}
        </div>
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.rank != null && <Badge color={E.text}>#{p.rank}</Badge>}
            <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-subhead)', flex: 1, minWidth: 0 }}>{p.name}</span>
            {path && <svg width={72} height={22} aria-label="14-day rank"><path d={path} fill="none" stroke={trend === '↓' ? E.red : E.green} strokeWidth={1.8} strokeLinejoin="round" /></svg>}
          </div>
          <div style={{ fontSize: 'var(--text-body)', color: E.faint, marginTop: 2 }}>{[p.category, `${CHANNELS.find((c) => c.id === p.channel)?.short}${trend ? ` ${trend}` : ''}`].filter(Boolean).join(' · ')}{isSaturated(p) ? ' · saturated' : ''}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 'var(--text-body)' }}>
            <span><span style={num}>{money(p.sell_price)}</span> <span style={{ color: E.faint }}>sell</span></span>
            <span><span style={num}>{money(p.landed_cost)}</span> <span style={{ color: E.faint }}>landed</span></span>
            <span><span style={{ ...num, color: healthy ? E.green : E.text }}>{p.margin_pct != null ? `${p.margin_pct.toFixed(0)}%` : '—'}</span> <span style={{ color: E.faint }}>margin{healthy ? ' · ≥3×' : ''}</span></span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center', fontSize: 'var(--text-caption)', color: E.muted }}>
            <span>{p.days_trending != null ? `${p.days_trending}d trending` : 'trend unknown'}</span>
            <span>· {p.velocity === 'rising' ? '↑ rising' : p.velocity === 'fading' ? '↓ fading' : p.velocity === 'flat' ? '→ flat' : '— velocity'}</span>
            {p.content_difficulty && <span>· {p.content_difficulty} content</span>}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{p.score != null && <span style={num}>{p.score}/10</span>}<ConfidenceBadge c={p.confidence} /></span>
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4 }}>as of {ago(p.as_of)} · {p.source}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px 12px', marginTop: 'auto' }}>
        <button style={{ ...btn('ghost'), padding: '7px 10px' }} onClick={onWatch} title="Watch">{p.watched ? '★' : '☆'}</button>
        <button style={{ ...btn('ghost'), padding: '7px 12px' }} onClick={onOpen}>Research</button>
        <button style={{ ...btn('primary'), padding: '7px 12px', marginLeft: 'auto' }} onClick={onBuild}>Build a brand from this</button>
      </div>
    </div>
  );
}
