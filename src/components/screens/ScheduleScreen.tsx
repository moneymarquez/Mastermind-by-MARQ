import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import type { CalendarEvent, EventType } from '../../data/types';
import { dateStr, formatDateLabel, formatTimeLabel, minutesToTime, snapMinutes, timeToMinutes } from '../../data/time';
import EventAdderModal from './EventAdderModal';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const TYPE_COLOR: Record<EventType, string> = { holiday: '#8A8F98', dialing: '#5B8DEF', scalez: '#4CAF7D' };
const TYPE_LABEL: Record<EventType, string> = { holiday: 'Holiday', dialing: 'Dialing', scalez: 'Scalez' };
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

export default function ScheduleScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { events, addEvent, addHolidayEvents, updateEvent, deleteEvent } = useEvents();
  const { search: searchContacts, upsertContact } = useContacts();

  const [mode, setMode] = useState<'month' | 'day'>('month');
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateStr(new Date()));
  const [filters, setFilters] = useState<Set<EventType>>(new Set(['holiday', 'dialing', 'scalez']));
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);

  const dragRef = useRef<{ startMin: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const toggleFilter = (t: EventType) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const visibleEvents = events.filter((e) => filters.has(e.type));
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visibleEvents) {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    return map;
  }, [visibleEvents]);

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
      initialType: 'holiday',
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

  const filterChipStyle = (t: EventType): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${filters.has(t) ? TYPE_COLOR[t] : '#22262B'}`,
    color: filters.has(t) ? '#F5F6F7' : '#565b64',
    background: filters.has(t) ? `${TYPE_COLOR[t]}22` : 'transparent',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Schedule</div>
          <div style={homeSubStyle}>HOLIDAY shifts, DIALING and SCALEZ appointments — all in one calendar.</div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          onClick={() => setModalConfig({ initialType: 'holiday', initialDate: mode === 'day' ? selectedDate : dateStr(new Date()), initialStart: '09:00', initialEnd: '09:30', editingEvent: null })}
        >
          + Add event
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        {(['holiday', 'dialing', 'scalez'] as EventType[]).map((t) => (
          <div key={t} style={filterChipStyle(t)} onClick={() => toggleFilter(t)}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[t] }} />
            {TYPE_LABEL[t]}
          </div>
        ))}
      </div>

      {mode === 'month' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ cursor: 'pointer', color: '#8A8F98', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>‹</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F5F6F7', minWidth: 160 }}>{MONTH_NAMES[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}</div>
            <span style={{ cursor: 'pointer', color: '#8A8F98', fontSize: 16 }} onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>›</span>
            <div style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer', border: '1px solid #22262B', borderRadius: 999, padding: '5px 12px' }} onClick={() => setMonthAnchor(new Date())}>Today</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#1c1e23', border: '1px solid #1c1e23', borderRadius: 12, overflow: 'hidden' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={{ background: '#14161A', padding: '8px 10px', fontSize: 11, color: '#565b64', fontWeight: 600 }}>{d}</div>
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
                  style={{ background: '#101114', minHeight: 76, padding: '8px 8px', cursor: 'pointer', opacity: inMonth ? 1 : 0.35 }}
                >
                  <div style={{ fontSize: 12, color: isToday ? '#0A0B0D' : '#C7CAD1', fontWeight: isToday ? 700 : 400, display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#F5F6F7' : 'transparent' }}>
                    {d.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                    {dayEvts.slice(0, 4).map((e) => (
                      <span key={e.id} style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLOR[e.type] }} />
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
            <span style={{ cursor: 'pointer', color: '#8A8F98', fontSize: 13 }} onClick={() => setMode('month')}>← Month</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F5F6F7' }}>{formatDateLabel(selectedDate)}</div>
          </div>
          <div style={{ fontSize: 11.5, color: '#565b64', marginBottom: 10 }}>Drag across the timeline to add an event — a quick click blocks off 30 minutes.</div>

          <div style={{ position: 'relative', border: '1px solid #22262B', borderRadius: 12, overflow: 'hidden' }}>
            <div
              ref={timelineRef}
              onPointerDown={onTimelinePointerDown}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={onTimelinePointerUp}
              style={{ position: 'relative', height: HOUR_HEIGHT * 24, touchAction: 'none', cursor: 'crosshair' }}
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT, borderTop: '1px solid #1c1e23', display: 'flex' }}>
                  <div style={{ width: 56, flexShrink: 0, fontSize: 10.5, color: '#565b64', padding: '2px 8px' }}>{formatTimeLabel(`${String(h).padStart(2, '0')}:00`)}</div>
                  <div style={{ flex: 1, background: '#101114' }} />
                </div>
              ))}

              {dragRange && (
                <div
                  style={{
                    position: 'absolute', left: 60, right: 6, top: (dragRange.start / 60) * HOUR_HEIGHT, height: Math.max(4, ((dragRange.end - dragRange.start) / 60) * HOUR_HEIGHT),
                    background: 'rgba(245,246,247,0.18)', border: '1px solid #F5F6F7', borderRadius: 6, pointerEvents: 'none',
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
                      background: `${TYPE_COLOR[ev.type]}33`, borderLeft: `3px solid ${TYPE_COLOR[ev.type]}`, borderRadius: 6,
                      padding: '4px 8px', overflow: 'hidden', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#F5F6F7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#8A8F98' }}>{formatTimeLabel(ev.start_time)} – {formatTimeLabel(ev.end_time)}</div>
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
}

function eventLabel(ev: CalendarEvent): string {
  if (ev.type === 'holiday') return ev.notes || 'Shift';
  const d = ev.details as Record<string, string>;
  if (ev.type === 'dialing') return `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || 'Dialing appt';
  return d.business_name || d.contact_name || 'Scalez appt';
}
