import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarEvent, Contact, EventType } from '../data/types';
import type { ContactInput } from '../data/useContacts';
import type { EventInput } from '../data/useEvents';
import { dateStr, formatDateLabel, formatTimeLabel, minutesToTime, snapMinutes, timeToMinutes } from '../data/time';
import { EVENT_TYPE_COLOR, eventLabel } from '../data/eventDisplay';
import EventAdderModal from './screens/EventAdderModal';

const HOUR_HEIGHT = 48;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface ModalConfig {
  initialType: EventType;
  initialDate: string;
  initialStart: string;
  initialEnd: string;
  editingEvent: CalendarEvent | null;
}

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

export interface CalendarViewHandle {
  /** Opens the add-event modal pre-set to this view's defaultType — used
   *  by a parent-rendered trigger button (ScheduleScreen's "+ Add event",
   *  StreamingScreen's "New Stream") so each page keeps its own button
   *  placement while sharing the same modal/calendar machinery. */
  openAddModal: () => void;
}

interface Props {
  /** Already filtered by the caller (e.g. to streaming-only, or to
   *  whichever type chips are active) — this component doesn't filter. */
  events: CalendarEvent[];
  defaultType: EventType;
  searchContacts: (q: string) => Contact[];
  upsertContact: (input: ContactInput) => Promise<Contact>;
  addEvent: (input: EventInput) => Promise<CalendarEvent>;
  addHolidayEvents: (dates: string[], start: string, end: string, notes: string | null) => Promise<void>;
  updateEvent: (id: string, patch: Partial<EventInput>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

// The month-grid + day-zoom drag-to-create timeline shared by the master
// Schedule page and any embedded per-type calendar (Streaming, and future
// Side Hustles pages) — one implementation, filtered differently by type
// depending on who's rendering it, per the "one source of truth" event data
// model this app already uses everywhere else.
const CalendarView = forwardRef<CalendarViewHandle, Props>(function CalendarView(
  { events, defaultType, searchContacts, upsertContact, addEvent, addHolidayEvents, updateEvent, deleteEvent },
  ref
) {
  const [mode, setMode] = useState<'month' | 'day'>('month');
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateStr(new Date()));
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  const dragRef = useRef<{ startMin: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    openAddModal: () => {
      setModalConfig({
        initialType: defaultType,
        initialDate: mode === 'day' ? selectedDate : dateStr(new Date()),
        initialStart: '09:00',
        initialEnd: '09:30',
        editingEvent: null,
      });
    },
  }));

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    return map;
  }, [events]);

  const openDay = (d: Date) => {
    setSelectedDate(dateStr(d));
    setMode('day');
  };

  const dayEvents = (eventsByDate.get(selectedDate) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));

  const minutesFromPointer = (e: ReactPointerEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const y = e.clientY - rect.top;
    return snapMinutes(Math.max(0, Math.min(1439, (y / HOUR_HEIGHT) * 60)));
  };

  const onTimelinePointerDown = (e: ReactPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const mins = minutesFromPointer(e);
    dragRef.current = { startMin: mins };
    setDragRange({ start: mins, end: mins });
  };
  const onTimelinePointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const mins = minutesFromPointer(e);
    setDragRange({ start: Math.min(dragRef.current.startMin, mins), end: Math.max(dragRef.current.startMin, mins) });
  };
  const onTimelinePointerUp = () => {
    if (!dragRef.current || !dragRange) return;
    const start = dragRange.start;
    const end = dragRange.end - start < 5 ? start + 30 : dragRange.end;
    dragRef.current = null;
    setDragRange(null);
    setModalConfig({
      initialType: defaultType,
      initialDate: selectedDate,
      initialStart: minutesToTime(start),
      initialEnd: minutesToTime(end),
      editingEvent: null,
    });
  };

  const openExistingEvent = (ev: CalendarEvent, e: ReactPointerEvent) => {
    e.stopPropagation();
    setModalConfig({ initialType: ev.type, initialDate: ev.event_date, initialStart: ev.start_time.slice(0, 5), initialEnd: ev.end_time.slice(0, 5), editingEvent: ev });
  };

  return (
    <div>
      {mode === 'month' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <span style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>‹</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', minWidth: 160 }}>{MONTH_NAMES[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</div>
            <span style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>›</span>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 12px' }} onClick={() => setMonthAnchor(new Date())}>Today</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--surface-3)', border: '1px solid var(--surface-3)', borderRadius: 12, overflow: 'hidden' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ background: 'var(--surface)', padding: '5px 6px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</div>
            ))}
            {monthGrid(monthAnchor).map((d, i) => {
              const ds = dateStr(d);
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = ds === dateStr(new Date());
              const dayEvts = eventsByDate.get(ds) ?? [];
              return (
                <div
                  key={i}
                  onClick={() => openDay(d)}
                  style={{ background: 'var(--surface-2)', aspectRatio: '1 / 0.72', padding: '6px 7px', cursor: 'pointer', opacity: inMonth ? 1 : 0.35, minWidth: 0, overflow: 'hidden' }}
                >
                  <div style={{ fontSize: 11.5, color: isToday ? 'var(--bg)' : 'var(--text-quaternary)', fontWeight: isToday ? 700 : 400, display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? 'var(--text)' : 'transparent' }}>
                    {d.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                    {dayEvts.slice(0, 4).map((e) => (
                      <span key={e.id} style={{ width: 5, height: 5, borderRadius: '50%', background: EVENT_TYPE_COLOR[e.type] }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'day' && (
        <div style={{ marginTop: 20, maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }} onClick={() => setMode('month')}>← Month</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{formatDateLabel(selectedDate)}</div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 10 }}>Drag across the timeline to add an event — a quick click blocks off 30 minutes.</div>

          <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div
              ref={timelineRef}
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              style={{ position: 'relative', height: HOUR_HEIGHT * 24, touchAction: 'none', cursor: 'crosshair' }}
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT, borderTop: '1px solid var(--surface-3)', display: 'flex' }}>
                  <div style={{ width: 56, flexShrink: 0, fontSize: 10.5, color: 'var(--text-tertiary)', padding: '2px 8px' }}>{formatTimeLabel(`${String(h).padStart(2, '0')}:00`)}</div>
                  <div style={{ flex: 1, background: 'var(--surface-2)' }} />
                </div>
              ))}

              {dragRange && (
                <div
                  style={{
                    position: 'absolute', left: 60, right: 6, top: (dragRange.start / 60) * HOUR_HEIGHT, height: Math.max(4, ((dragRange.end - dragRange.start) / 60) * HOUR_HEIGHT),
                    background: 'rgba(245,246,247,0.18)', border: '1px solid var(--text)', borderRadius: 6, pointerEvents: 'none',
                  }}
                />
              )}

              {dayEvents.map((ev) => {
                const start = timeToMinutes(ev.start_time);
                const end = timeToMinutes(ev.end_time);
                const top = (start / 60) * HOUR_HEIGHT;
                const height = Math.max(16, ((end - start) / 60) * HOUR_HEIGHT);
                const label = eventLabel(ev);
                return (
                  <div
                    key={ev.id}
                    onPointerDown={(e) => openExistingEvent(ev, e)}
                    style={{
                      position: 'absolute', left: 60, right: 6, top, height,
                      background: `${EVENT_TYPE_COLOR[ev.type]}33`, borderLeft: `3px solid ${EVENT_TYPE_COLOR[ev.type]}`, borderRadius: 6,
                      padding: '4px 8px', overflow: 'hidden', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{formatTimeLabel(ev.start_time)} – {formatTimeLabel(ev.end_time)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalConfig && (
        <EventAdderModal
          searchContacts={searchContacts}
          upsertContact={upsertContact}
          addEvent={addEvent}
          addHolidayEvents={addHolidayEvents}
          updateEvent={updateEvent}
          deleteEvent={deleteEvent}
          initialType={modalConfig.initialType}
          initialDate={modalConfig.initialDate}
          initialStart={modalConfig.initialStart}
          initialEnd={modalConfig.initialEnd}
          editingEvent={modalConfig.editingEvent}
          onClose={() => setModalConfig(null)}
        />
      )}
    </div>
  );
});

export default CalendarView;
