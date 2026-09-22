import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Campaign, CampaignAsset } from '../../../data/useCampaigns';
import { fetchDialingResults } from '../../../data/useCampaigns';
import type { DerivedStatus, DialingResults } from '../../../data/campaignBuilder';
import { deriveStatus, actualForMetric } from '../../../data/campaignBuilder';
import type { ClientListItem } from '../../../data/useClients';
import { StatusChip } from './CampaignCockpit';
import { cardStyle, inputStyle, primaryBtn, ghostBtn, labelStyle } from './CampaignStepCard';

export const INTERNAL_LABEL = 'Made by MARQ';

interface Props {
  campaigns: Campaign[];
  assets: CampaignAsset[];
  clients: ClientListItem[];
  loading: boolean;
  error: string;
  /** Preselects the assignment when arriving from a client's CRM page. */
  newForClientId?: string | null;
  onOpen: (campaign: Campaign, next: DerivedStatus['next']) => void;
  onCreate: (name: string, clientId: string | null) => Promise<void>;
  onNavigate: (screen: string) => void;
}

/** Every campaign in one list — name, who it's for, where it is, an
 *  honest status, and the next action as a button. Status comes from
 *  deriveStatus, which only reads real state: last activity, assets
 *  still needed, results against target. Zero results never reads as on
 *  track. */
export default function CampaignsHome({ campaigns, assets, clients, loading, error, newForClientId, onOpen, onCreate, onNavigate }: Props) {
  const [creating, setCreating] = useState(!!newForClientId);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string>(newForClientId ?? '');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState<Record<string, DialingResults>>({});

  useEffect(() => { if (newForClientId) { setCreating(true); setClientId(newForClientId); } }, [newForClientId]);

  // Live internal cold-calling campaigns judge themselves on Dialing's own
  // numbers, so the list needs those too — one small read per campaign.
  useEffect(() => {
    const live = campaigns.filter((c) => c.status === 'running' && c.results_source === 'internal_dialing' && c.start_date);
    let alive = true;
    Promise.all(live.map((c) => fetchDialingResults(c.start_date!, c.end_date).then((r) => [c.id, r] as const).catch(() => null))).then((rows) => {
      if (!alive) return;
      const next: Record<string, DialingResults> = {};
      for (const r of rows) if (r) next[r[0]] = r[1];
      setAuto(next);
    });
    return () => { alive = false; };
  }, [campaigns]);

  const clientName = (id: string | null) => (id ? clients.find((c) => c.id === id)?.business_name ?? 'Client' : INTERNAL_LABEL);
  const now = new Date();

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await onCreate(name.trim(), clientId || null);
    setBusy(false);
    setName('');
    setCreating(false);
  };

  const rowStyle: CSSProperties = { ...cardStyle, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', cursor: 'pointer' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={labelStyle}>Campaigns</div>
        {!creating && <button style={primaryBtn} onClick={() => setCreating(true)}>+ New campaign</button>}
      </div>

      {creating && (
        <div style={{ ...cardStyle, marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inputStyle, flex: '1 1 200px' }} placeholder="Campaign name (e.g. October cold calls)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} autoFocus />
          <select style={{ ...inputStyle, flex: '0 1 220px' }} value={clientId} onChange={(e) => setClientId(e.target.value)} title="Who this campaign is for. Clients come from the CRM.">
            <option value="">{INTERNAL_LABEL} (internal)</option>
            {clients.filter((c) => c.client_type !== 'self').map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
          <button style={{ ...primaryBtn, opacity: busy || !name.trim() ? 0.6 : 1 }} disabled={busy || !name.trim()} onClick={create}>{busy ? 'Creating…' : 'Start building'}</button>
          <button style={ghostBtn} onClick={() => setCreating(false)}>Cancel</button>
          <div style={{ flexBasis: '100%', fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Clients live in the CRM; a campaign is assigned to one, or to {INTERNAL_LABEL} for your own push. The builder walks you through ten steps from here.</div>
        </div>
      )}

      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {campaigns.map((c) => {
          const cAssets = assets.filter((a) => a.campaign_id === c.id).map((a) => ({ name: a.name, status: a.status }));
          const actual = actualForMetric(c.target_metric, c.results ?? {}, auto[c.id] ?? null);
          const s = deriveStatus({
            status: c.status, answers: c.answers, last_activity_at: c.last_activity_at, launched_at: c.launched_at, start_date: c.start_date,
            target_metric: c.target_metric, target_value: c.target_value, isInternal: !c.client_id, assets: cAssets, actual, now,
          });
          return (
            <div key={c.id} style={rowStyle} onClick={() => onOpen(c, { label: 'Open', kind: 'plan' })}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{clientName(c.client_id)} · <span style={{ fontFamily: 'var(--font-mono)', color: c.status === 'running' ? 'var(--success)' : 'var(--text-secondary)' }}>{s.progress}</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', flex: '1 1 180px', minWidth: 0 }}>
                <StatusChip level={s.level} />
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{s.reason}</div>
              </div>
              <button
                style={{ ...primaryBtn, padding: '8px 14px' }}
                onClick={(e) => { e.stopPropagation(); if (s.next.kind === 'dialing') onNavigate('dialing'); else onOpen(c, s.next); }}
              >
                {s.next.label} →
              </button>
            </div>
          );
        })}
        {!loading && campaigns.length === 0 && !creating && (
          <div style={{ ...cardStyle, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No campaigns yet. Start one for {INTERNAL_LABEL} — the cold-calling push is the one to build first.</div>
        )}
      </div>
    </div>
  );
}
