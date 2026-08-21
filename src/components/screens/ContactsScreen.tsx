import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useContacts } from '../../data/useContacts';
import { useEvents } from '../../data/useEvents';
import type { Contact, ContactSource, DialingContactDetails, ScalingContactDetails } from '../../data/types';
import { CREDIT_SCORE_RANGES } from '../../data/types';
import { formatDateLabel, formatTimeLabel } from '../../data/time';
import ContactFormModal from './ContactFormModal';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px',
  color: 'var(--text)', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '11px 20px', borderRadius: 999,
  background: 'var(--text)', color: 'var(--bg)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const SOURCE_LABEL: Record<ContactSource, string> = { dialing: 'Dialing', scalez: 'Scaling', manual: 'Manual' };
const SOURCE_COLOR: Record<ContactSource, string> = { dialing: '#5B8DEF', scalez: '#4CAF7D', manual: 'var(--text-secondary)' };

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

function fieldRowStyle(): CSSProperties {
  return { marginBottom: 14 };
}
const detailLabelStyle: CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 5, display: 'block' };

function EditableText({ label, value, onSave, textarea, type = 'text' }: {
  label: string; value: string; onSave: (v: string) => void; textarea?: boolean; type?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div style={fieldRowStyle()}>
      <label style={detailLabelStyle}>{label}</label>
      {textarea ? (
        <textarea
          style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onSave(draft)}
        />
      ) : (
        <input
          type={type}
          style={{ ...inputStyle, width: '100%' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== value && onSave(draft)}
        />
      )}
    </div>
  );
}

