import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useOwnerTickets } from '../../data/useOwnerTickets';
import type { TicketStatus } from '../../data/useOwnerTickets';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onOpenClient: (clientId: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18, cursor: 'pointer' };
const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'var(--surface-3)',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const activeChip: CSSProperties = { background: 'var(--text)', color: 'var(--bg)', border: 'none' };

const STATUS_COLOR: Record<TicketStatus, string> = { open: 'var(--danger)', options_sent: 'var(--warning)', resolved: 'var(--text-tertiary)' };
const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', options_sent: 'Options sent', resolved: 'Resolved' };

/** Structured feedback tickets from every client portal — "what to avoid"
 *  and "what you'd prefer" always required, no open-ended redo path.
 *  Split out of the merged Inbox so tickets read as their own thing.
 *  Tapping one lands on that client in Client Modules to work it. */
export default function TicketsScreen({ homeHeadStyle, homeSubStyle, onOpenClient }: Props) {
  const { tickets, loading } = useOwnerTickets();
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div>
      <div style={homeHeadStyle}>Tickets</div>
      <div style={homeSubStyle}>
        Structured feedback filed from client portals — each one already carries what to avoid and what they'd prefer
        instead. Tap one to work it from that client's profile.
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={{ ...ghostBtn, ...(filter === 'all' ? activeChip : {}) }} onClick={() => setFilter('all')}>All ({tickets.length})</div>
        <div style={{ ...ghostBtn, ...(filter === 'open' ? activeChip : {}) }} onClick={() => setFilter('open')}>
          Open ({tickets.filter((t) => t.status === 'open').length})
        </div>
        <div style={{ ...ghostBtn, ...(filter === 'options_sent' ? activeChip : {}) }} onClick={() => setFilter('options_sent')}>
          Options sent ({tickets.filter((t) => t.status === 'options_sent').length})
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 680 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing here.</div>
        )}
        {filtered.map((t) => (
          <div key={t.id} style={cardStyle} onClick={() => onOpenClient(t.clientId)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>{t.clientName}</div>
              </div>
              <span style={{
                fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                color: STATUS_COLOR[t.status], border: `1px solid ${STATUS_COLOR[t.status]}66`,
                borderRadius: 'var(--radius-pill)', padding: '3px 9px', flexShrink: 0,
              }}>
                {STATUS_LABEL[t.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
