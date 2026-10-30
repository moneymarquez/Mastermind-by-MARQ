import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { metaPushGate } from '../../data/metaAds';
import type { MetaDraft } from '../../data/metaAds';
import { E, Badge, btn, label } from '../screens/ecom/ecomShared';

// Meta ads builder, drafts only. "Draft Meta ads" builds a campaign, ad sets
// and ads from this product's margin math and files it in Approvals.
// "Push to Meta" stays disabled until a Meta ads key exists, DRY_RUN is
// off and the draft is approved; the Worker checks spend again and, in this
// release, still sends nothing.

type Source = { product_id: string } | { client: { client_id: string; client_name: string; product: string; price: number; unit_cost: number; ship: number } };
interface Card { id: string; status: string; payload: MetaDraft; created_at: string }
const money = (n: number) => `$${n.toFixed(2)}`;

export function MetaDraftView({ d }: { d: MetaDraft }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-caption)', color: E.muted }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge color={d.math.verdict === 'Scale' ? E.green : d.math.verdict === 'Test' ? E.amber : E.red}>{d.math.verdict}</Badge>
        <span style={{ color: E.text }}>Bid ceiling <span style={{ fontFamily: 'var(--g-mono)', fontWeight: 500 }}>{money(d.bid_ceiling_usd)}</span> (break-even CPA)</span>
        <span>· break-even ROAS {d.math.break_even_roas} · {d.math.cm_pct.toFixed(0)}% after ads{d.math.ad_cost_estimated ? ' (ads estimated)' : ''}</span>
      </div>
      <div><span style={label}>Campaign</span> {d.campaign.name} · Sales · Paused · {money(d.campaign.daily_budget_usd)}/day × {d.campaign.days} days = {money(d.campaign.total_budget_usd)}</div>
      {d.ad_sets.map((s) => (
        <div key={s.name} style={{ padding: '6px 0 6px 10px', borderLeft: '2px solid var(--g-line-2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div><span style={label}>Ad set</span> {s.targeting.audience} · {s.targeting.geo}, {s.targeting.age_min}–{s.targeting.age_max} · cost cap {money(s.bid_amount_usd)} · {money(s.daily_budget_usd)}/day</div>
          {d.ads.filter((a) => a.ad_set === s.name).map((a) => <div key={a.name} style={{ paddingLeft: 10 }}>• <b style={{ color: E.text }}>{a.name.split(' · ')[1]}</b>: "{a.primary_text}" <span style={{ color: E.faint }}>({a.creative})</span></div>)}
        </div>
      ))}
      <div><span style={label}>Kill rule</span> {d.kill_rule}</div>
      {d.warnings.map((w) => <div key={w} style={{ color: E.amber, display: 'flex', gap: 7, alignItems: 'baseline' }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flex: 'none', transform: 'translateY(-1px)' }} />{w}</div>)}
    </div>
  );
}

export default function MetaAdsBuilder({ source, entityId }: { source: Source; entityId: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<{ hasKey: boolean; dryRun: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const r = await supabase.from('ai_approvals').select('id,status,payload,created_at').eq('type', 'meta_ads_draft').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(3);
    setCards(r.error ? [] : ((r.data ?? []) as Card[]));
  }, [entityId]);
  useEffect(() => { void load(); void api<{ hasKey: boolean; dryRun: boolean }>('/api/meta-ads/status').then((s) => { if (!s.error) setStatus({ hasKey: !!s.hasKey, dryRun: s.dryRun !== false }); }); }, [load]);
  const draft = async () => {
    setBusy(true); setMsg('');
    const r = await api<{ ok?: boolean; draft?: MetaDraft }>('/api/meta-ads/draft', { body: source });
    setBusy(false);
    setMsg(r.error ?? 'Draft saved. It is waiting in Approvals; nothing went to Meta.');
    await load();
  };
  const push = async (c: Card) => {
    setBusy(true);
    const r = await api<{ ok?: boolean; reasons?: string[] }>('/api/meta-ads/push', { body: { approval_id: c.id } });
    setBusy(false); setMsg(r.error ?? 'Done.');
  };
  const latest = cards[0];
  const gate = latest ? metaPushGate({ hasKey: !!status?.hasKey, dryRun: status?.dryRun ?? true, approvalStatus: latest.status, blocked: !!latest.payload.blocked }) : null;
  return (
    <div data-testid="meta-ads" style={{ ...E.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', color: E.text, flex: 1 }}>Meta ads <span style={{ color: E.faint, fontWeight: 400 }}>· drafts only</span></span>
        <button style={btn('ghost')} disabled={busy} onClick={() => void draft()}>{busy ? 'Working…' : latest ? 'Draft again' : 'Draft Meta ads'}</button>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Campaign, 2 ad sets and 6 ads from this product's margin math. The bid ceiling is the break-even CPA, so no sale costs more than it earns. Saved to Approvals; nothing is sent to Meta.</div>
      {latest && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Badge color={latest.status === 'approved' ? E.green : latest.status === 'pending' ? E.amber : E.faint}>{latest.status === 'pending' ? 'waiting in Approvals' : latest.status === 'killed' ? 'rejected' : latest.status.replace('_', ' ')}</Badge></div>
          <MetaDraftView d={latest.payload} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button style={{ ...btn('primary'), opacity: gate?.enabled ? 1 : 0.5 }} disabled={!gate?.enabled || busy} aria-disabled={!gate?.enabled} onClick={() => void push(latest)}>Push to Meta</button>
            {gate && !gate.enabled && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, flex: 1 }}>Off: {gate.reasons.join(' ')}</div>}
          </div>
        </>
      )}
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{msg}</div>}
    </div>
  );
}
