import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContactSource, CreditScoreRange, YesNo, YesNoUnsure } from '../../data/types';
import { CREDIT_SCORE_RANGES } from '../../data/types';
import type { ContactInput } from '../../data/useContacts';

interface Props {
  onSave: (input: ContactInput) => Promise<unknown>;
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const panelStyle: CSSProperties = {
  width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto',
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16,
  boxShadow: '0 30px 80px rgba(0,0,0,0.5)', animation: 'bubbleFade 0.18s ease', padding: '24px 26px',
};
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px',
  color: 'var(--text)', fontSize: 13.5, outline: 'none', width: '100%',
};
const labelStyle: CSSProperties = { fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' };
const fieldWrap: CSSProperties = { marginBottom: 12 };
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 999,
  background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
};

function YesNoSelect({ label, value, onChange, includeUnsure }: { label: string; value: string; onChange: (v: string) => void; includeUnsure?: boolean }) {
  return (
    <div style={fieldWrap}>
      <label style={labelStyle}>{label}</label>
      <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
        {includeUnsure && <option value="unsure">Unsure</option>}
      </select>
    </div>
  );
}

export default function ContactFormModal({ onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<ContactSource>('dialing');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dialing fields
  const [appointmentAt, setAppointmentAt] = useState('');
  const [address, setAddress] = useState('');
  const [homeowner, setHomeowner] = useState<YesNo | ''>('');
  const [electricUtility, setElectricUtility] = useState('');
  const [avgMonthlyBill, setAvgMonthlyBill] = useState('');
  const [creditScoreRange, setCreditScoreRange] = useState<CreditScoreRange | ''>('');
  const [roofTypeAge, setRoofTypeAge] = useState('');
  const [shadingIssues, setShadingIssues] = useState<YesNoUnsure | ''>('');
  const [hoa, setHoa] = useState<YesNo | ''>('');

  // Scaling fields
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [hasWebsite, setHasWebsite] = useState<YesNo | ''>('');
  const [marketingSpend, setMarketingSpend] = useState('');
  const [decisionMaker, setDecisionMaker] = useState<YesNo | ''>('');
  const [painPoints, setPainPoints] = useState('');

  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (type === 'dialing') {
        await onSave({
          name, phone, email: null, business_name: null, source: 'dialing', status: null, notes,
          details: {
            appointment_at: appointmentAt || null,
            address,
            homeowner: homeowner || null,
            electric_utility: electricUtility,
            avg_monthly_bill: avgMonthlyBill ? Number(avgMonthlyBill) : null,
            credit_score_range: creditScoreRange || null,
            roof_type_age: roofTypeAge,
            shading_issues: shadingIssues || null,
            hoa: hoa || null,
          },
        });
      } else {
        await onSave({
          name, phone, email: null, business_name: businessName, source: 'scalez', status: null, notes,
          details: {
            appointment_at: appointmentAt || null,
            industry,
            has_website: hasWebsite || null,
            marketing_spend: marketingSpend ? Number(marketingSpend) : null,
            decision_maker_confirmed: decisionMaker || null,
            pain_points: painPoints,
          },
        });
      }
      onClose();
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 18 }}>Add Contact</div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>Phone number</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>Contact type</label>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value as ContactSource)}>
            <option value="dialing">Dialing</option>
            <option value="scalez">Scaling</option>
          </select>
        </div>

        {type === 'dialing' && (
          <>
            <div style={fieldWrap}>
              <label style={labelStyle}>Appointment date/time</label>
              <input type="datetime-local" style={inputStyle} value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Address</label>
              <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <YesNoSelect label="Homeowner?" value={homeowner} onChange={(v) => setHomeowner(v as YesNo | '')} />
            <div style={fieldWrap}>
              <label style={labelStyle}>Current electric utility provider</label>
              <input style={inputStyle} value={electricUtility} onChange={(e) => setElectricUtility(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Average monthly electric bill ($)</label>
              <input style={inputStyle} value={avgMonthlyBill} onChange={(e) => setAvgMonthlyBill(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Approximate credit score</label>
              <select style={inputStyle} value={creditScoreRange} onChange={(e) => setCreditScoreRange(e.target.value as CreditScoreRange | '')}>
                <option value="">—</option>
                {CREDIT_SCORE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Roof type/age (optional)</label>
              <input style={inputStyle} value={roofTypeAge} onChange={(e) => setRoofTypeAge(e.target.value)} />
            </div>
            <YesNoSelect label="Shading issues" value={shadingIssues} onChange={(v) => setShadingIssues(v as YesNoUnsure | '')} includeUnsure />
            <YesNoSelect label="HOA?" value={hoa} onChange={(v) => setHoa(v as YesNo | '')} />
          </>
        )}

        {type === 'scalez' && (
          <>
            <div style={fieldWrap}>
              <label style={labelStyle}>Business name</label>
              <input style={inputStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Appointment date/time</label>
              <input type="datetime-local" style={inputStyle} value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Industry/niche</label>
              <input style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <YesNoSelect label="Currently has website?" value={hasWebsite} onChange={(v) => setHasWebsite(v as YesNo | '')} />
            <div style={fieldWrap}>
              <label style={labelStyle}>Current marketing spend ($/month, optional)</label>
              <input style={inputStyle} value={marketingSpend} onChange={(e) => setMarketingSpend(e.target.value)} />
            </div>
            <YesNoSelect label="Decision maker confirmed?" value={decisionMaker} onChange={(v) => setDecisionMaker(v as YesNo | '')} />
            <div style={fieldWrap}>
              <label style={labelStyle}>Pain points</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={painPoints} onChange={(e) => setPainPoints(e.target.value)} />
            </div>
          </>
        )}

        <div style={fieldWrap}>
          <label style={labelStyle}>Notes</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <div style={{ fontSize: 12.5, color: '#c47a7a', marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }} onClick={save}>
            {saving ? 'Saving…' : 'Add contact'}
          </div>
          <div style={ghostBtn} onClick={onClose}>Cancel</div>
        </div>
      </div>
    </div>
  );
}
