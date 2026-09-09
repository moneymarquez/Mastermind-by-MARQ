import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useLeads } from '../../data/useLeads';
import type { LeadItem } from '../../data/useLeads';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  /** Lands on that client's profile in Client CRM — Stage owns the actual
   *  navigation (setClientFocus + navigateTo), this screen just asks for it. */
  onOpenClient: (clientId: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'var(--surface-3)',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const greenBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--success)', color: '#04140c',
  fontSize: 'var(--text-body-sm)', fontWeight: 700, cursor: 'pointer',
};
const activeChip: CSSProperties = { background: 'var(--text)', color: 'var(--bg)', border: 'none' };

/** Every business that's ever filled out the public /audit questionnaire
 *  — "browse all the accounts in that green button section." A lead sits
 *  in stage 'new_lead' until "Transfer to Client CRM" is clicked, which
 *  generates its analysis and moves it forward — after that this list
 *  still shows it, just labeled "In CRM" instead of offering the
 *  transfer button again. */
export default function LeadsScreen({ homeHeadStyle, homeSubStyle, onOpenClient }: Props) {
  const { leads, loading, transferLead } = useLeads();
  const [filter, setFilter] = useState<'all' | 'new' | 'in_crm'>('all');
  const [transferringId, setTransferringId] = useState<string | null>(null);

  const filtered = leads.filter((l) => {
    if (filter === 'new') return l.stage === 'new_lead';
    if (filter === 'in_crm') return l.stage !== 'new_lead';
    return true;
  });

  const doTransfer = async (lead: LeadItem) => {
    setTransferringId(lead.id);
    try {
      await transferLead(lead);
      onOpenClient(lead.id);
    } finally {
      setTransferringId(null);
    }
  };

  return (
    <div>
      <div style={homeHeadStyle}>Leads</div>
      <div style={homeSubStyle}>
        Every submission to the public audit questionnaire. Transfer one into Client CRM to generate its analysis and
        start working the account — or view one that's already in the pipeline.
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={{ ...ghostBtn, ...(filter === 'all' ? activeChip : {}) }} onClick={() => setFilter('all')}>All ({leads.length})</div>
        <div style={{ ...ghostBtn, ...(filter === 'new' ? activeChip : {}) }} onClick={() => setFilter('new')}>
          New ({leads.filter((l) => l.stage === 'new_lead').length})
        </div>
        <div style={{ ...ghostBtn, ...(filter === 'in_crm' ? activeChip : {}) }} onClick={() => setFilter('in_crm')}>
          In CRM ({leads.filter((l) => l.stage !== 'new_lead').length})
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 680 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing here.</div>
        )}
        {filtered.map((lead) => (
          <div key={lead.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{lead.businessName}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>
                  {[lead.contactName, lead.contactEmail, lead.contactPhone].filter(Boolean).join(' · ') || 'No contact info given'}
                </div>
                <div style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Submitted {new Date(lead.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <span style={{
                fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
                color: lead.stage === 'new_lead' ? 'var(--success)' : 'var(--text-secondary)',
                border: `1px solid ${lead.stage === 'new_lead' ? 'var(--success)' : 'var(--border)'}66`,
                borderRadius: 'var(--radius-pill)', padding: '3px 9px', flexShrink: 0,
              }}>
                {lead.stage === 'new_lead' ? 'New' : 'In CRM'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {lead.stage === 'new_lead' ? (
                <div style={greenBtn} onClick={() => !transferringId && doTransfer(lead)}>
                  {transferringId === lead.id ? 'Transferring…' : 'Transfer to Client CRM →'}
                </div>
              ) : (
                <div style={ghostBtn} onClick={() => onOpenClient(lead.id)}>View in CRM →</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
