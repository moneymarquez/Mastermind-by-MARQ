import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useHolidayShifts } from '../../data/useHolidayShifts';
import { parseSchedulePhoto } from '../../lib/scheduleParsing';
import type { ParsedShift } from '../../lib/scheduleParsing';
import { AiError } from '../../lib/ai';
import { fileToBase64 } from '../../lib/image';
import { dateStr, formatTimeLabel } from '../../data/time';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthGrid(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

// Deterministic color per person so the same coworker reads consistently
// across the calendar without maintaining a manual color map.
function colorForName(name: string): string {
  const palette = ['#5B8DEF', '#4CAF7D', '#e0a35c', '#c47ad1', '#5cc0e0', '#e05c7a', '#a3c95c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13, outline: 'none',
};

export default function HolidayCalendarView() {
  const { shifts, loading, addShift, addShifts, removeShift } = useHolidayShifts();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [reviewShifts, setReviewShifts] = useState<ParsedShift[] | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [manualName, setManualName] = useState('');
  const [manualDate, setManualDate] = useState(() => dateStr(new Date()));
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('17:00');

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParsing(true);
    setParseError('');
    try {
      const image = await fileToBase64(file);
      const parsed = await parseSchedulePhoto(image, monthAnchor.getFullYear());
      if (parsed.length === 0) setParseError('Could not find any shifts in that photo — try a clearer image, or add shifts manually below.');
      setReviewShifts(parsed);
    } catch (err) {
      setParseError(err instanceof AiError ? err.message : 'Could not read that schedule photo — try again.');
    } finally {
      setParsing(false);
    }
  };

  const updateReviewShift = (i: number, patch: Partial<ParsedShift>) => {
    setReviewShifts((prev) => prev && prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const removeReviewShift = (i: number) => {
    setReviewShifts((prev) => prev && prev.filter((_, idx) => idx !== i));
  };
  const confirmReview = async () => {
    if (!reviewShifts || reviewShifts.length === 0) return;
    await addShifts(reviewShifts.map((s) => ({ ...s, is_self: false })));
    setReviewShifts(null);
  };

  const submitManual = async () => {
    if (!manualName.trim()) return;
    await addShift({ person_name: manualName.trim(), shift_date: manualDate, start_time: manualStart, end_time: manualEnd, is_self: false, source: 'manual' });
    setManualName('');
  };

  const shiftsByDate = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const list = shiftsByDate.get(s.shift_date) ?? [];
    list.push(s);
    shiftsByDate.set(s.shift_date, list);
  }

  const dayShifts = selectedDate ? (shiftsByDate.get(selectedDate) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, color: '#8A8F98', maxWidth: 560, lineHeight: 1.5 }}>
        The whole team's posted gas-station schedule — who's working when, so you can find someone to cover or pick
        up a shift at a glance. Separate from the Main Calendar above.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhotoSelected} />
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999, background: parsing ? '#22262B' : '#F5F6F7', color: parsing ? '#8A8F98' : '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: parsing ? 'default' : 'pointer' }}
          onClick={() => !parsing && photoInputRef.current?.click()}
        >
          {parsing ? 'Reading schedule…' : '📷 Upload schedule photo'}
        </div>
      </div>
      {parseError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 8 }}>{parseError}</div>}

      {reviewShifts && reviewShifts.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid #22262B', borderRadius: 12, overflow: 'hidden', maxWidth: 620 }}>
          <div style={{ padding: '10px 14px', fontSize: 12, color: '#8A8F98', background: '#101114', borderBottom: '1px solid #1c1e23' }}>
            Review before adding — {reviewShifts.length} shift{reviewShifts.length === 1 ? '' : 's'} found
          </div>
          {reviewShifts.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #1c1e23', background: '#14161A', flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: '1 1 100px' }} value={s.person_name} onChange={(e) => updateReviewShift(i, { person_name: e.target.value })} />
              <input type="date" style={{ ...inputStyle, width: 130 }} value={s.shift_date} onChange={(e) => updateReviewShift(i, { shift_date: e.target.value })} />
              <input type="time" style={{ ...inputStyle, width: 100 }} value={s.start_time} onChange={(e) => updateReviewShift(i, { start_time: e.target.value })} />
              <input type="time" style={{ ...inputStyle, width: 100 }} value={s.end_time} onChange={(e) => updateReviewShift(i, { end_time: e.target.value })} />
              <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => removeReviewShift(i)}>✕</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, padding: 12, background: '#101114' }}>
            <div style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} onClick={confirmReview}>
              Add {reviewShifts.length} shift{reviewShifts.length === 1 ? '' : 's'}
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 999, color: '#8A8F98', fontSize: 12.5, cursor: 'pointer' }} onClick={() => setReviewShifts(null)}>Discard</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center', maxWidth: 620 }}>
        <input style={{ ...inputStyle, flex: '1 1 120px' }} placeholder="Name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        <input type="date" style={{ ...inputStyle, width: 140 }} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
        <input type="time" style={{ ...inputStyle, width: 100 }} value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
        <input type="time" style={{ ...inputStyle, width: 100 }} value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} />
        <div style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} onClick={submitManual}>Add shift</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, marginBottom: 14 }}>
        <span style={{ cursor: 'pointer', color: '#8A8F98', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>‹</span>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#F5F6F7', minWidth: 160 }}>{MONTH_NAMES[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</div>
        <span style={{ cursor: 'pointer', color: '#8A8F98', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>›</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#1c1e23', border: '1px solid #1c1e23', borderRadius: 12, overflow: 'hidden' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ background: '#14161A', padding: '8px 10px', fontSize: 11, color: '#565b64', fontWeight: 600 }}>{d}</div>
        ))}
        {monthGrid(monthAnchor).map((d, i) => {
          const ds = dateStr(d);
          const inMonth = d.getMonth() === monthAnchor.getMonth();
          const isToday = ds === dateStr(new Date());
          const dayList = (shiftsByDate.get(ds) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
          return (
            <div
              key={i}
              onClick={() => setSelectedDate(ds)}
              style={{ background: '#101114', minHeight: 84, padding: '8px 8px', cursor: 'pointer', opacity: inMonth ? 1 : 0.35 }}
            >
              <div style={{ fontSize: 12, color: isToday ? '#0A0B0D' : '#C7CAD1', fontWeight: isToday ? 700 : 400, display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#F5F6F7' : 'transparent' }}>
                {d.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 5 }}>
                {dayList.slice(0, 3).map((s) => (
                  <div key={s.id} style={{ fontSize: 9.5, color: colorForName(s.person_name), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.person_name}
                  </div>
                ))}
                {dayList.length > 3 && <div style={{ fontSize: 9.5, color: '#565b64' }}>+{dayList.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!loading && shifts.length === 0 && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#565b64' }}>No shifts yet — upload a schedule photo or add one manually above.</div>
      )}

      {selectedDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.85)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedDate(null)}>
          <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 16, padding: 20, width: '100%', maxWidth: 380, maxHeight: '70vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {dayShifts.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: '#101114', border: `1px solid ${colorForName(s.person_name)}44` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colorForName(s.person_name) }}>{s.person_name}</div>
                    <div style={{ fontSize: 11.5, color: '#8A8F98' }}>{formatTimeLabel(s.start_time)} – {formatTimeLabel(s.end_time)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => removeShift(s.id)}>Remove</span>
                </div>
              ))}
              {dayShifts.length === 0 && <div style={{ fontSize: 12.5, color: '#565b64' }}>No shifts logged for this day.</div>}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12.5, color: '#8A8F98', cursor: 'pointer' }} onClick={() => setSelectedDate(null)}>Close</div>
          </div>
        </div>
      )}
    </div>
  );
}
