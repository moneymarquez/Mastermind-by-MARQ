import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { api } from '../../../../lib/api';
import type { useApprovals } from '../../../../data/useEcom';
import { money } from '../../../../data/ecom';
import { usePitches, useBuilds, productStatus } from '../../../../data/useEcomOctober';
import { E, Badge, btn, label } from '../ecomShared';
import { ApprovalCard } from '../ApprovalsTab';
import ProductSheetsTab from '../ProductSheetsTab';
import { confidenceColor } from '../PitchCard';
import Card from '../../../mm/Card';

const STATUS_COLOR: Record<string, string> = { researching: E.faint, pitched: E.blue, approved: E.green, rejected: E.red, building: E.amber, live: E.green };

/** Products (brief §2.1/2.2): tonight's pitch first, the research queue,
 *  how past picks did against their confidence, then every product. */
export default function ProductsSection({ approvals, search, onBuildBrand, onDecided, onOpenApprovals }: { approvals: ReturnType<typeof useApprovals>; onOpenApprovals: () => void; search: string; onBuildBrand: (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null; steps: Record<string, unknown>; current_step: number }, productId: string) => Promise<string | null>; onDecided: () => void }) {
  const pitches = usePitches();
  const builds = useBuilds();
  const [links, setLinks] = useState<{ brand_id: string; product_id: string }[]>([]);
  const [queue, setQueue] = useState<{ id: string; name: string; score: number | null; detail: Record<string, unknown>; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    supabase.from('ecom_brand_products').select('brand_id,product_id').then(({ data }) => setLinks((data ?? []) as typeof links));
    supabase.from('ecom_products').select('id,name,score,detail,created_at').order('created_at', { ascending: false }).limit(12).then(({ data }) => setQueue((data ?? []) as typeof queue));
  }, []);
  const pending = approvals.approvals.filter((a) => a.type === 'product_pitch' && a.status === 'pending');
  const brandOf = useMemo(() => Object.fromEntries(links.map((l) => [l.product_id, l.brand_id])), [links]);
  const live = useMemo(() => new Set(builds.filter((b) => b.live_url).map((b) => b.brand_id)), [builds]);
  const analysed = (id: string) => !!(queue.find((q) => q.id === id)?.detail as { analysis?: unknown } | undefined)?.analysis || pitches.rows.some((p) => p.product_id === id);
  const statusOf = (id: string) => { const s = productStatus(id, pitches.rows, brandOf, live, (x) => analysed(x) || !queue.some((q) => q.id === x)); return s ? { label: s, color: STATUS_COLOR[s] } : null; };
  const past = pitches.rows.filter((p) => p.status === 'approved');
  const judged = past.filter((p) => p.actual_orders_30d != null);
  const pitchNow = async () => { setBusy(true); setMsg(''); const r = await api<{ ok?: boolean; summary?: string; error?: string; skipped?: boolean }>('/api/engine/pitch', { body: {} }); setBusy(false); setMsg(r.error ?? r.summary ?? ''); approvals.reload(); pitches.reload(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Tonight's pitch" meta="the E-commerce orchestrator's #1 product" action={<button style={btn('ghost')} disabled={busy} onClick={() => void pitchNow()}>{busy ? 'Researching… (1–2 min)' : pending.length ? 'Pitch another now' : 'Pitch one now'}</button>}>
        {msg && <div style={{ fontSize: 13, color: E.muted, marginBottom: 8 }}>{msg}</div>}
        {pending.length === 0 ? (
          <div style={{ fontSize: 14, color: E.muted, lineHeight: 1.55 }}>No pitch waiting. Every night after Scout and Analyst run, the orchestrator picks the best product that clears the bar — <strong>at least $10 profit per order and 35% margin</strong>, $20–$80, light and unbreakable — and sends it here and to your phone.</div>
        ) : pending.map((a) => <ApprovalCard key={a.id} a={a} onDone={(m) => { setMsg(m); approvals.reload(); pitches.reload(); onDecided(); }} />)}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <Card title="Research queue" meta="newest finds; Scout + Analyst run nightly">
          {queue.length === 0 ? <div style={{ fontSize: 14, color: E.muted }}>Nothing found yet. Scout runs every night from 3:30 (or press Scout now in Product sheets).</div> : queue.slice(0, 8).map((q) => {
            const st = statusOf(q.id);
            return <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${E.border}`, fontSize: 14 }}><span style={{ flex: 1, minWidth: 0, color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</span>{q.score != null && <Badge color={E.faint}>{Number(q.score).toFixed(1)}/10</Badge>}{st && <Badge color={st.color}>{st.label}</Badge>}</div>;
          })}
        </Card>
        <Card title="Past picks: predicted vs actual" meta={judged.length ? `${judged.filter((p) => (p.actual_orders_30d ?? 0) >= 0.5 * (p.predicted_orders_base ?? 0)).length} of ${judged.length} hit half their base case` : 'checked 30 days after launch'}>
          {past.length === 0 ? <div style={{ fontSize: 14, color: E.muted }}>Once you approve pitches and their stores run for 30 days, each pick's confidence sits next to what really happened — so the scoring gets checked against reality.</div> : past.slice(0, 8).map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', padding: '7px 0', borderTop: `1px solid ${E.border}`, fontSize: 14 }}>
              <span style={{ color: E.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name}</span>
              <span style={{ color: confidenceColor(p.confidence_pct), fontWeight: 600 }}>{p.confidence_pct}%</span>
              <span style={{ color: E.muted, fontSize: 13 }}>{p.actual_orders_30d != null ? `${p.actual_orders_30d} vs ${p.predicted_orders_base ?? '—'} orders · ${money(p.actual_profit_30d ?? 0, 0)}` : 'waiting for 30 days'}</span>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <div style={{ ...label, marginBottom: 8 }}>Every product the bots found</div>
        <div style={{ background: E.bg, borderRadius: 16, border: '1px solid var(--border)', color: E.text, padding: 14, minWidth: 0 }}>
          <ProductSheetsTab search={search} onBuildBrand={onBuildBrand} statusOf={statusOf} onOpenApprovals={onOpenApprovals} />
        </div>
      </div>
    </div>
  );
}

