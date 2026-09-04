import Icon from '../Icon';
import type { InboxItem } from '../data/useOwnerInbox';

interface Props {
  items: InboxItem[];
  loading: boolean;
  /** Tapping a row hands that row over so the shell can land on the
   *  right place (a ticket → that client in Client Modules; mail → the
   *  Support Inbox). Tapping the header opens the inbox generally. */
  onOpen: (item?: InboxItem) => void;
  /** Sidebar's rows are 13.5px / MobileMenuSheet's are 15px — match
   *  whichever shell is rendering this so it doesn't look like a
   *  transplant from the other one. */
  compact?: boolean;
}

const KIND_TAG: Record<InboxItem['kind'], string> = { mail: 'Mail', message: 'Msg' };

/** Mail on either domain (madebymarquez.com / mastermindsbymarq.com, both
 *  through the same Resend webhook) plus a client's unread portal
 *  message. Tickets have their own widget now (TicketsWidget) so they
 *  don't crowd this one. Pinned above every nav category. Owner-only. */
export default function InboxWidget({ items, loading, onOpen, compact }: Props) {
  const unread = items.filter((e) => e.unread);
  const preview = items.slice(0, 2);
  const size = compact ? 11 : 12;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8,
        padding: compact ? '10px 12px' : '12px 14px', borderRadius: compact ? 14 : 16,
        background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', flexShrink: 0,
        // Same minHeight as LeadsWidget/TicketsWidget's compact mode — so
        // the three status cards read as one consistent row of equal-
        // height tiles regardless of which one happens to have less
        // content (an empty "No messages" card next to a 2-row Leads
        // preview otherwise looked visibly shorter).
        minHeight: compact ? 90 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onOpen()}>
        <Icon name="envelope-simple" size={compact ? 15 : 17} color="var(--mm-dim)" />
        <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: 'var(--mm-text)' }}>Inbox</div>
        {unread.length > 0 && (
          <span style={{
            marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', fontSize: 10.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </div>

      {!loading && preview.length === 0 && (
        <div style={{ fontSize: size, color: 'var(--mm-faint)' }}>No messages</div>
      )}
      {preview.map((e) => (
        <div key={e.id} onClick={() => onOpen(e)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, cursor: 'pointer' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--mm-dim)', border: '1px solid var(--mm-line)', borderRadius: 6, padding: '1px 4px', flexShrink: 0 }}>
            {e.kind === 'mail' && e.bucket ? `${e.bucket.domainShort} · ${e.bucket.local}` : KIND_TAG[e.kind]}
          </span>
          <span style={{ fontSize: size, fontWeight: e.unread ? 700 : 500, color: e.unread ? 'var(--mm-text)' : 'var(--mm-faint)', flexShrink: 0, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.from}
          </span>
          <span style={{ fontSize: size, color: 'var(--mm-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {e.title}
          </span>
        </div>
      ))}
    </div>
  );
}
