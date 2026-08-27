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
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none',
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
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', maxWidth: 560, lineHeight: 1.5 }}>
        The whole team's posted gas-station schedule — who's working when, so you can find someone to cover or pick
        up a shift at a glance. Separate from the Main Calendar above.
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* No `capture` attribute — on iOS Safari, pairing accept="image/*"
            with capture forces the camera to open directly, skipping the
            native picker's Photo Library / Take Photo / Browse choice. */}
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoSelected} />
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: parsing ? 'var(--border)' : 'var(--text)', color: parsing ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: parsing ? 'default' : 'pointer' }}
          onClick={() => !parsing && photoInputRef.current?.click()}
        >
          {parsing ? 'Reading schedule…' : '📷 Upload schedule photo'}
        </div>
      </div>
      {parseError && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginTop: 8 }}>{parseError}</div>}

      {reviewShifts && reviewShifts.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: 620 }}>
          <div style={{ padding: '10px 14px', fontSize: 'var(--text-small)', color: 'var(--text-secondary)', background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-3)' }}>
            Review before adding — {reviewShifts.length} shift{reviewShifts.length === 1 ? '' : 's'} found
          </div>
          {reviewShifts.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface)', flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: '1 1 100px' }} value={s.person_name} onChange={(e) => updateReviewShift(i, { person_name: e.target.value })} />
              <input type="date" style={{ ...inputStyle, width: 130 }} value={s.shift_date} onChange={(e) => updateReviewShift(i, { shift_date: e.target.value })} />
              <input type="time" style={{ ...inputStyle, width: 100 }} value={s.start_time} onChange={(e) => updateReviewShift(i, { start_time: e.target.value })} />
              <input type="time" style={{ ...inputStyle, width: 100 }} value={s.end_time} onChange={(e) => updateReviewShift(i, { end_time: e.target.value })} />
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => removeReviewShift(i)}>✕</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--surface-2)' }}>
            <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={confirmReview}>
              Add {reviewShifts.length} shift{reviewShifts.length === 1 ? '' : 's'}
            </div>
            <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }} onClick={() => setReviewShifts(null)}>Discard</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center', maxWidth: 620 }}>
        <input style={{ ...inputStyle, flex: '1 1 120px' }} placeholder="Name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        <input type="date" style={{ ...inputStyle, width: 140 }} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
        <input type="time" style={{ ...inputStyle, width: 100 }} value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
        <input type="time" style={{ ...inputStyle, width: 100 }} value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} />
        <div style={{ padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={submitManual}>Add shift</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 8 }}>
        <span style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-head)' }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>‹</span>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 600, color: 'var(--text)', minWidth: 160 }}>{MONTH_NAMES[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</div>
        <span style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 'var(--text-head)' }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>›</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--surface-3)', border: '1px solid var(--surface-3)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ background: 'var(--surface)', padding: '5px 6px', fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
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
              style={{ background: 'var(--surface-2)', aspectRatio: '1 / 0.8', padding: '6px 7px', cursor: 'pointer', opacity: inMonth ? 1 : 0.35, minWidth: 0, overflow: 'hidden' }}
            >
              <div style={{ fontSize: 'var(--text-caption)', color: isToday ? 'var(--bg)' : 'var(--text-quaternary)', fontWeight: isToday ? 700 : 400, display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? 'var(--text)' : 'transparent' }}>
                {d.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 3 }}>
                {dayList.slice(0, 3).map((s) => (
                  <div key={s.id} style={{ fontSize: 9, color: colorForName(s.person_name), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.person_name}
                  </div>
                ))}
                {dayList.length > 3 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>+{dayList.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!loading && shifts.length === 0 && (
        <div style={{ marginTop: 14, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No shifts yet — upload a schedule photo or add one manually above.</div>
      )}

      {selectedDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.85)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelectedDate(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', padding: 20, width: '100%', maxWidth: 380, maxHeight: '70vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {dayShifts.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: `1px solid ${colorForName(s.person_name)}44` }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: colorForName(s.person_name) }}>{s.person_name}</div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{formatTimeLabel(s.start_time)} – {formatTimeLabel(s.end_time)}</div>
                  </div>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => removeShift(s.id)}>Remove</span>
                </div>
              ))}
              {dayShifts.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No shifts logged for this day.</div>}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setSelectedDate(null)}>Close</div>
          </div>
        </div>
      )}
    </div>
  );
}
