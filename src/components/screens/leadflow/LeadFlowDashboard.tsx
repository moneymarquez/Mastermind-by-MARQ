import { useMemo } from 'react';
import { useLeadflowLeads } from '../../../data/useLeadflow';
import { fmtIndustry, fmtAgo, tagSignal, tagLabel } from './format';
import { KpiStrip, NotConnected, Tag, Dot, Lede, PanelHead, SkeletonRows } from './ui';
import { HeaderAction, useLfPhone } from './layout';

/** Time-of-day greeting. */
function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function LeadFlowDashboard({ onOpenFinder }: { onOpenFinder: () => void }) {
  const { leads, counts, loading, notConnected } = useLeadflowLeads();
  const phone = useLfPhone();

  const industryData = useMemo(() => {
    const byInd: Record<string, number> = {};
    for (const l of leads) if (l.industry) byInd[l.industry] = (byInd[l.industry] || 0) + 1;
    return Object.entries(byInd).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [leads]);
  const top = Math.max(1, ...industryData.map((d) => d.value));

  const temp = [
    { label: 'Hot', n: counts.hot, s: 'go' as const },
    { label: 'Warm', n: counts.warm, s: 'wait' as const },
    { label: 'Not ready', n: counts.cold, s: 'neu' as const },
  ];
  const tempTotal = temp.reduce((a, t) => a + t.n, 0);
  const recent = leads.slice(0, 5);
  const now = Date.now();

  return (
    <>
      <HeaderAction><button className="lf-btn lf-btn--secondary" onClick={onOpenFinder}>View lead finder</button></HeaderAction>
      {notConnected && <NotConnected />}
      <Lede>{greeting()}. Here's where the pipeline stands.</Lede>
      <KpiStrip compact={phone} items={[
        { label: 'Total leads', value: counts.total, s: 'neu' },
        { label: 'Hot', value: counts.hot, s: 'go' },
        { label: 'Warm', value: counts.warm, s: 'wait' },
        { label: 'Not ready', value: counts.cold, s: 'neu' },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16 }}>
        <div className="lf-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Leads by industry</div>
          <div className="lf-label" style={{ marginBottom: 12 }}>Top 10</div>
          {industryData.length === 0 && <div style={{ fontSize: 14, color: 'var(--lf-text-tertiary)' }}>{loading ? 'Counting…' : 'No leads yet.'}</div>}
          {industryData.map((b) => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13 }}>
              <div className="lf-trunc" style={{ width: phone ? 110 : 140, color: 'var(--lf-text-secondary)' }} title={fmtIndustry(b.name)}>{fmtIndustry(b.name)}</div>
              <div style={{ flex: 1 }}><div style={{ height: 10, borderRadius: 2, background: 'var(--lf-accent)', opacity: 0.8, width: `${(b.value / top) * 100}%` }} /></div>
              <div className="lf-mono" style={{ width: 32, textAlign: 'right' }}>{b.value}</div>
            </div>
          ))}
        </div>
        <div className="lf-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Pipeline temperature</div>
          <div className="lf-label" style={{ marginBottom: 12 }}>Hot, warm and not ready</div>
          <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', gap: 2, background: tempTotal ? undefined : 'var(--lf-surface-2)' }} role="img" aria-label={temp.map((t) => `${t.label} ${t.n}`).join(', ')}>
            {temp.filter((t) => t.n > 0).map((t) => <div key={t.label} style={{ flex: t.n, background: `var(--lf-${t.s}-dot)` }} />)}
          </div>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {temp.map((t, i) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--lf-border)' : 0 }}>
                <Dot s={t.s} /><span style={{ flex: 1 }}>{t.label}</span>
                <span className="lf-mono" style={{ width: 48, textAlign: 'right' }}>{t.n}</span>
                <span className="lf-mono" style={{ width: 48, textAlign: 'right', color: 'var(--lf-text-tertiary)' }}>{tempTotal ? `${Math.round((t.n / tempTotal) * 100)}%` : '–'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lf-panel" style={{ overflow: 'hidden' }}>
        <PanelHead title="Recent leads" right={<a href="#" onClick={(e) => { e.preventDefault(); onOpenFinder(); }} style={{ fontSize: 13 }}>Open lead finder →</a>} />
        {loading && recent.length === 0 ? <SkeletonRows rows={5} cols="2fr 1.2fr 1fr 110px 80px" /> : recent.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: 14, color: 'var(--lf-text-secondary)' }}>No leads yet.</div>
        ) : recent.map((l, i) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr) auto' : 'minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr) 110px 80px', alignItems: 'center', minHeight: 44, padding: '0 16px', gap: 8, borderTop: i ? '1px solid var(--lf-border)' : 0, fontSize: 14 }}>
            <span className="lf-trunc" style={{ fontWeight: 500 }}>{l.business_name}</span>
            {!phone && <span className="lf-cell-2 lf-trunc">{fmtIndustry(l.category || l.industry)}</span>}
            {!phone && <span className="lf-cell-2 lf-trunc">{l.city}</span>}
            <span>{l.tag && <Tag s={tagSignal(l.tag)}>{tagLabel(l.tag)}</Tag>}</span>
            {!phone && <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)', textAlign: 'right' }}>{fmtAgo(l.created_at, now)}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
