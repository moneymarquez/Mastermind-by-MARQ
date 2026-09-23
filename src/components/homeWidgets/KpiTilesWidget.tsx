import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useSobriety } from '../../data/useSobriety';
import { useMacros } from '../../data/useMacros';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { useFitness } from '../../data/useFitness';
import { useCallsToday } from '../../data/useCallsToday';
import { useDailyCallGoal } from '../../data/useDailyCallGoal';
import { useDailyPlan } from '../../data/useDailyPlan';
import { formatTimeLabel, dateStr, addDaysStr } from '../../data/time';
import { streakClass } from '../../data/dialStreak';
import RollingText from '../fx/RollingText';
import type { HomeWidgetProps } from './types';

const tile: CSSProperties = { padding: 17, borderRadius: 16, background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', gap: 9, position: 'relative', minWidth: 0 };

// Roll-up cascade order: calls, sobriety, workouts, macros, then the rest.
const STAT_DEFS = [
  { icon: 'phone-call', caption: "Today's call goal", delay: 0 },
  { icon: 'heart', caption: 'Sobriety streak', delay: 170 },
  { icon: 'barbell', caption: 'Workouts this week', delay: 340 },
  { icon: 'fork-knife', caption: "Today's macros", delay: 510 },
  { icon: 'users-three', caption: 'Leads in pipeline', delay: 680 },
  { icon: 'calendar-blank', caption: 'Next on schedule', delay: 850 },
];
const ROLL_MS = 440;

/** The 6-tile KPI row (Simple theme) — the Overview widget system's first
 *  registry entry. Cyberpunk renders its own Overview (CyberOverview) and
 *  never mounts this. Numbers roll up on first paint and real changes. */
export default function KpiTilesWidget({ isMobile }: HomeWidgetProps) {
  const { streak, loading: sobrietyLoading } = useSobriety();
  const { totals, loading: macrosLoading } = useMacros();
  const { events, loading: eventsLoading } = useEvents();
  const { contacts, loading: contactsLoading } = useContacts();
  const { weekCount, loading: fitnessLoading } = useFitness();
  const leadContacts = contacts.filter((c) => c.source === 'scalez');
  const { callsToday, streak: dialStreakDays, loading: outcomesLoading } = useCallsToday();
  const callGoal = useDailyCallGoal();
  const { plan, loading: planLoading } = useDailyPlan();
  const { plan: tomorrowPlan } = useDailyPlan(addDaysStr(dateStr(new Date()), 1));

  const today = dateStr(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowHHMM = `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`;
  // Today's plan first — it's what the day actually looks like, and it
  // already folds in calendar events — then the Schedule for later days.
  // "Nothing yet" only when both are genuinely empty.
  const nextBlock = (plan?.blocks ?? []).filter((b) => b.time >= nowHHMM).sort((a, b) => a.time.localeCompare(b.time))[0];
  const next = events
    .filter((e) => e.event_date > today || (e.event_date === today && e.start_time >= nowHHMM))
    .sort((a, b) => (a.event_date === b.event_date ? a.start_time.localeCompare(b.start_time) : a.event_date.localeCompare(b.event_date)))[0];
  const tomorrowFirst = (tomorrowPlan?.blocks ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))[0];
  const nextLabel = nextBlock
    ? formatTimeLabel(nextBlock.time)
    : tomorrowFirst && (!next || next.event_date > addDaysStr(today, 1))
    ? `Tomorrow ${formatTimeLabel(tomorrowFirst.time)}`
    : !next
    ? 'Nothing yet'
    : next.event_date === today
    ? formatTimeLabel(next.start_time)
    : new Date(`${next.event_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const values: Record<string, { value: string; loading: boolean; pct: number | null; className?: string }> = {
    "Today's call goal": { value: `${callsToday} / ${callGoal}`, loading: contactsLoading || outcomesLoading, pct: Math.min(100, Math.round((callsToday / callGoal) * 100)), className: streakClass(dialStreakDays) },
    'Sobriety streak': { value: `${streak} day${streak === 1 ? '' : 's'}`, loading: sobrietyLoading, pct: null },
    'Workouts this week': { value: `${weekCount}`, loading: fitnessLoading, pct: null },
    "Today's macros": { value: `${totals.calories} kcal`, loading: macrosLoading, pct: null },
    'Leads in pipeline': { value: `${leadContacts.length}`, loading: contactsLoading, pct: null },
    'Next on schedule': { value: nextLabel, loading: eventsLoading || planLoading, pct: null },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 9 : 11 }}>
      {STAT_DEFS.map((d) => {
        const v = values[d.caption];
        const shown = v.loading ? '—' : v.value;
        const valueStyle: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: shown.length > 10 ? 20 : 26, fontWeight: 600, color: 'var(--text)', marginTop: 8 };
        return (
          <div key={d.caption} style={tile}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{d.caption}</div>
              <Icon name={d.icon} size={15} color="var(--mm-faint)" />
            </div>
            <div style={valueStyle} className={v.className}>
              {v.loading || d.caption === 'Next on schedule' ? shown : <RollingText text={v.value} delay={d.delay} duration={ROLL_MS} />}
            </div>
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
