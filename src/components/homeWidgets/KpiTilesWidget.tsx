import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useSobriety } from '../../data/useSobriety';
import { useMacros } from '../../data/useMacros';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { useFitness } from '../../data/useFitness';
import { useCallOutcomes, DAILY_CALL_GOAL } from '../../data/useCallOutcomes';
import { formatTimeLabel, dateStr } from '../../data/time';
import type { HomeWidgetProps } from './types';

const tile: CSSProperties = { padding: 17, borderRadius: 16, background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', gap: 9, position: 'relative', minWidth: 0 };

const STAT_DEFS = [
  { icon: 'phone-call', caption: "Today's call goal" },
  { icon: 'heart', caption: 'Sobriety streak' },
  { icon: 'barbell', caption: 'Workouts this week' },
  { icon: 'fork-knife', caption: "Today's macros" },
  { icon: 'users-three', caption: 'Leads in pipeline' },
  { icon: 'calendar-blank', caption: 'Next on schedule' },
];

/** The 6-tile KPI row — moved out of HomeScreen.tsx as the Overview
 *  widget system's first registry entry (always full-width, always at
 *  the top; not yet individually splittable — see the widget plan for
 *  why that's deferred). Same real hooks as before, just self-contained
 *  now instead of split between viewModel.ts's placeholder shells and
 *  HomeScreen's caption-matched overrides. */
export default function KpiTilesWidget({ isMobile }: HomeWidgetProps) {
  const { streak, loading: sobrietyLoading } = useSobriety();
  const { totals, loading: macrosLoading } = useMacros();
  const { events, loading: eventsLoading } = useEvents();
  const { contacts, loading: contactsLoading } = useContacts();
  const { weekCount, loading: fitnessLoading } = useFitness();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const leadContacts = contacts.filter((c) => c.source === 'scalez');
  const { todayCount, loading: outcomesLoading } = useCallOutcomes(dialingContacts);

  const today = dateStr(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const next = events
    .filter((e) => e.event_date > today || (e.event_date === today && e.start_time >= `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`))
    .sort((a, b) => (a.event_date === b.event_date ? a.start_time.localeCompare(b.start_time) : a.event_date.localeCompare(b.event_date)))[0];
  const nextLabel = !next
    ? 'Nothing yet'
    : next.event_date === today
    ? formatTimeLabel(next.start_time)
    : new Date(`${next.event_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const values: Record<string, { value: string; pct: number | null }> = {
    "Today's call goal": { value: contactsLoading || outcomesLoading ? '—' : `${todayCount} / ${DAILY_CALL_GOAL}`, pct: Math.min(100, Math.round((todayCount / DAILY_CALL_GOAL) * 100)) },
    'Sobriety streak': { value: sobrietyLoading ? '—' : `${streak} day${streak === 1 ? '' : 's'}`, pct: null },
    'Workouts this week': { value: fitnessLoading ? '—' : `${weekCount}`, pct: null },
    "Today's macros": { value: macrosLoading ? '—' : `${totals.calories} kcal`, pct: null },
    'Leads in pipeline': { value: contactsLoading ? '—' : `${leadContacts.length}`, pct: null },
    'Next on schedule': { value: eventsLoading ? '—' : nextLabel, pct: null },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 9 : 11 }}>
      {STAT_DEFS.map((d) => {
        const v = values[d.caption];
        const valueStyle: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: v.value.length > 10 ? 20 : 26, fontWeight: 600, color: 'var(--text)', marginTop: 8 };
        return (
          <div key={d.caption} style={tile}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{d.caption}</div>
              <Icon name={d.icon} size={15} color="var(--mm-faint)" />
            </div>
            <div style={valueStyle}>{v.value}</div>
            {v.pct !== null && (
              <div style={{ height: 4, borderRadius: 4, background: 'var(--mm-track)' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, v.pct))}%`, height: '100%', borderRadius: 4, background: 'var(--mm-text)' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