function EditableSelect({ label, value, options, onSave }: {
  label: string; value: string; options: { value: string; label: string }[]; onSave: (v: string) => void;
}) {
  return (
    <div style={fieldRowStyle()}>
      <label style={detailLabelStyle}>{label}</label>
      <select style={{ ...inputStyle, width: '100%' }} value={value} onChange={(e) => onSave(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const YES_NO_UNSURE = [...YES_NO, { value: 'unsure', label: 'Unsure' }];

export default function ContactsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { contacts, loading, upsertContact, updateContact } = useContacts();
  const { events } = useEvents();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ContactSource | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = contacts.filter((c) => (sourceFilter === 'all' || c.source === sourceFilter) && matches(c, query));
  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const history = selected ? events.filter((e) => e.linked_contact_id === selected.id).sort((a, b) => b.event_date.localeCompare(a.event_date)) : [];

  const saveDetail = (patch: Record<string, unknown>) => {
    if (!selected) return;
    updateContact(selected.id, patch);
  };
  const saveDetailsField = (key: string, value: unknown) => {
    if (!selected) return;
    updateContact(selected.id, { details: { ...selected.details, [key]: value } });
  };

  if (selected) {
    const d = selected.details as Partial<DialingContactDetails> & Partial<ScalingContactDetails>;
    return (
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 18 }} onClick={() => setSelectedId(null)}>
          ← Back to contacts
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={homeHeadStyle}>{selected.name}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: SOURCE_COLOR[selected.source], border: `1px solid ${SOURCE_COLOR[selected.source]}55`, borderRadius: 999, padding: '3px 10px' }}>
            {SOURCE_LABEL[selected.source]}
          </span>
        </div>
        <div style={homeSubStyle}>Fields save automatically as you edit.</div>

        <div style={{ marginTop: 24, maxWidth: 480 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 12 }}>Contact</div>
          <EditableText label="Name" value={selected.name} onSave={(v) => saveDetail({ name: v })} />
          <EditableText label="Phone" value={selected.phone ?? ''} onSave={(v) => saveDetail({ phone: v || null })} />
          <EditableText label="Email" value={selected.email ?? ''} onSave={(v) => saveDetail({ email: v || null })} />
          {selected.source === 'scalez' && (
            <EditableText label="Business name" value={selected.business_name ?? ''} onSave={(v) => saveDetail({ business_name: v || null })} />
          )}

          {selected.source === 'dialing' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '22px 0 12px' }}>Dialing details</div>
              <EditableText label="Appointment date/time" type="datetime-local" value={d.appointment_at ?? ''} onSave={(v) => saveDetailsField('appointment_at', v || null)} />
              <EditableText label="Address" value={d.address ?? ''} onSave={(v) => saveDetailsField('address', v)} />
              <EditableSelect label="Homeowner?" value={d.homeowner ?? ''} options={YES_NO} onSave={(v) => saveDetailsField('homeowner', v || null)} />
              <EditableText label="Current electric utility provider" value={d.electric_utility ?? ''} onSave={(v) => saveDetailsField('electric_utility', v)} />
              <EditableText label="Average monthly electric bill ($)" value={d.avg_monthly_bill != null ? String(d.avg_monthly_bill) : ''} onSave={(v) => saveDetailsField('avg_monthly_bill', v ? Number(v) : null)} />
              <EditableSelect label="Approximate credit score" value={d.credit_score_range ?? ''} options={CREDIT_SCORE_RANGES.map((r) => ({ value: r, label: r }))} onSave={(v) => saveDetailsField('credit_score_range', v || null)} />
              <EditableText label="Roof type/age" value={d.roof_type_age ?? ''} onSave={(v) => saveDetailsField('roof_type_age', v)} />
              <EditableSelect label="Shading issues" value={d.shading_issues ?? ''} options={YES_NO_UNSURE} onSave={(v) => saveDetailsField('shading_issues', v || null)} />
              <EditableSelect label="HOA?" value={d.hoa ?? ''} options={YES_NO} onSave={(v) => saveDetailsField('hoa', v || null)} />
            </>
          )}

          {selected.source === 'scalez' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '22px 0 12px' }}>Scaling details</div>
              <EditableText label="Appointment date/time" type="datetime-local" value={d.appointment_at ?? ''} onSave={(v) => saveDetailsField('appointment_at', v || null)} />
              <EditableText label="Industry/niche" value={d.industry ?? ''} onSave={(v) => saveDetailsField('industry', v)} />
              <EditableSelect label="Currently has website?" value={d.has_website ?? ''} options={YES_NO} onSave={(v) => saveDetailsField('has_website', v || null)} />
              <EditableText label="Current marketing spend ($/month)" value={d.marketing_spend != null ? String(d.marketing_spend) : ''} onSave={(v) => saveDetailsField('marketing_spend', v ? Number(v) : null)} />
              <EditableSelect label="Decision maker confirmed?" value={d.decision_maker_confirmed ?? ''} options={YES_NO} onSave={(v) => saveDetailsField('decision_maker_confirmed', v || null)} />
              <EditableText label="Pain points" textarea value={d.pain_points ?? ''} onSave={(v) => saveDetailsField('pain_points', v)} />
            </>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '22px 0 12px' }}>Notes</div>
          <EditableText label="Notes" textarea value={selected.notes ?? ''} onSave={(v) => saveDetail({ notes: v || null })} />
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 28, marginBottom: 10 }}>Event history ({history.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
          {history.map((e) => (
            <div key={e.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{formatDateLabel(e.event_date)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTimeLabel(e.start_time)}</span>
              </div>
              {e.status && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{e.status}</div>}
              {e.notes && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>{e.notes}</div>}
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No events tied to this contact yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Contacts</div>
          <div style={homeSubStyle}>Everyone logged from Dialing and Scaling, in one place.</div>
        </div>
        <div style={primaryBtn} onClick={() => setShowAdd(true)}>+ Add Contact</div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', maxWidth: 640 }}>
        <input style={{ ...inputStyle, flex: '1 1 220px' }} placeholder="Search name, phone, email, business, status…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select style={inputStyle} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as ContactSource | 'all')}>
          <option value="all">All types</option>
          <option value="dialing">Dialing</option>
          <option value="scalez">Scaling</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {[c.business_name, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: SOURCE_COLOR[c.source], border: `1px solid ${SOURCE_COLOR[c.source]}55`, borderRadius: 999, padding: '3px 10px' }}>
              {SOURCE_LABEL[c.source]}
            </span>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>
            {contacts.length === 0 ? 'No contacts yet — add one, or they show up automatically from Dialing/Scaling activity.' : 'No matches.'}
          </div>
        )}
      </div>

      {showAdd && <ContactFormModal onSave={upsertContact} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
