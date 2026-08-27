import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CalendarEvent, Contact, DialingDetails, EventType, ScalezDetails, StreamingDetails } from '../../data/types';
import { DIALING_STATUSES, LEAD_SOURCES, SCALEZ_STAGES } from '../../data/types';
import type { ContactInput } from '../../data/useContacts';
import type { EventInput } from '../../data/useEvents';
import { DAY_LABELS, dateStr, hoursBetween, minutesToTime, timeToMinutes, weekStartOf } from '../../data/time';
import { EVENT_TYPE_COLOR } from '../../data/eventDisplay';

interface Props {
  searchContacts: (q: string) => Contact[];
  upsertContact: (input: ContactInput) => Promise<Contact>;
  addEvent: (input: EventInput) => Promise<CalendarEvent>;
  addHolidayEvents: (dates: string[], start: string, end: string, notes: string | null) => Promise<void>;
  updateEvent: (id: string, patch: Partial<EventInput>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  initialType: EventType;
  initialDate: string;
  initialStart: string;
  initialEnd: string;
  editingEvent: CalendarEvent | null;
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const panelStyle: CSSProperties = {
  width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.5)', animation: 'bubbleFade 0.18s ease',
};
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none', width: '100%',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, display: 'block' };
const fieldWrap: CSSProperties = { marginBottom: 12 };
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 20px', borderRadius: 'var(--radius-pill)',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', cursor: 'pointer',
};
const dangerBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-pill)',
  border: '1px solid #3a2222', color: '#c47a7a', fontSize: 'var(--text-body)', cursor: 'pointer',
};

const TYPE_LABEL: Record<EventType, string> = { holiday: 'HOLIDAY', dialing: 'DIALING', scalez: 'SCALEZ', streaming: 'STREAMING' };

