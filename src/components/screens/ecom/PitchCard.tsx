import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { money } from '../../../data/ecom';
import { E, Badge, label, tint } from './ecomShared';

// The Product Pitch card (brief §2.2): everything Marq needs to say yes or
// no to tonight's #1 product in one look. Numbers carry their confidence
// label; sales estimates only show when a source backs them.

type P = Record<string, unknown>;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
interface Seller { name: string; shop_url: string | null; price: number | null; est_monthly_orders: number | null; est_monthly_revenue: number | null; confidence: string; source_url: string | null; shop_look: string; screenshot_url: string | null }
interface Math { sell: number; supplier: number; ship: number; landed: number; profit: number; marginPct: number; breakEvenOrders: number | null }

export function confidenceColor(pct: number): string { return pct >= 65 ? E.green : pct >= 45 ? E.amber : E.red; }

export function PitchBody({ p }: { p: P }) {
  const m = (p.math ?? {}) as Math;
  const sellers = arr<Seller>(p.sellers);
  const out = (p.outcomes ?? {}) as { conservative?: { orders: number; profit: number }; base?: { orders: number; profit: number }; basis?: string };
  const conf = Number(p.confidence_pct ?? 50);
  const sup = (p.supplier ?? {}) as { name?: string; url?: string | null; ship_days?: number | null; us_warehouse?: boolean | null; unit_cost?: number | null };
  const where = (p.where ?? {}) as { tiktok_shop_fit?: boolean; note?: string };
  const box = { background: tint(E.border, 18), borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 14, alignItems: 'center' }}>
        {typeof p.image === 'string' && p.image ? <img src={p.image} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, border: `1px solid ${E.border}` }} /> : <div style={{ width: 84, height: 84, borderRadius: 12, background: tint(E.border, 30) }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: confidenceColor(conf), fontVariantNumeric: 'tabular-nums' }}>{conf}%</span>
            <span style={{ fontSize: 13, color: E.muted }}>confidence it works · {money(m.profit)} profit per order · {Math.round(m.marginPct ?? 0)}% margin</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge color={E.blue}>Shopify store</Badge>
            {where.tiktok_shop_fit && <Badge color={E.violet}>TikTok Shop fits</Badge>}
            <Badge color={E.faint}>research: {String(p.research_via ?? 'claude') === 'parallel' ? 'Parallel' : 'web search'}</Badge>
          </div>
        </div>
      </div>

      <div style={box}>
        <span style={label}>Why it works</span>
        {arr<string>(p.reasons).map((r, i) => <div key={i} style={{ fontSize: 14, color: E.text }}>✓ {r}</div>)}
        <span style={{ ...label, marginTop: 4 }}>Top risks</span>
        {arr<string>(p.risks).map((r, i) => <div key={i} style={{ fontSize: 14, color: E.text }}>⚠ {r}</div>)}
      </div>

      {arr<{ claim: string; url: string | null }>(p.why_now).length > 0 && (
        <div style={box}>
          <span style={label}>Why now</span>
          {arr<{ claim: string; url: string | null }>(p.why_now).map((w, i) => <div key={i} style={{ fontSize: 14, color: E.text }}>{w.claim}{w.url && <> <a href={w.url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, fontSize: 12 }}>source ↗</a></>}</div>)}
        </div>
      )}

      <div style={box}>
        <span style={label}>Who's selling it most</span>
        {sellers.length === 0 && <div style={{ fontSize: 13, color: E.muted }}>No sellers found with sources.</div>}
        {sellers.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: s.screenshot_url ? '64px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 10, paddingTop: i ? 8 : 0, borderTop: i ? `1px solid ${E.border}` : 'none' }}>
            {s.screenshot_url && <img src={s.screenshot_url} alt={`${s.name} shop`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: E.text }}>{s.name}</span>
                {s.price != null && <Badge color={E.faint}>{money(s.price)}</Badge>}
                {s.shop_url && <a href={s.shop_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: E.blue }}>shop ↗</a>}
              </div>
              <div style={{ fontSize: 13, color: E.muted }}>
                {s.est_monthly_orders != null ? `~${s.est_monthly_orders.toLocaleString('en-US')} orders/mo` : 'Sales unknown'}{s.est_monthly_revenue != null ? ` · ~${money(s.est_monthly_revenue, 0)}/mo` : ''}
                {' '}<Badge color={s.confidence === 'estimate' ? E.amber : E.faint}>{s.confidence}</Badge>
                {s.source_url && <> <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, fontSize: 12 }}>source ↗</a></>}
              </div>
              {s.shop_look && <div style={{ fontSize: 13, color: E.text }}>{s.shop_look}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        {[['Sell price', money(m.sell)], ['Supplier + ship', `${money(m.supplier)} + ${money(m.ship)}`], ['Landed (incl. fees, returns)', money(m.landed)], ['Profit per order', money(m.profit)], ['Margin', `${Math.round(m.marginPct ?? 0)}%`], ['Break-even on $100 test', m.breakEvenOrders != null && Number.isFinite(m.breakEvenOrders) ? `${m.breakEvenOrders} orders` : '—']].map(([k, v]) => (
          <div key={k} style={{ ...box, gap: 2 }}><span style={{ fontSize: 11.5, color: E.faint }}>{k}</span><span style={{ fontSize: 17, fontWeight: 600, color: E.text, fontVariantNumeric: 'tabular-nums' }}>{v}</span></div>
        ))}
      </div>

      <div style={box}>
        <span style={label}>Realistic first month</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><span style={{ fontSize: 12, color: E.faint }}>Conservative</span><div style={{ fontSize: 16, fontWeight: 600, color: E.text }}>{out.conservative?.orders ?? '—'} orders · {money(out.conservative?.profit ?? 0, 0)}</div></div>
          <div><span style={{ fontSize: 12, color: E.faint }}>Base</span><div style={{ fontSize: 16, fontWeight: 600, color: E.text }}>{out.base?.orders ?? '—'} orders · {money(out.base?.profit ?? 0, 0)}</div></div>
        </div>
        {out.basis && <div style={{ fontSize: 12.5, color: E.muted }}>{out.basis} <Badge color={E.amber}>estimate</Badge></div>}
      </div>

      <div style={box}>
        <span style={label}>Getting it shipped fast</span>
        <div style={{ fontSize: 14, color: E.text }}>{sup.name ?? '—'}{sup.us_warehouse ? ' · US warehouse' : ''}{sup.ship_days != null ? ` · ${sup.ship_days} days` : ''}{sup.unit_cost != null ? ` · ${money(sup.unit_cost)}/unit` : ''}{sup.url && <> <a href={sup.url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, fontSize: 12 }}>open ↗</a></>}</div>
        {typeof p.ship_plan === 'string' && p.ship_plan && <div style={{ fontSize: 13, color: E.muted }}>{p.ship_plan}</div>}
        {where.note && <div style={{ fontSize: 13, color: E.muted }}>{where.note}</div>}
      </div>
    </div>
  );
}

