import type { CSSProperties } from 'react';
import type { Lead } from '../../types';
import Icon from '../../Icon';

interface FilteredLead extends Lead {
  valueDisplay: string;
  statusStyle: CSSProperties;
}

interface Props {
  isMobile: boolean;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  filterChips: string[];
  leadFilter: string;
  onFilter: (f: string) => void;
  filteredLeads: FilteredLead[];
  onSelectLead: (id: number) => void;
  onOpenAddModal: () => void;
}

const addBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
};

export default function CrmListScreen({
  isMobile, homeHeadStyle, homeSubStyle, filterChips, leadFilter, onFilter, filteredLeads, onSelectLead, onOpenAddModal,
}: Props) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Leads</div>
          <div style={homeSubStyle}>Pipeline across Solar, ABMARQ, LeadFlow, Website, Scaling</div>
        </div>
        <div style={addBtnStyle} onClick={onOpenAddModal}>
          <Icon name="plus" style={{ marginRight: 6 }} color="#F5F6F7" />
          Add Lead
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
        {filterChips.map((f) => (
          <div
            key={f}
            onClick={() => onFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
              border: `1px solid ${leadFilter === f ? '#F5F6F7' : '#22262B'}`,
              color: leadFilter === f ? '#0A0B0D' : '#8A8F98',
              background: leadFilter === f ? '#F5F6F7' : 'transparent', fontWeight: 500,
            }}
          >
            {f}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
        {filteredLeads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onSelectLead(lead.id)}
            style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1fr 1fr 1fr auto',
              alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #1c1e23',
              cursor: 'pointer', background: '#101114',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{lead.name}</div>
              <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 2 }}>{lead.company}</div>
            </div>
            <div style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: '1px solid #2b2f36', color: '#8A8F98', justifySelf: 'start', display: isMobile ? 'none' : 'inline-block' }}>
              {lead.source}
            </div>
            <div style={lead.statusStyle}>{lead.status}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F5F6F7', display: isMobile ? 'none' : 'block' }}>
              {lead.valueDisplay}
            </div>
            <Icon name="caret-right" size={14} color="#565b64" />
          </div>
        ))}
      </div>
    </div>
  );
}
