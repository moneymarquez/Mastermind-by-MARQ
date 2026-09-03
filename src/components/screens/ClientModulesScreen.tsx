import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientModulesOverview } from '../../data/useClientModulesOverview';
import type { ClientOverviewRow } from '../../data/useClientModulesOverview';
import { currentStation } from '../../data/clientSpine';
import { cardStyle, ghostBtn, STAGES } from './ClientCRMScreen';
import ClientPortalAdmin from './ClientPortalAdmin';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  /** A ticket/message tapped in the Inbox widget lands straight on that
   *  client; consumed once. */
  focusClientId: string | null;
  onClearFocus: () => void;
  /** Bubbles up after any write so the Inbox widget's counts refresh. */
  onChanged?: () => void;
}

const count = (n: number, color: string): CSSProperties => ({
  fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)',
  padding: '3px 8px', color: n ? color : 'var(--text-tertiary)', border: `1px solid ${n ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--border)'}`,
  whiteSpace: 'nowrap', opacity: n ? 1 : 0.6,
});

function ago(iso: string | null): string {
  if (!iso) return 'no activity yet';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Operator side of the client portal. The overview answers "who needs
 *  me" in one glance — open tickets first, then unread messages, then
 *  recency — and the detail is the same ClientPortalAdmin the Client CRM's
 *  Portal tab renders, so there is exactly one screen to maintain. */
export default function ClientModulesScreen({ homeHeadStyle, homeSubStyle, focusClientId, onClearFocus, onChanged }: Props) {
  const overview = useClientModulesOverview();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (focusClientId) {
      setSelectedId(focusClientId);
      onClearFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusClientId]);

  const selected = overview.rows.find((r) => r.client.id === selectedId) ?? null;
  const changed = () => { overview.reload(); onChanged?.(); };

  if (selected) {
    const station = currentStation(selected.spine);
    return (
      <div>
        <span style={{ ...ghostBtn, marginBottom: 14 }} onClick={() => setSelectedId(null)}>← All clients</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={homeHeadStyle}>{selected.client.business_name}</div>
          <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>{STAGES.find((s) => s.key === selected.client.stage)?.label}{station ? ` · ${station.label}` : ''}{selected.hasLogin ? ' · has login' : ' · no login yet'}</span>
        </div>
        <ClientPortalAdmin client={selected.client} onChanged={changed} />
      </div>
    );
  }

  const needsYou = overview.rows.filter((r) => r.openTickets || r.unreadMessages);

  return (
    <div>
      <div style={homeHeadStyle}>Client Modules</div>
      <div style={homeSubStyle}>
        {overview.loading ? 'Loading…' : overview.rows.length === 0 ? 'No clients yet — add one in Client CRM.' : needsYou.length ? `${needsYou.length} client${needsYou.length === 1 ? '' : 's'} waiting on you.` : 'Nothing waiting on you.'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, maxWidth: 720 }}>
        {overview.rows.map((r: ClientOverviewRow) => {
          const station = currentStation(r.spine);
          return (
            <div key={r.client.id} style={{ ...cardStyle, padding: 16, cursor: 'pointer', borderColor: r.openTickets ? 'color-mix(in srgb, var(--danger) 40%, var(--border))' : 'var(--border)' }} onClick={() => setSelectedId(r.client.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{r.client.business_name}</div>
                    <span style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>{STAGES.find((s) => s.key === r.client.stage)?.label ?? r.client.stage}</span>
                    {r.handoff && <span style={{ fontSize: 'var(--text-nano)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 40%, transparent)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>handoff</span>}
                    {!r.hasLogin && <span style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)' }}>no login</span>}
                  </div>
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {station ? <><strong>{station.label}</strong> — {station.detail}</> : '—'}
                  </div>
                </div>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{ago(r.lastActivity)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <span style={count(r.openTickets, 'var(--danger)')}>{r.openTickets} open ticket{r.openTickets === 1 ? '' : 's'}</span>
                <span style={count(r.awaitingChoice, 'var(--warning)')}>{r.awaitingChoice} awaiting pick</span>
                <span style={count(r.unreadMessages, 'var(--danger)')}>{r.unreadMessages} unread</span>
                <span style={count(r.pendingApprovals, 'var(--warning)')}>{r.pendingApprovals} awaiting OK</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
