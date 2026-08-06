import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useContacts } from '../../data/useContacts';
import { useEvents } from '../../data/useEvents';
import type { Contact, ContactSource } from '../../data/types';
import { formatDateLabel, formatTimeLabel } from '../../data/time';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};

const SOURCE_LABEL: Record<ContactSource, string> = { dialing: 'Dialing', scalez: 'Scalez', manual: 'Manual' };
const SOURCE_COLOR: Record<ContactSource, string> = { dialing: '#5B8DEF', scalez: '#4CAF7D', manual: '#8A8F98' };

function matches(c: Contact, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    c.name.toLowerCase().includes(s) ||
    (c.phone ?? '').includes(s) ||
    (c.email ?? '').toLowerCase().includes(s) ||
    (c.business_name ?? '').toLowerCase().includes(s) ||
    (c.status ?? '').toLowerCase().includes(s)
  );
}

export default function ContactsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { contacts, loading } = useContacts();
  const { events } = useEvents();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ContactSource | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = contacts.filter((c) => (sourceFilter === 'all' || c.source === sourceFilter) && matches(c, query));
  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const history = selected ? events.filter((e) => e.linked_contact_id === selected.id).sort((a, b) => b.event_date.localeCompare(a.event_date)) : [];

  if (selected) {
    return (
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: '#8A8F98', cursor: 'pointer', marginBottom: 18 }} onClick={() => setSelectedId(null)}>
          ← Back to contacts
        </div>
        <div style={homeHeadStyle}>{selected.name}</div>
        <div style={homeSubStyle}>
          {selected.business_name ? `${selected.business_name} · ` : ''}
          <span style={{ color: SOURCE_COLOR[selected.source] }}>{SOURCE_LABEL[selected.source]}</span>
          {selected.status ? ` · ${selected.status}` : ''}
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
          {selected.phone && <div style={{ fontSize: 13.5, color: '#C7CAD1' }}>📞 {selected.phone}</div>}
          {selected.email && <div style={{ fontSize: 13.5, color: '#C7CAD1' }}>✉️ {selected.email}</div>}
        </div>
        {selected.notes && <div style={{ fontSize: 13, color: '#8A8F98', marginTop: 10, maxWidth: 560 }}>{selected.notes}</div>}

        <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 28, marginBottom: 10 }}>Event history ({history.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
          {history.map((e) => (
            <div key={e.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{formatDateLabel(e.event_date)}</span>
                <span style={{ fontSize: 12, color: '#8A8F98' }}>{formatTimeLabel(e.start_time)}</span>
              </div>
              {e.status && <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 3 }}>{e.status}</div>}
              {e.notes && <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 4 }}>{e.notes}</div>}
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>No events tied to this contact yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={homeHeadStyle}>Contacts</div>
      <div style={homeSubStyle}>Everyone logged from Dialing and Scalez, in one place.</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', maxWidth: 640 }}>
        <input style={{ ...inputStyle, flex: '1 1 220px' }} placeholder="Search name, phone, email, business, status…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select style={inputStyle} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as ContactSource | 'all')}>
          <option value="all">All sources</option>
          <option value="dialing">Dialing</option>
          <option value="scalez">Scalez</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 2 }}>
                {[c.business_name, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: SOURCE_COLOR[c.source], border: `1px solid ${SOURCE_COLOR[c.source]}55`, borderRadius: 999, padding: '3px 10px' }}>
              {SOURCE_LABEL[c.source]}
            </span>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>
            {contacts.length === 0 ? 'No contacts yet — they show up automatically from Dialing and Scalez events.' : 'No matches.'}
          </div>
        )}
      </div>
    </div>
  );
}
