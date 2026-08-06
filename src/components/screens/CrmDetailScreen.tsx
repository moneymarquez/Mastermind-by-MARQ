import type { CSSProperties } from 'react';
import type { Lead } from '../../types';
import Icon from '../../Icon';

interface SelectedLead extends Lead {
  valueDisplay: string;
  statusStyle: CSSProperties;
}

interface Props {
  isMobile: boolean;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  selectedLead: SelectedLead;
  onBack: () => void;
  onEdit: () => void;
}

const detailRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1c1e23' };
const detailLabelStyle: CSSProperties = { fontSize: 12.5, color: '#8A8F98', fontWeight: 500 };
const detailMonoStyle: CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F5F6F7' };
const tagStyle: CSSProperties = { fontSize: 11.5, padding: '4px 10px', borderRadius: 999, border: '1px solid #2b2f36', color: '#8A8F98' };
const detailCardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20 };

export default function CrmDetailScreen({ isMobile, homeHeadStyle, homeSubStyle, selectedLead, onBack, onEdit }: Props) {
  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: '#8A8F98', cursor: 'pointer', marginBottom: 18 }} onClick={onBack}>
        <Icon name="arrow-left" style={{ marginRight: 8 }} color="#8A8F98" />
        Back to leads
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>{selectedLead.name}</div>
          <div style={homeSubStyle}>{selectedLead.company}</div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={onEdit}
        >
          <Icon name="pencil-simple" style={{ marginRight: 6 }} color="#F5F6F7" />
          Edit
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 24 }}>
        <div style={detailCardStyle}>
          <div style={detailRowStyle}><span style={detailLabelStyle}>Status</span><span style={selectedLead.statusStyle}>{selectedLead.status}</span></div>
          <div style={detailRowStyle}><span style={detailLabelStyle}>Source</span><span style={tagStyle}>{selectedLead.source}</span></div>
          <div style={detailRowStyle}><span style={detailLabelStyle}>Phone</span><span style={detailMonoStyle}>{selectedLead.phone}</span></div>
          <div style={detailRowStyle}><span style={detailLabelStyle}>Value</span><span style={detailMonoStyle}>{selectedLead.valueDisplay}</span></div>
        </div>
        <div style={detailCardStyle}>
          <div style={detailLabelStyle}>Activity</div>
          <div style={{ fontSize: 13, color: '#565b64', marginTop: 12 }}>No activity logged yet.</div>
        </div>
      </div>
    </div>
  );
}
