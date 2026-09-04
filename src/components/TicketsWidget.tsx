import Icon from '../Icon';
import type { OwnerTicket } from '../data/useOwnerTickets';

interface Props {
  tickets: OwnerTicket[];
  loading: boolean;
  /** Tapping a ticket lands the shell on that client in Client Modules.
   *  Tapping the header opens the full ticket list. */
  onOpen: (ticket?: OwnerTicket) => void;
  compact?: boolean;
}

const STATUS_LABEL: Record<OwnerTicket['status'], string> = { open: 'Open', options_sent: 'Options sent', resolved: 'Resolved' };

/** Structured feedback tickets filed from the client portal — split out of
 *  the old merged Inbox widget so a business flagging something to fix
 *  reads as its own category, not buried under plain mail. Sits between
 *  Leads and Inbox in the sidebar. Owner-only. */
export default function TicketsWidget({ tickets, loading, onOpen, compact }: Props) {
  const preview = tickets.slice(0, 2);
  const size = compact ? 11 : 12;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8,
        padding: compact ? '10px 12px' : '12px 14px', borderRadius: compact ? 14 : 16,
        background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', flexShrink: 0,
        minHeight: compact ? 90 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onOpen()}>
        <Icon name="notepad" size={compact ? 15 : 17} color="var(--mm-dim)" />
        <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: 'var(--mm-text)' }}>Tickets</div>
        {tickets.length > 0 && (
          <span style={{
            marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', fontSize: 10.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tickets.length > 9 ? '9+' : tickets.length}
          </span>
        )}
      </div>

      {!loading && preview.length === 0 && (
        <div style={{ fontSize: size, color: 'var(--mm-faint)' }}>No open tickets</div>
      )}
      {preview.map((t) => (
        <div key={t.id} onClick={() => onOpen(t)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, cursor: 'pointer' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--mm-dim)', border: '1px solid var(--mm-line)', borderRadius: 6, padding: '1px 4px', flexShrink: 0 }}>
            {STATUS_LABEL[t.status]}
          </span>
          <span style={{ fontSize: size, fontWeight: 700, color: 'var(--mm-text)', flexShrink: 0, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.clientName}
          </span>
          <span style={{ fontSize: size, color: 'var(--mm-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {t.title}
          </span>
        </div>
      ))}
    </div>
  );
}
