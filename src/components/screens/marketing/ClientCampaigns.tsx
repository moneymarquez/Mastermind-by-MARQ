import type { CSSProperties } from 'react';
import { useCampaigns } from '../../../data/useCampaigns';
import { deriveStatus, actualForMetric } from '../../../data/campaignBuilder';
import { StatusChip } from './CampaignCockpit';

interface Props {
  clientId: string;
  onOpenCampaign: (campaignId: string) => void;
  onStartCampaign: (clientId: string) => void;
}

/** A client's campaigns, pulled into their CRM page by assignment. Read
 *  only here — building and running happen in Marketing. */
export default function ClientCampaigns({ clientId, onOpenCampaign, onStartCampaign }: Props) {
  const { campaigns, assets, loading } = useCampaigns();
  const mine = campaigns.filter((c) => c.client_id === clientId);
  const now = new Date();
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' };
  return (
    <div style={{ marginTop: 18, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Campaigns</div>
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => onStartCampaign(clientId)}>+ New campaign in Marketing</span>
      </div>
      <div style={{ marginTop: 6 }}>
        {mine.map((c) => {
          const s = deriveStatus({
            status: c.status, answers: c.answers, last_activity_at: c.last_activity_at, launched_at: c.launched_at, start_date: c.start_date,
            target_metric: c.target_metric, target_value: c.target_value, isInternal: false,
            assets: assets.filter((a) => a.campaign_id === c.id).map((a) => ({ name: a.name, status: a.status })),
            actual: actualForMetric(c.target_metric, c.results ?? {}, null), now,
          });
          return (
            <div key={c.id} style={row}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}><span style={{ fontFamily: 'var(--font-mono)' }}>{s.progress}</span> · {s.reason}</div>
              </div>
              <StatusChip level={s.level} />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => onOpenCampaign(c.id)}>{s.next.label} →</span>
            </div>
          );
        })}
        {!loading && mine.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', paddingTop: 6 }}>No campaigns assigned to this client yet.</div>}
      </div>
    </div>
  );
}
