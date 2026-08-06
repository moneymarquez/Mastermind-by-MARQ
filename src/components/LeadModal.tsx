import { SOURCE_OPTIONS, STATUS_OPTIONS } from '../data';
import type { EditingLead } from '../types';

interface Props {
  editingLead: EditingLead;
  onClose: () => void;
  onStopProp: (e: React.SyntheticEvent) => void;
  onField: (field: keyof EditingLead, val: string) => void;
  onSave: () => void;
}

const formInputStyle: React.CSSProperties = {
  width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
  padding: '9px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const formLabelStyle: React.CSSProperties = { fontSize: 11.5, color: '#8A8F98', display: 'block', marginBottom: 6 };
const formFieldStyle: React.CSSProperties = { marginBottom: 14 };

export default function LeadModal({ editingLead, onClose, onStopProp, onField, onSave }: Props) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ width: 380, maxWidth: '90vw', background: '#101114', border: '1px solid #22262B', borderRadius: 16, padding: 24, maxHeight: '86vh', overflowY: 'auto' }}
        onClick={onStopProp}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: '#F5F6F7', marginBottom: 16 }}>
          {editingLead.id ? 'Edit lead' : 'Add lead'}
        </div>

        <div style={formFieldStyle}>
          <label style={formLabelStyle}>Name</label>
          <input style={formInputStyle} value={editingLead.name} onChange={(e) => onField('name', e.target.value)} />
        </div>
        <div style={formFieldStyle}>
          <label style={formLabelStyle}>Company</label>
          <input style={formInputStyle} value={editingLead.company} onChange={(e) => onField('company', e.target.value)} />
        </div>
        <div style={formFieldStyle}>
          <label style={formLabelStyle}>Phone</label>
          <input style={formInputStyle} value={editingLead.phone} onChange={(e) => onField('phone', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Status</label>
            <select style={formInputStyle} value={editingLead.status} onChange={(e) => onField('status', e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div style={formFieldStyle}>
            <label style={formLabelStyle}>Source</label>
            <select style={formInputStyle} value={editingLead.source} onChange={(e) => onField('source', e.target.value)}>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={formFieldStyle}>
          <label style={formLabelStyle}>Value ($)</label>
          <input style={formInputStyle} value={editingLead.value} onChange={(e) => onField('value', e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <div style={{ padding: '9px 16px', borderRadius: 999, color: '#8A8F98', fontSize: 13, cursor: 'pointer' }} onClick={onClose}>
            Cancel
          </div>
          <div style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={onSave}>
            Save
          </div>
        </div>
      </div>
    </div>
  );
}
