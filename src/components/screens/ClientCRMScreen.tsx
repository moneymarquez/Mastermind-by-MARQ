import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientCRM } from '../../data/useClientCRM';
import type { ClientStage } from '../../data/types';
import ClientDetailView from './ClientDetailView';
import { AuditQuestionsAdmin, PricingTemplateAdmin, ServiceCatalogAdmin } from './ClientCRMAdmin';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

export const STAGES: { key: ClientStage; label: string }[] = [
  { key: 'new_lead', label: 'New Lead' },
  { key: 'discovery_complete', label: 'Discovery Complete' },
  { key: 'analysis_sent', label: 'Analysis Sent' },
  { key: 'invoice_sent', label: 'Invoice Sent' },
  { key: 'active', label: 'Active (Paid)' },
  { key: 'retainer', label: 'Retainer' },
];

const STAGE_COLOR: Record<ClientStage, string> = {
  new_lead: '#8a8a8a',
  discovery_complete: '#6a8fc9',
  analysis_sent: '#C9A24B',
  invoice_sent: '#c98f4b',
  active: '#4a9a5a',
  retainer: '#4a9a8a',
};

export const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
export const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
export const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };
export const primaryBtn: CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
};
export const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
export const tabStyle = (active: boolean): CSSProperties => ({
  padding: '8px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600,
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
});

function StagePill({ stage }: { stage: ClientStage }) {
  const color = STAGE_COLOR[stage];
  return (
    <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color, border: `1px solid ${color}66`, background: `${color}1a`, borderRadius: 'var(--radius-pill)', padding: '3px 9px' }}>
      {STAGES.find((s) => s.key === stage)?.label ?? stage}
    </span>
  );
}

function nextPaymentDue(client: ReturnType<typeof useClientCRM>['clients'][number]): string {
  const pending = client.invoices.find((i) => i.status === 'sent' || i.status === 'overdue');
  if (pending) return `$${pending.amount.toLocaleString()} due${pending.due_date ? ` ${pending.due_date}` : ''}`;
  // Only a priced item counts as an upcoming payment — a TBD month has no
  // number to surface, and inventing one here would be the exact thing the
  // TBD state exists to avoid.
  const nextItem = client.pricingItems.find((p) => p.amount !== null);
  if (nextItem && client.invoices.length === 0) return `$${(nextItem.amount as number).toLocaleString()} not yet sent`;
  if (client.pricingItems.some((p) => p.amount === null)) return 'TBD';
  return '—';
}

export default function ClientCRMScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const crm = useClientCRM();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showQuestionAdmin, setShowQuestionAdmin] = useState(false);
  const [showTemplateAdmin, setShowTemplateAdmin] = useState(false);
  const [showCatalogAdmin, setShowCatalogAdmin] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [stageFilter, setStageFilter] = useState<ClientStage | 'all'>('all');

  if (crm.loading) return <div style={homeSubStyle}>Loading…</div>;

  if (showQuestionAdmin) {
    return <AuditQuestionsAdmin crm={crm} onClose={() => setShowQuestionAdmin(false)} homeHeadStyle={homeHeadStyle} homeSubStyle={homeSubStyle} />;
  }
  if (showTemplateAdmin) {
    return <PricingTemplateAdmin crm={crm} onClose={() => setShowTemplateAdmin(false)} homeHeadStyle={homeHeadStyle} homeSubStyle={homeSubStyle} />;
  }
  if (showCatalogAdmin) {
    return <ServiceCatalogAdmin crm={crm} onClose={() => setShowCatalogAdmin(false)} homeHeadStyle={homeHeadStyle} homeSubStyle={homeSubStyle} />;
  }

  const selected = crm.clients.find((c) => c.id === selectedId) ?? null;
  if (selected) {
    return <ClientDetailView client={selected} crm={crm} onBack={() => setSelectedId(null)} homeHeadStyle={homeHeadStyle} homeSubStyle={homeSubStyle} />;
  }

  const submitNewClient = async () => {
    if (!name.trim()) return;
    const c = await crm.createClient({ business_name: name.trim(), contact_email: email.trim() || null, contact_phone: phone.trim() || null });
    setName('');
    setEmail('');
    setPhone('');
    setShowNewClient(false);
    if (c) setSelectedId(c.id);
  };

  const visible = stageFilter === 'all' ? crm.clients : crm.clients.filter((c) => c.stage === stageFilter);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Client CRM</div>
          <div style={homeSubStyle}>Discovery → Analysis → Package/Pricing → Invoice → Payment → Active Client.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={ghostBtn} onClick={() => setShowCatalogAdmin(true)}>Service catalog</div>
          <div style={ghostBtn} onClick={() => setShowTemplateAdmin(true)}>Default pricing template</div>
          <div style={ghostBtn} onClick={() => setShowQuestionAdmin(true)}>Manage audit questions</div>
          <div style={primaryBtn} onClick={() => setShowNewClient((s) => !s)}>+ New lead</div>
        </div>
      </div>

      {showNewClient && (
        <div style={{ ...cardStyle, marginTop: 18, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input style={inputStyle} placeholder="Contact email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={inputStyle} placeholder="Contact phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={primaryBtn} onClick={submitNewClient}>Create</div>
            <div style={ghostBtn} onClick={() => setShowNewClient(false)}>Cancel</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={tabStyle(stageFilter === 'all')} onClick={() => setStageFilter('all')}>All ({crm.clients.length})</div>
        {STAGES.map((s) => (
          <div key={s.key} style={tabStyle(stageFilter === s.key)} onClick={() => setStageFilter(s.key)}>
            {s.label} ({crm.clients.filter((c) => c.stage === s.key).length})
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        {visible.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No clients in this stage yet.</div>}
        {visible.map((c) => (
          <div key={c.id} style={{ ...cardStyle, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setSelectedId(c.id)}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{c.business_name}</div>
                <StagePill stage={c.stage} />
                {c.source === 'public' && (
                  <span style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>via public audit</span>
                )}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 4 }}>
                {nextPaymentDue(c)} · {c.reveal_full_schedule ? 'Full schedule visible' : 'Current payment only'} · Last activity {new Date(c.last_activity_at).toLocaleDateString()}
              </div>
            </div>
            <span style={{ fontSize: 'var(--text-head)', color: 'var(--text-tertiary)', flexShrink: 0 }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}
