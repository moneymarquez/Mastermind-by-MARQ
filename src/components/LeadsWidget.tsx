import Icon from '../Icon';
import type { LeadItem } from '../data/useLeads';

interface Props {
  leads: LeadItem[];
  newCount: number;
  loading: boolean;
  /** Tapping a lead row transfers it into Client CRM (generating its
   *  analysis if it hasn't been already) and lands on that profile.
   *  Tapping the header just browses the full list. */
  onOpen: (lead?: LeadItem) => void;
  compact?: boolean;
}

/** The green button — every business that's filled out the public
 *  /audit questionnaire, whether or not it's been pulled into Client CRM
 *  yet. Sits above Tickets/Inbox in the sidebar since a fresh lead is the
 *  most time-sensitive thing waiting on the owner. Owner-only. */
export default function LeadsWidget({ leads, newCount, loading, onOpen, compact }: Props) {
  const preview = leads.slice(0, 2);
  const size = compact ? 11 : 12;
  const green = 'var(--success)';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8,
        padding: compact ? '10px 12px' : '12px 14px', borderRadius: compact ? 14 : 16,
        background: 'var(--mm-panel-solid)', border: `1px solid color-mix(in srgb, ${green} 35%, var(--mm-line))`, flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => onOpen()}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: green, flexShrink: 0, boxShadow: newCount > 0 ? `0 0 0 3px color-mix(in srgb, ${green} 25%, transparent)` : 'none' }} />
        <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: 'var(--mm-text)' }}>Leads</div>
        {newCount > 0 && (
          <span style={{
            marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: green, color: '#04140c', fontSize: 10.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </div>

      {!loading && preview.length === 0 && (
        <div style={{ fontSize: size, color: 'var(--mm-faint)' }}>No submissions yet</div>
      )}
      {preview.map((lead) => (
        <div key={lead.id} onClick={() => onOpen(lead)} style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, cursor: 'pointer' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', flexShrink: 0,
            color: lead.stage === 'new_lead' ? green : 'var(--mm-dim)',
            border: `1px solid ${lead.stage === 'new_lead' ? `${green}66` : 'var(--mm-line)'}`,
            borderRadius: 6, padding: '1px 4px',
          }}>
            {lead.stage === 'new_lead' ? 'New' : 'In CRM'}
          </span>
          <span style={{ fontSize: size, fontWeight: lead.stage === 'new_lead' ? 700 : 500, color: lead.stage === 'new_lead' ? 'var(--mm-text)' : 'var(--mm-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {lead.businessName}
          </span>
        </div>
      ))}

      {leads.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 2 }} onClick={() => onOpen()}>
          <Icon name="users" size={compact ? 12 : 13} color={green} />
          <span style={{ fontSize: compact ? 10.5 : 11, color: green, fontWeight: 600 }}>Browse all {leads.length}</span>
        </div>
      )}
    </div>
  );
}
