import { useEffect, useMemo, useRef, useState } from 'react';
import { useEvents } from '../../../data/useEvents';
import { useContacts } from '../../../data/useContacts';
import { useHolidayShifts } from '../../../data/useHolidayShifts';
import type { CalendarEvent, EventType } from '../../../data/types';
import { eventLabel } from '../../../data/eventDisplay';
import CalendarView from '../../CalendarView';
import type { CalendarViewHandle } from '../../CalendarView';
import HolidayCalendarView from '../HolidayCalendarView';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import type { ChipKind } from '../../mm/Chip';
import { Bars } from '../../mm/charts';
import type { HeatCell } from '../../mm/charts';
import { Page, useModule } from '../../mm/Page';
import { addDays, ymd, parseYmd, shortDate, WD3 } from './util';

type Tab = 'month' | 'day' | 'shifts';
const TYPE: Record<EventType, string> = { holiday: 'Shift', dialing: 'Dialing', scalez: 'Scalez', streaming: 'Stream' };
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const hm = (t: string) => new Date(`2000-01-01T${t.slice(0, 5)}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const hours = (e: { start_time: string; end_time: string }) => { const d = toMin(e.end_time) - toMin(e.start_time); return (d < 0 ? d + 1440 : d) / 60; };

/** Status chip for an event relative to now. */
function chipFor(e: CalendarEvent, now: Date): { c: string; k: ChipKind } {
  const today = ymd(now);
  if (e.type === 'holiday') return { c: 'Shift', k: 'neutral' };
  if (e.event_date < today) return { c: 'Done', k: 'good' };
  if (e.event_date > today) return { c: TYPE[e.type], k: 'neutral' };
  const n = now.getHours() * 60 + now.getMinutes(), s = toMin(e.start_time), en = toMin(e.end_time);
  if (n >= en) return { c: 'Done', k: 'good' };
  if (n >= s) return { c: 'Now', k: 'accent' };
  if (s - n <= 60) return { c: `In ${s - n} min`, k: 'warn' };
  return { c: TYPE[e.type], k: 'neutral' };
}

export default function ScheduleV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const E = useEvents();
  const { search: searchContacts, upsertContact } = useContacts();
  const { shifts } = useHolidayShifts();
  const [tab, setTab] = useState<Tab>('month');
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState(() => ymd(new Date()));
  const cal = useRef<CalendarViewHandle>(null);
  const [pending, setPending] = useState<((h: CalendarViewHandle) => void) | null>(null);
  const now = new Date(), today = ymd(now);

  // Actions that need the day view: switch to it, then run once it's mounted.
  const viaDay = (fn: (h: CalendarViewHandle) => void) => { setTab('day'); setPending(() => fn); };
  // Day always opens on the picked day, then runs whatever sent us there.
  useEffect(() => {
    if (tab !== 'day' || !cal.current) return;
    cal.current.openDay(sel);
    if (pending) { const h = cal.current; setTimeout(() => pending(h)); setPending(null); }
  }, [tab, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => { const m = new Map<string, CalendarEvent[]>(); for (const e of E.events) m.set(e.event_date, [...(m.get(e.event_date) ?? []), e]); return m; }, [E.events]);
  const mine = useMemo(() => shifts.filter((s) => s.is_self), [shifts]);
  const first = ymd(anchor), lead = (anchor.getDay() + 6) % 7; // Monday-first grid
  const dim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const cells: HeatCell[] = [
    ...Array.from({ length: lead }, () => ({ v: '_' as const })),
    ...Array.from({ length: dim }, (_, i) => {
      const d = addDays(first, i), n = (byDay.get(d) ?? []).length;
      return { v: (Math.min(3, n) as 0 | 1 | 2 | 3), n: String(i + 1), t: `${shortDate(d)} · ${n} ${n === 1 ? 'event' : 'events'}` };
    }),
  ];
  const dayEvents = (byDay.get(sel) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
  const todayEvents = (byDay.get(today) ?? []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextUp = todayEvents.find((e) => toMin(e.end_time) > now.getHours() * 60 + now.getMinutes());
  const weekStart = addDays(today, -((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shiftHrs = (d: string) => mine.filter((s) => s.shift_date === d).reduce((t, s) => t + hours(s), 0) + (byDay.get(d) ?? []).filter((e) => e.type === 'holiday').reduce((t, e) => t + hours(e), 0);
  const weekHrs = week.reduce((t, d) => t + shiftHrs(d), 0);
  const sixWeeks = Array.from({ length: 6 }, (_, i) => addDays(weekStart, -7 * (5 - i)));
  const weekly = sixWeeks.map((w) => Array.from({ length: 7 }, (_, i) => shiftHrs(addDays(w, i))).reduce((a, b) => a + b, 0));
  const span = (d: string) => { const s = mine.find((x) => x.shift_date === d) ?? (byDay.get(d) ?? []).find((e) => e.type === 'holiday'); return s ? `${hm(s.start_time).replace(':00', '').replace(' ', '')}–${hm(s.end_time).replace(':00', '').replace(' ', '')}` : ''; };
  // Free blocks over an hour today, between 8 AM and 10 PM.
  const free = (() => { let c = 0, t = 8 * 60; for (const e of todayEvents) { const s = toMin(e.start_time); if (s - t >= 60) c++; t = Math.max(t, toMin(e.end_time)); } if (22 * 60 - t >= 60) c++; return c; })();

  const seg = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: phone ? undefined : 420 }}>
      {(['month', 'day', 'shifts'] as Tab[]).map((t) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)} style={{ padding: '8px 0', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: tab === t ? 'var(--text)' : 'transparent', color: tab === t ? 'var(--bg)' : 'var(--text-secondary)' }}>{t[0].toUpperCase() + t.slice(1)}</button>)}
    </div>
  );
  const monthName = anchor.toLocaleDateString('en-US', { month: 'long', year: anchor.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  const month = (
    <Card wide={!phone} title={monthName} action={
      <div style={{ display: 'flex', gap: 6 }}>
        <button aria-label="Previous month" className="mm-btn" style={{ height: 30, width: 30, padding: 0 }} onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button>
        <button aria-label="Next month" className="mm-btn" style={{ height: 30, width: 30, padding: 0 }} onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
      </div>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'center' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div style={{ position: 'relative' }}>
        <HeatGrid cells={cells} lead={lead} first={first} sel={sel} today={today} onPick={setSel} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>
        <span>Darker days are busier</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Free{['var(--surface-3)', 'var(--accent-soft)', 'color-mix(in srgb, var(--accent) 65%, var(--surface))', 'var(--accent)'].map((b) => <span key={b} style={{ width: 10, height: 10, borderRadius: 3, background: b }} />)}Packed</span>
      </div>
    </Card>
  );
  const day = (
    <Card title={`${WD3[parseYmd(sel).getDay()]}, ${shortDate(sel)}`} meta={`${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`} flush wide={!phone}>
      {dayEvents.length ? <div>{dayEvents.map((e, i) => { const c = chipFor(e, now); return <Row key={e.id} first={i === 0} name={eventLabel(e)} meta={`${hm(e.start_time)} – ${hm(e.end_time)}`} chip={c.c} k={c.k} onClick={() => viaDay((h) => h.openEdit(e))} />; })}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing on this day.</div>}
      <button className="mm-btn" style={{ margin: '4px 0 14px' }} onClick={() => viaDay((h) => h.openDay(sel))}>Open day view</button>
    </Card>
  );
  const shiftStrip = (
    <Card title="Shifts this week" meta={`${Math.round(weekHrs * 10) / 10} hours`} wide={!phone}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {week.map((d) => { const h = shiftHrs(d); return (
          <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{WD3[parseYmd(d).getDay()][0]}</span>
            <div style={{ width: '100%', height: 64, borderRadius: 8, background: h ? 'var(--accent-soft)' : 'var(--surface-3)', border: d === today ? '1.5px solid var(--accent)' : 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{span(d)}</div>
          </div>
        ); })}
      </div>
    </Card>
  );
  const shiftBars = weekly.some(Boolean) && (
    <Card title="Shift hours" meta="Last 6 weeks" wide={!phone}><Bars vals={weekly.map((v) => Math.round(v * 10) / 10)} labels={sixWeeks.map((w) => `${parseYmd(w).getMonth() + 1}/${parseYmd(w).getDate()}`)} pre="" suf="h" /></Card>
  );
  const calendar = (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 12 : 16, minWidth: 0 }}>
      <CalendarView ref={cal} events={E.events} defaultType="holiday" searchContacts={searchContacts} upsertContact={upsertContact} addEvent={E.addEvent} addHolidayEvents={E.addHolidayEvents} updateEvent={E.updateEvent} deleteEvent={E.deleteEvent} />
    </div>
  );

  return (
    <Page title={tab === 'month' ? monthName : tab === 'day' ? 'Day view' : 'Shifts'} sub="Schedule" right={{ t: 'Today', onClick: () => { const d = new Date(); d.setDate(1); setAnchor(d); setSel(today); if (tab === 'day') cal.current?.openDay(today); } }} fab={{ t: 'Event', onClick: () => viaDay((h) => h.openAddModal()) }}>
      {seg}
      {!phone && tab === 'month' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Stat label="Events today" value={String(todayEvents.length)} pill={nextUp ? `Next ${hm(nextUp.start_time)}` : 'Nothing left'} k={nextUp ? 'warn' : 'neutral'} />
          <Stat label="Shift hours" value={String(Math.round(weekHrs * 10) / 10)} pill="This week" />
          <Stat label="Free blocks" value={String(free)} pill="Over 1 hour today" />
          <Stat label="This month" value={String(E.events.filter((e) => e.event_date.startsWith(first.slice(0, 7))).length)} pill="events" />
        </div>
      )}
      {tab === 'month' && (phone ? <>{month}{day}{shiftStrip}</> : (
        <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
          {month}{day}{three ? shiftBars || shiftStrip : null}
        </div>
      ))}
      {tab === 'day' && calendar}
      {tab === 'shifts' && <>{shiftStrip}{shiftBars}<Card title="Team holiday calendar" meta="Everyone's shifts" wide={!phone}><HolidayCalendarView /></Card></>}
    </Page>
  );
}

/** Month grid on the heatmap scale, with day numbers, today and the picked day marked. */
function HeatGrid({ cells, lead, first, sel, today, onPick }: { cells: HeatCell[]; lead: number; first: string; sel: string; today: string; onPick: (d: string) => void }) {
  const bgs = ['var(--surface-3)', 'var(--accent-soft)', 'color-mix(in srgb, var(--accent) 65%, var(--surface))', 'var(--accent)'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
      {cells.map((c, i) => {
        if (c.v === '_') return <div key={i} />;
        const d = addDays(first, i - lead), lvl = typeof c.v === 'number' ? c.v : 0;
        return (
          <button key={i} title={c.t} onClick={() => onPick(d)} aria-pressed={d === sel} aria-label={c.t}
            style={{ aspectRatio: '1', maxHeight: 44, borderRadius: 6, border: d === sel ? '2px solid var(--text)' : d === today ? '1.5px solid var(--accent)' : 'none', background: bgs[lvl], boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: lvl >= 2 ? 'var(--bg)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>{c.n}</button>
        );
      })}
    </div>
  );
}
