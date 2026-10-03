import type { Campaign } from '../../../data/useCampaigns';
import type { PipelineItem, PipelineStage } from '../../../data/useMarketing';
import type { Inbound } from '../../../data/useInbound';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import { Bars } from '../../mm/charts';
import { useModule } from '../../mm/Page';

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const PIPE: { l: string; stages: PipelineStage[] }[] = [
  { l: 'Ideas', stages: ['idea'] }, { l: 'Drafted', stages: ['drafted'] }, { l: 'Ready', stages: ['filmed', 'scheduled'] }, { l: 'Posted', stages: ['published'] },
];
const WEEK = 7 * 86400000;

/** The Marketing dashboard (design handoff: MM 5 Scaling + MM Wide):
 *  leads from marketing, spend, live campaigns, the content pipeline and
 *  leads by week. The campaign list itself is CampaignsHome, right below. Every number comes from campaigns' logged results,
 *  Inbound, and the content pipeline; nothing is estimated. */
export default function MarketingOverview({ campaigns, pipeline, inbound }: { campaigns: Campaign[]; pipeline: PipelineItem[]; inbound: Inbound[] }) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const now = new Date();
  const month = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const thisMonth = inbound.filter((r) => month(new Date(r.first_touch_at)) === month(now)).length;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = inbound.filter((r) => month(new Date(r.first_touch_at)) === month(lastMonthDate)).length;
  const delta = thisMonth - lastMonth;

  const spend = campaigns.reduce((s, c) => s + (c.results?.spend ?? 0), 0);
  const loggedLeads = campaigns.reduce((s, c) => s + (c.results?.leads ?? 0), 0);
  const live = campaigns.filter((c) => c.status === 'running');
  const inPipe = pipeline.filter((p) => p.stage !== 'published').length;

  const start = now.getTime() - 6 * WEEK;
  const weeks = Array.from({ length: 6 }, (_, i) => inbound.filter((r) => { const t = Date.parse(r.first_touch_at); return t >= start + i * WEEK && t < start + (i + 1) * WEEK; }).length);
  const weekLabels = Array.from({ length: 6 }, (_, i) => new Date(start + i * WEEK).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));


  const stats = [
    <Stat key="l" label="Leads from marketing" value={String(thisMonth)} pill={lastMonth || thisMonth ? `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} vs last month` : 'This month'} k={delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'} />,
    <Stat key="s" label="Spend" value={usd(spend)} pill={spend && loggedLeads ? `${usd(spend / loggedLeads)} per lead` : 'Logged on campaigns'} />,
    <Stat key="c" label="Live campaigns" value={String(live.length)} pill={`${campaigns.length} total`} />,
    <Stat key="p" label="Content in pipeline" value={String(inPipe)} pill={`${pipeline.length - inPipe} posted`} />,
  ];

  const pipeCard = (
    <Card title="Content pipeline" meta={`${pipeline.length} ${pipeline.length === 1 ? 'piece' : 'pieces'}`} wide={!phone}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6 }}>
        {PIPE.map((s) => (
          <div key={s.l} style={{ padding: '10px 8px', borderRadius: 10, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.l}</span>
            <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600 }}>{pipeline.filter((p) => s.stages.includes(p.stage)).length}</span>
          </div>
        ))}
      </div>
    </Card>
  );
  const leadsCard = weeks.some(Boolean) && <Card title="Leads by week" meta="Inbound" wide={!phone}><Bars vals={weeks} labels={weekLabels} pre="" /></Card>;

  if (phone) {
    return <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats.slice(0, 2)}</div>{pipeCard}</>;
  }
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
      <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'minmax(0,1fr) minmax(0,2fr)' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
        {pipeCard}{leadsCard}
      </div>
    </>
  );
}
