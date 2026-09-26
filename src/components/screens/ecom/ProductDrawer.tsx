import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Product, Snapshot, ProductDetail } from '../../../data/ecomProducts';
import { landedCost, marginPct, marginHealthy, sparklinePath, rankTrend } from '../../../data/ecomProducts';
import { CHANNELS, money, ago } from '../../../data/ecom';
import { Drawer, E, Metric, Badge, ConfidenceBadge, Section, TeachingEmpty, btn, field, label } from './ecomShared';

interface Props {
  product: Product | null;
  snapshots: Snapshot[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<Product>) => Promise<void>;
  onToggleWatch: (p: Product) => Promise<void>;
  onBuildBrand: (p: Product) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const SECTIONS: { key: keyof ProductDetail; title: string; hint: string }[] = [
  { key: 'problem', title: 'Why it\'s selling', hint: 'The problem it solves, what triggered the trend, evidence links.' },
  { key: 'buyer', title: 'Who\'s buying', hint: 'Age range, gender skew, life situation, where they scroll, what they already own. Never "people who like home decor".' },
  { key: 'why_emotional', title: 'Why they buy', hint: 'Emotional reason + practical reason + the psychology principle at play.' },
  { key: 'angle', title: 'Angle that\'s converting', hint: 'The hook or story in the top content right now, with examples.' },
  { key: 'suppliers', title: 'Sourcing', hint: 'Top supplier links, ship time, rating. Feeds Step 4.' },
  { key: 'competition', title: 'Competition', hint: 'Number of sellers, saturation, room for a new angle.' },
  { key: 'fail_risks', title: 'Why it could fail', hint: 'Returns risk, fragile, seasonal, trademark risk, platform-restricted category.' },
  { key: 'success_metrics', title: 'How we\'ll know it\'s working', hint: 'The specific numbers from the read loop: views by day 5, first sale by day 7, cart rate.' },
  { key: 'sources', title: 'Sources', hint: 'Every link, with as-of dates.' },
];

/** §5 product drawer — everything, grouped. Phase 2 fields are edited by
 *  hand; from Phase 3 the Scout and Analyst fill the same fields. */
export default function ProductDrawer({ product: p, snapshots, onClose, onSave, onToggleWatch, onBuildBrand, onRemove }: Props) {
  const [detail, setDetail] = useState<ProductDetail>(p?.detail ?? {});
  const [nums, setNums] = useState({ sell: p?.sell_price?.toString() ?? '', supplier: p?.supplier_cost?.toString() ?? '', ship: p?.detail.ship_cost?.toString() ?? '' });
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  if (!p) return null;
  const ch = CHANNELS.find((c) => c.id === p.channel);
  const ranks = snapshots.map((s) => s.rank);
  const path = sparklinePath(ranks, 240, 60);
  const sell = Number(nums.sell) || 0, sup = Number(nums.supplier) || 0, ship = Number(nums.ship) || 0;
  const landed = sell && nums.supplier !== '' ? landedCost(sup, ship, sell) : null;
  const margin = landed != null ? marginPct(sell, landed) : null;
  const breakEven = landed != null && sell > landed ? Math.ceil(100 / (sell - landed)) : null;
  const dirty = JSON.stringify(detail) !== JSON.stringify(p.detail) || nums.sell !== (p.sell_price?.toString() ?? '') || nums.supplier !== (p.supplier_cost?.toString() ?? '') || nums.ship !== (p.detail.ship_cost?.toString() ?? '');

  const save = async () => {
    setSaving(true);
    await onSave(p.id, {
      detail: { ...detail, ship_cost: ship || undefined },
      sell_price: nums.sell === '' ? null : sell, supplier_cost: nums.supplier === '' ? null : sup,
      landed_cost: landed, margin_pct: margin,
    });
    setSaving(false);
  };

  const ta: CSSProperties = { ...field, minHeight: 64, resize: 'vertical' };
  return (
    <Drawer open onClose={onClose} width={680}
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{p.rank != null && <Badge color="#111827">#{p.rank}</Badge>}{p.name}</span>}
      subtitle={<>{ch?.label} · {p.category ?? 'uncategorised'} · as of {ago(p.as_of)} · <ConfidenceBadge c={p.confidence} /></>}
      actions={<button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => onToggleWatch(p)} title="Watch">{p.watched ? '★' : '☆'}</button>}
    >
      {/* Snapshot */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {p.images.length === 0 ? <div style={{ width: 160, height: 120, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: E.faint, fontSize: 12, flexShrink: 0 }}>No photo — add image_url</div>
          : p.images.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ flex: '0 0 auto' }}><img src={u} alt="" loading="lazy" style={{ height: 140, borderRadius: 10, border: `1px solid ${E.border}`, display: 'block' }} /></a>)}
      </div>
      <div style={{ ...E.card, padding: 14, marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={label}>Rank history · {snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} {rankTrend(ranks)}</div>
          {path ? (
            <svg width={240} height={60} style={{ display: 'block', marginTop: 6 }}><path d={path} fill="none" stroke={E.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>
          ) : <div style={{ fontSize: 'var(--text-body)', color: E.faint, marginTop: 6 }}>Builds up as the sheet is refreshed — import the same product again on a later day.</div>}
        </div>
        <Metric label="Price now" value={money(p.sell_price)} confidence={p.confidence} asOf={p.as_of} />
        <Metric label="Days trending" value={p.days_trending != null ? String(p.days_trending) : '—'} trend={p.velocity === 'rising' ? '↑ rising' : p.velocity === 'fading' ? '↓ fading' : p.velocity === 'flat' ? '→ flat' : undefined} />
        <Metric label="Score" value={p.score != null ? `${p.score}/10` : '—'} confidence="ai" />
      </div>
      {p.detail.videos && (
        <Section title="Public videos"><div style={{ fontSize: 'var(--text-body)', color: E.text, whiteSpace: 'pre-wrap' }}>{p.detail.videos}</div><div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4 }}>Official oEmbed players arrive with the Scout (Phase 3); until then these are links.</div></Section>
      )}

      {/* Money */}
      <Section title="Money" aside={<Badge color={marginHealthy(sell || null, landed) ? E.green : E.amber}>{landed == null ? 'Enter costs' : marginHealthy(sell, landed) ? '≥ 3× landed' : 'Under 3× landed'}</Badge>}>
        <div style={{ ...E.card, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {([['sell', 'Sell price'], ['supplier', 'Supplier cost'], ['ship', 'Shipping']] as const).map(([k, l]) => (
              <div key={k}><div style={{ ...label, marginBottom: 4 }}>{l} ($)</div><input style={{ ...field, fontFamily: 'var(--font-mono)' }} inputMode="decimal" value={nums[k]} onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value }))} /></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
            <Metric label="Fees (3%)" value={money(sell * 0.03)} confidence="estimate" />
            <Metric label="Returns (7.5%)" value={money(sell * 0.075)} confidence="estimate" />
            <Metric label="Landed" value={money(landed)} confidence="estimate" />
            <Metric label="Margin" value={margin != null ? `${margin.toFixed(0)}%` : '—'} unit={landed != null ? `· ${(sell / landed).toFixed(1)}×` : undefined} confidence="estimate" />
            <Metric label="Break-even units" value={breakEven != null ? String(breakEven) : '—'} unit="per $100 spent" confidence="estimate" />
          </div>
        </div>
      </Section>

      {SECTIONS.map((s) => (
        <Section key={s.key} title={s.title}>
          <textarea style={ta} value={(detail[s.key] as string | undefined) ?? ''} placeholder={s.hint} onChange={(e) => setDetail((d) => ({ ...d, [s.key]: e.target.value }))} />
          {s.key === 'why_emotional' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div><div style={{ ...label, marginBottom: 4 }}>Practical reason</div><input style={field} value={detail.why_practical ?? ''} onChange={(e) => setDetail((d) => ({ ...d, why_practical: e.target.value }))} /></div>
              <div><div style={{ ...label, marginBottom: 4 }}>Principle</div><input style={field} value={detail.principle ?? ''} placeholder="Anchoring, Social proof…" onChange={(e) => setDetail((d) => ({ ...d, principle: e.target.value }))} /></div>
            </div>
          )}
          {s.key === 'problem' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div><div style={{ ...label, marginBottom: 4 }}>What triggered the trend</div><input style={field} value={detail.trigger ?? ''} onChange={(e) => setDetail((d) => ({ ...d, trigger: e.target.value }))} /></div>
              <div><div style={{ ...label, marginBottom: 4 }}>Evidence links</div><input style={field} value={detail.evidence ?? ''} onChange={(e) => setDetail((d) => ({ ...d, evidence: e.target.value }))} /></div>
            </div>
          )}
        </Section>
      ))}

