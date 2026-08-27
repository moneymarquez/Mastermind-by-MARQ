import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import type { EventType } from '../../data/types';
import { EVENT_TYPE_COLOR } from '../../data/eventDisplay';
import CalendarView from '../CalendarView';
import type { CalendarViewHandle } from '../CalendarView';
import HolidayCalendarView from './HolidayCalendarView';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const TYPE_LABEL: Record<EventType, string> = { holiday: 'Holiday', dialing: 'Dialing', scalez: 'Scalez', streaming: 'Streaming' };
const FILTERABLE_TYPES: EventType[] = ['holiday', 'dialing', 'scalez', 'streaming'];

export default function ScheduleScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { events, addEvent, addHolidayEvents, updateEvent, deleteEvent } = useEvents();
  const { search: searchContacts, upsertContact } = useContacts();

  const [calendar, setCalendar] = useState<'main' | 'holiday'>('main');
  const [filters, setFilters] = useState<Set<EventType>>(new Set(FILTERABLE_TYPES));
  const calendarRef = useRef<CalendarViewHandle>(null);

  const toggleFilter = (t: EventType) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const visibleEvents = events.filter((e) => filters.has(e.type));

  const filterChipStyle = (t: EventType): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600,
    border: `1px solid ${filters.has(t) ? EVENT_TYPE_COLOR[t] : 'var(--border)'}`,
    color: filters.has(t) ? 'var(--text)' : 'var(--text-tertiary)',
    background: filters.has(t) ? `${EVENT_TYPE_COLOR[t]}22` : 'transparent',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Schedule</div>
          <div style={homeSubStyle}>HOLIDAY shifts, DIALING/SCALEZ appointments, and Streaming — all in one calendar.</div>
        </div>
        {calendar === 'main' && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body)', fontWeight: 500, cursor: 'pointer' }}
            onClick={() => calendarRef.current?.openAddModal()}
          >
            + Add event
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <div
          style={{ padding: '7px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600, border: `1px solid ${calendar === 'main' ? 'var(--text)' : 'var(--border)'}`, color: calendar === 'main' ? 'var(--text)' : 'var(--text-tertiary)' }}
          onClick={() => setCalendar('main')}
        >
          Main Calendar
        </div>
        <div
          style={{ padding: '7px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600, border: `1px solid ${calendar === 'holiday' ? 'var(--text)' : 'var(--border)'}`, color: calendar === 'holiday' ? 'var(--text)' : 'var(--text-tertiary)' }}
          onClick={() => setCalendar('holiday')}
        >
          Holiday Calendar (team)
        </div>
      </div>

      {calendar === 'holiday' && <HolidayCalendarView />}

      {calendar === 'main' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {FILTERABLE_TYPES.map((t) => (
              <div key={t} style={filterChipStyle(t)} onClick={() => toggleFilter(t)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_TYPE_COLOR[t] }} />
                {TYPE_LABEL[t]}
              </div>
            ))}
          </div>

          <CalendarView
            ref={calendarRef}
            events={visibleEvents}
            defaultType="holiday"
            searchContacts={searchContacts}
            upsertContact={upsertContact}
            addEvent={addEvent}
            addHolidayEvents={addHolidayEvents}
            updateEvent={updateEvent}
            deleteEvent={deleteEvent}
          />
        </>
      )}
    </div>
  );
}