function ContactSearch({ searchContacts, onPick }: { searchContacts: (q: string) => Contact[]; onPick: (c: Contact) => void }) {
  const [q, setQ] = useState('');
  const results = q.trim().length > 0 ? searchContacts(q) : [];
  return (
    <div style={{ ...fieldWrap, position: 'relative' }}>
      <label style={labelStyle}>Search existing contacts (optional — autofills the fields below)</label>
      <input style={inputStyle} placeholder="Name, phone, or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', zIndex: 5 }}>
          {results.map((c) => (
            <div
              key={c.id}
              onClick={() => { onPick(c); setQ(''); }}
              style={{ padding: '9px 12px', fontSize: 'var(--text-body)', color: 'var(--text-quaternary)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
            >
              {c.name}{c.business_name ? ` — ${c.business_name}` : ''}{c.phone ? ` · ${c.phone}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventAdderModal({
  searchContacts, upsertContact, addEvent, addHolidayEvents, updateEvent, deleteEvent,
  initialType, initialDate, initialStart, initialEnd, editingEvent, onClose,
}: Props) {
  const isEditing = !!editingEvent;
  const [type, setType] = useState<EventType>(editingEvent?.type ?? initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── HOLIDAY ──────────────────────────────────────────────────────────
  const initialWeekday = new Date(`${initialDate}T00:00:00`).getDay();
  const [holidayDays, setHolidayDays] = useState<Set<number>>(new Set(editingEvent ? [] : [initialWeekday]));
  const [holidayStart, setHolidayStart] = useState(editingEvent?.start_time.slice(0, 5) ?? initialStart);
  const [holidayEnd, setHolidayEnd] = useState(editingEvent?.end_time.slice(0, 5) ?? initialEnd);
  const [holidayNote, setHolidayNote] = useState(editingEvent?.notes ?? '');

  // ── DIALING ──────────────────────────────────────────────────────────
  const dialingDetails = (editingEvent?.type === 'dialing' ? editingEvent.details : {}) as Partial<DialingDetails>;
  const [dFirstName, setDFirstName] = useState(dialingDetails.first_name ?? '');
  const [dLastName, setDLastName] = useState(dialingDetails.last_name ?? '');
  const [dPhone, setDPhone] = useState(dialingDetails.phone ?? '');
  const [dEmail, setDEmail] = useState(dialingDetails.email ?? '');
  const [dBusiness, setDBusiness] = useState(dialingDetails.business_name ?? '');
  const [dSource, setDSource] = useState(dialingDetails.lead_source ?? LEAD_SOURCES[0]);
  const [dDate, setDDate] = useState(editingEvent?.event_date ?? initialDate);
  const [dTime, setDTime] = useState(editingEvent?.start_time.slice(0, 5) ?? initialStart);
  const [dStatus, setDStatus] = useState(editingEvent?.status ?? DIALING_STATUSES[0]);
  const [dNotes, setDNotes] = useState(editingEvent?.notes ?? '');
  const [dFollowUp, setDFollowUp] = useState(dialingDetails.follow_up_date ?? '');

  // ── SCALEZ ───────────────────────────────────────────────────────────
  const scalezDetails = (editingEvent?.type === 'scalez' ? editingEvent.details : {}) as Partial<ScalezDetails>;
  const [sBusiness, setSBusiness] = useState(scalezDetails.business_name ?? '');
  const [sContact, setSContact] = useState(scalezDetails.contact_name ?? '');
  const [sPhone, setSPhone] = useState(scalezDetails.phone ?? '');
  const [sEmail, setSEmail] = useState(scalezDetails.email ?? '');
  const [sPain, setSPain] = useState(scalezDetails.pain_points ?? '');
  const [sBudget, setSBudget] = useState(scalezDetails.budget_range ?? '');
  const [sDate, setSDate] = useState(editingEvent?.event_date ?? initialDate);
  const [sTime, setSTime] = useState(editingEvent?.start_time.slice(0, 5) ?? initialStart);
  const [sStage, setSStage] = useState(editingEvent?.status ?? SCALEZ_STAGES[0]);
  const [sNotes, setSNotes] = useState(editingEvent?.notes ?? '');

  // ── STREAMING ────────────────────────────────────────────────────────
  const streamingDetails = (editingEvent?.type === 'streaming' ? editingEvent.details : {}) as Partial<StreamingDetails>;
  const [stTitle, setStTitle] = useState(streamingDetails.title ?? '');
  const [stDate, setStDate] = useState(editingEvent?.event_date ?? initialDate);
  const [stStart, setStStart] = useState(editingEvent?.start_time.slice(0, 5) ?? initialStart);
  const [stEnd, setStEnd] = useState(editingEvent?.end_time.slice(0, 5) ?? initialEnd);
  const [stNotes, setStNotes] = useState(editingEvent?.notes ?? '');

  const toggleDay = (idx: number) => {
    setHolidayDays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const saveHoliday = async () => {
    if (holidayDays.size === 0) { setError('Pick at least one day.'); return; }
    const start = weekStartOf(initialDate);
    const dates = [...holidayDays].sort().map((idx) => {
      const d = new Date(start);
      d.setDate(d.getDate() + idx);
      return dateStr(d);
    });
    if (isEditing && editingEvent) {
      await updateEvent(editingEvent.id, { start_time: holidayStart, end_time: holidayEnd, notes: holidayNote.trim() || null });
    } else {
      await addHolidayEvents(dates, holidayStart, holidayEnd, holidayNote.trim() || null);
    }
  };

  const saveDialing = async () => {
    if (!dFirstName.trim() && !dLastName.trim()) { setError('Lead name is required.'); return; }
    const name = `${dFirstName.trim()} ${dLastName.trim()}`.trim();
    const contact = await upsertContact({
      name, phone: dPhone.trim() || null, email: dEmail.trim() || null,
      business_name: dBusiness.trim() || null, source: 'dialing', status: dStatus, notes: null,
    });
    const endTime = minutesToTime(appointmentEndMinutes(dTime));
    const input: EventInput = {
      type: 'dialing', event_date: dDate, start_time: dTime, end_time: endTime,
      notes: dNotes.trim() || null, status: dStatus, linked_contact_id: contact.id,
      details: {
        first_name: dFirstName.trim(), last_name: dLastName.trim(), phone: dPhone.trim(),
        email: dEmail.trim(), business_name: dBusiness.trim(), lead_source: dSource,
        follow_up_date: dFollowUp || null,
      },
    };
    if (isEditing && editingEvent) await updateEvent(editingEvent.id, input);
    else await addEvent(input);
  };

  const saveScalez = async () => {
    if (!sContact.trim() && !sBusiness.trim()) { setError('Client or business name is required.'); return; }
    const contact = await upsertContact({
      name: sContact.trim() || sBusiness.trim(), phone: sPhone.trim() || null, email: sEmail.trim() || null,
      business_name: sBusiness.trim() || null, source: 'scalez', status: sStage, notes: null,
    });
    const endTime = minutesToTime(appointmentEndMinutes(sTime));
    const input: EventInput = {
      type: 'scalez', event_date: sDate, start_time: sTime, end_time: endTime,
      notes: sNotes.trim() || null, status: sStage, linked_contact_id: contact.id,
      details: { business_name: sBusiness.trim(), contact_name: sContact.trim(), phone: sPhone.trim(), email: sEmail.trim(), pain_points: sPain.trim(), budget_range: sBudget.trim() },
    };
    if (isEditing && editingEvent) await updateEvent(editingEvent.id, input);
    else await addEvent(input);
  };

  const saveStreaming = async () => {
    if (!stTitle.trim()) { setError('A title is required.'); return; }
    const input: EventInput = {
      type: 'streaming', event_date: stDate, start_time: stStart, end_time: stEnd,
      notes: stNotes.trim() || null, status: null, linked_contact_id: null,
      details: { title: stTitle.trim() },
    };
    if (isEditing && editingEvent) await updateEvent(editingEvent.id, input);
    else await addEvent(input);
  };

  // DIALING/SCALEZ appointments default to a 30-min block unless the drag
  // selection on the day view set a longer one.
  function appointmentEndMinutes(start: string): number {
    const startMins = timeToMinutes(start);
    const draggedEnd = timeToMinutes(initialEnd);
    return draggedEnd > startMins + 5 ? draggedEnd : startMins + 30;
  }

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (type === 'holiday') await saveHoliday();
      else if (type === 'dialing') await saveDialing();
      else if (type === 'scalez') await saveScalez();
      else await saveStreaming();
      onClose();
    } catch {
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await deleteEvent(editingEvent.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-3)' }}>
          {(['holiday', 'dialing', 'scalez', 'streaming'] as EventType[]).map((t) => (
            <div
              key={t}
              onClick={() => !isEditing && setType(t)}
              style={{
                flex: 1, textAlign: 'center', padding: '16px 8px', fontSize: 'var(--text-body-sm)', fontWeight: 700, letterSpacing: '0.06em',
                cursor: isEditing ? 'default' : 'pointer', color: type === t ? EVENT_TYPE_COLOR[t] : 'var(--text-tertiary)',
                borderBottom: `2px solid ${type === t ? EVENT_TYPE_COLOR[t] : 'transparent'}`,
                opacity: isEditing && type !== t ? 0.35 : 1,
              }}
            >
              {TYPE_LABEL[t]}
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>
          {type === 'holiday' && (
            <div>
              {isEditing ? (
                <div style={fieldWrap}>
                  <label style={labelStyle}>Date</label>
                  <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text)' }}>{new Date(`${initialDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                </div>
              ) : (
                <>
                  <label style={labelStyle}>Days worked</label>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {DAY_LABELS.map((label, idx) => (
                      <div
                        key={label}
                        onClick={() => toggleDay(idx)}
                        style={{
                          flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600,
                          border: `1px solid ${holidayDays.has(idx) ? 'var(--text)' : 'var(--border)'}`,
                          background: holidayDays.has(idx) ? 'var(--text)' : 'transparent',
                          color: holidayDays.has(idx) ? 'var(--bg)' : 'var(--text-quaternary)',
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14 }}>
                    Applies to the week of {weekStartOf(initialDate).toLocaleDateString()} — one shift per day checked above.
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Start time</label>
                  <input type="time" style={inputStyle} value={holidayStart} onChange={(e) => setHolidayStart(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>End time</label>
                  <input type="time" style={inputStyle} value={holidayEnd} onChange={(e) => setHolidayEnd(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 14 }}>
                {isEditing
                  ? `${hoursBetween(holidayStart, holidayEnd).toFixed(1)} hours`
                  : `${hoursBetween(holidayStart, holidayEnd).toFixed(1)} hours/day × ${holidayDays.size || 1} day${holidayDays.size === 1 ? '' : 's'}`}
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Note (optional)</label>
                <input style={inputStyle} placeholder="e.g. covering for Jake" value={holidayNote} onChange={(e) => setHolidayNote(e.target.value)} />
              </div>
            </div>
          )}

          {type === 'dialing' && (
            <div>
              {!isEditing && <ContactSearch searchContacts={searchContacts} onPick={(c) => {
                const [f, ...rest] = c.name.split(' ');
                setDFirstName(f ?? ''); setDLastName(rest.join(' '));
                setDPhone(c.phone ?? ''); setDEmail(c.email ?? ''); setDBusiness(c.business_name ?? '');
              }} />}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>First name</label>
                  <input style={inputStyle} value={dFirstName} onChange={(e) => setDFirstName(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Last name</label>
                  <input style={inputStyle} value={dLastName} onChange={(e) => setDLastName(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={dEmail} onChange={(e) => setDEmail(e.target.value)} />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Business name (if applicable)</label>
                <input style={inputStyle} value={dBusiness} onChange={(e) => setDBusiness(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Lead source</label>
                  <select style={inputStyle} value={dSource} onChange={(e) => setDSource(e.target.value as typeof dSource)}>
                    {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={dStatus} onChange={(e) => setDStatus(e.target.value as typeof dStatus)}>
                    {DIALING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Appointment date</label>
                  <input type="date" style={inputStyle} value={dDate} onChange={(e) => setDDate(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Appointment time</label>
                  <input type="time" style={inputStyle} value={dTime} onChange={(e) => setDTime(e.target.value)} />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Follow-up date (optional)</label>
                <input type="date" style={inputStyle} value={dFollowUp} onChange={(e) => setDFollowUp(e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={dNotes} onChange={(e) => setDNotes(e.target.value)} />
              </div>
            </div>
          )}

          {type === 'scalez' && (
            <div>
              {!isEditing && <ContactSearch searchContacts={searchContacts} onPick={(c) => {
                setSContact(c.name); setSPhone(c.phone ?? ''); setSEmail(c.email ?? ''); setSBusiness(c.business_name ?? '');
              }} />}
              <div style={fieldWrap}>
                <label style={labelStyle}>Client / business name</label>
                <input style={inputStyle} value={sBusiness} onChange={(e) => setSBusiness(e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Contact name</label>
                <input style={inputStyle} value={sContact} onChange={(e) => setSContact(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={sEmail} onChange={(e) => setSEmail(e.target.value)} />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Current situation / pain points</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={sPain} onChange={(e) => setSPain(e.target.value)} />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Budget range</label>
                <input style={inputStyle} placeholder="e.g. $2k-5k/mo" value={sBudget} onChange={(e) => setSBudget(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Appointment date</label>
                  <input type="date" style={inputStyle} value={sDate} onChange={(e) => setSDate(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Appointment time</label>
                  <input type="time" style={inputStyle} value={sTime} onChange={(e) => setSTime(e.target.value)} />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Deal stage</label>
                <select style={inputStyle} value={sStage} onChange={(e) => setSStage(e.target.value as typeof sStage)}>
                  {SCALEZ_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={sNotes} onChange={(e) => setSNotes(e.target.value)} />
              </div>
            </div>
          )}

          {type === 'streaming' && (
            <div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Title</label>
                <input style={inputStyle} placeholder="e.g. Late Night Horror Run" value={stTitle} onChange={(e) => setStTitle(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={stDate} onChange={(e) => setStDate(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>Start time</label>
                  <input type="time" style={inputStyle} value={stStart} onChange={(e) => setStStart(e.target.value)} />
                </div>
                <div style={{ ...fieldWrap, flex: 1 }}>
                  <label style={labelStyle}>End time</label>
                  <input type="time" style={inputStyle} value={stEnd} onChange={(e) => setStEnd(e.target.value)} />
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={stNotes} onChange={(e) => setStNotes(e.target.value)} />
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 'var(--text-body-sm)', color: '#c47a7a', marginBottom: 10 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
            <div style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }} onClick={save}>
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add event'}
            </div>
            <div style={ghostBtn} onClick={onClose}>Cancel</div>
            {isEditing && <div style={{ ...dangerBtn, marginLeft: 'auto' }} onClick={remove}>Delete</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