      <Section title="Content difficulty">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button key={d} style={{ ...btn(p.content_difficulty === d ? 'primary' : 'ghost') }} onClick={() => onSave(p.id, { content_difficulty: d })}>{d === 'easy' ? 'Easy · phone, 10s demo' : d === 'medium' ? 'Medium' : 'Hard · studio, model'}</button>
          ))}
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>Matters most with no ad budget: easy content is the whole plan.</div>
      </Section>

      {!p.detail.buyer && !p.detail.angle && (
        <div style={{ marginTop: 18 }}><TeachingEmpty what="Research fills the buyer, the angle and the money math." worker="Audience Analyst" connection="Anthropic API key" phase={3} /></div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fafafa', padding: '10px 0' }}>
        <button style={{ ...btn('ghost'), opacity: dirty && !saving ? 1 : 0.6 }} disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        <button style={{ ...btn('primary'), opacity: building ? 0.6 : 1 }} disabled={building} onClick={async () => { setBuilding(true); await onBuildBrand(p); setBuilding(false); }}>{building ? 'Creating…' : 'Build a brand from this'}</button>
        {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ ...btn('ghost'), textDecoration: 'none' }}>Source ↗</a>}
        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-caption)', color: E.faint, cursor: 'pointer' }} onClick={() => { if (window.confirm(`Remove "${p.name}" from the sheet?`)) { onRemove(p.id); onClose(); } }}>Remove</span>
      </div>
    </Drawer>
  );
}