/** Brand Lab's directions with the Visual worker's images under each. */
export function DirectionVisuals({ approvalId, direction }: { approvalId: string; direction?: number }) {
  const [rows, setRows] = useState<{ id: string; direction: number; kind: string; status: string; url: string | null; prompt: string; error: string | null }[]>([]);
  useEffect(() => {
    supabase.from('ecom_visuals').select('id,direction,kind,status,url,prompt,error').eq('approval_id', approvalId).order('direction').then(({ data, error }) => setRows(error ? [] : ((data ?? []) as typeof rows)));
  }, [approvalId]);
  const mine = rows.filter((r) => direction == null || r.direction === direction);
  if (!mine.length) return null;
  const blocked = mine.find((r) => r.status === 'blocked' || r.status === 'needs_approval');
  const planned = mine.every((r) => r.status === 'planned');
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 6 }}>
        {mine.map((r) => (
          <div key={r.id} title={r.prompt} style={{ aspectRatio: r.kind === 'logo' ? '1' : '3 / 4', borderRadius: 8, overflow: 'hidden', background: tint(E.border, 25), display: 'flex', alignItems: 'flex-end' }}>
            {r.url ? <img src={r.url} alt={`${r.kind} image`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10.5, color: E.faint, padding: 6 }}>{r.kind} · {r.status}</span>}
          </div>
        ))}
      </div>
      {planned && <div style={{ fontSize: 12, color: E.faint, marginTop: 4 }}>Images are planned but not made: Higgsfield isn't connected (Setup → Higgsfield). Hover a tile for its prompt.</div>}
      {blocked && <div style={{ fontSize: 12, color: E.amber, marginTop: 4 }}>{blocked.error}</div>}
    </div>
  );
}
