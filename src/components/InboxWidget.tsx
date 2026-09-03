import Icon from '../Icon';
import type { SupportInboxEntry } from '../data/useSupportInbox';

interface Props {
  entries: SupportInboxEntry[];
  loading: boolean;
  onOpen: () => void;
  /** Sidebar's rows are 13.5px / MobileMenuSheet's are 15px — match
   *  whichever shell is rendering this so it doesn't look like a
   *  transplant from the other one. */
  compact?: boolean;
}

function senderLabel(entry: SupportInboxEntry): string {
  const name = entry.from_email.split('@')[0];
  return name || entry.from_email;
}

/** The one thing both madebymarquez.com and mastermindsbymarq.com mail
 *  lands in — support-inbox.ts's webhook is already domain-agnostic (it
 *  just processes whatever Resend hands it), so pointing a second
 *  verified domain's inbound routing at the same webhook is all a second
 *  brand needs; nothing here cares which domain a message arrived on.
 *  Pinned above every nav category so client requests are the first
 *  thing visible, not something buried under Scaling. Owner-only, same
 *  as the Support Inbox screen itself. */
export default function InboxWidget({ entries, loading, onOpen, compact }: Props) {
  const unread = entries.filter((e) => e.status === 'new');
  const preview = entries.slice(0, 2);

  return (
    <div
      onClick={onOpen}
      style={{
        display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8, cursor: 'pointer',
        padding: compact ? '10px 12px' : '12px 14px', borderRadius: compact ? 14 : 16,
        background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <div style={{ fontSize: compact ? 11 : 12, color: 'var(--mm-faint)' }}>No messages</div>
      )}
      {preview.map((e) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 11 : 12, fontWeight: e.status === 'new' ? 700 : 500, color: e.status === 'new' ? 'var(--mm-text)' : 'var(--mm-faint)', flexShrink: 0, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {senderLabel(e)}
          </span>
          <span style={{ fontSize: compact ? 11 : 12, color: 'var(--mm-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {e.subject || '(no subject)'}
          </span>
        </div>
      ))}
    </div>
  );
}
