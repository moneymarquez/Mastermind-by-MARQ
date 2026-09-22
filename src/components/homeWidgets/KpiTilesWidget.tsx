import { useEffect, useRef, useState } from 'react';
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
import { formatTimeLabel, dateStr, timeToMinutes } from '../../data/time';
import { useSkin } from '../../data/useTheme';
import { emptyCopy } from '../../data/emptyCopy';
import { streakClass } from '../../data/dialStreak';
import RollingText from '../fx/RollingText';
import ProgressBar from '../fx/ProgressBar';
import Skeleton from '../fx/Skeleton';
import { useTilt } from '../fx/useTilt';
import type { HomeWidgetProps } from './types';

const tile: CSSProperties = { padding: 17, borderRadius: 16, background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', gap: 9, position: 'relative', minWidth: 0 };

// Cascade order is the spec's: calls, sobriety, workouts, macros — then the
// two that aren't "numbers about today". Delays are the boot/roll stagger;
// slightly slower here than elsewhere because it's the first thing seen.
const STAT_DEFS = [
  { icon: 'phone-call', caption: "Today's call goal", delay: 0 },
  { icon: 'heart', caption: 'Sobriety streak', delay: 170 },
  { icon: 'barbell', caption: 'Workouts this week', delay: 340 },
  { icon: 'fork-knife', caption: "Today's macros", delay: 510 },
  { icon: 'users-three', caption: 'Leads in pipeline', delay: 680 },
  { icon: 'calendar-blank', caption: 'Next on schedule', delay: 850 },
];
const ROLL_MS = 440;

/** The 6-tile KPI row — moved out of HomeScreen.tsx as the Overview
 *  widget system's first registry entry (always full-width, always at
 *  the top; not yet individually splittable — see the widget plan for
 *  why that's deferred). Same real hooks as before, just self-contained
 *  now instead of split between viewModel.ts's placeholder shells and
 *  HomeScreen's caption-matched overrides.
 *
 *  Numbers roll up (RollingText) on first paint and on real changes, in
 *  the cascade above. Cyberpunk adds the boot power-up, a scanline sweep
 *  when a value refreshes after load, a glitch on the call count when the
 *  calling hour has passed and it's short, and the streak glow. */
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
  const skin = useSkin();
  const cyber = skin === 'cyberpunk';

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
  const nextLabel = nextBlock
    ? formatTimeLabel(nextBlock.time)
    : !next
    ? emptyCopy('nextOnSchedule', skin)
    : next.event_date === today
    ? formatTimeLabel(next.start_time)
    : new Date(`${next.event_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Behind = the plan's dials block (or 4pm) has started and the count is
  // short. Cyberpunk-only class; Simple's tile is unchanged.
  const callBlock = plan?.blocks.find((b) => b.source === 'dials-calls');
  const callStart = callBlock ? timeToMinutes(callBlock.time) : 16 * 60;
  const behind = cyber && !outcomesLoading && nowMinutes >= callStart && callsToday < callGoal;

  const values: Record<string, { value: string; loading: boolean; pct: number | null; className?: string }> = {
    "Today's call goal": { value: `${callsToday} / ${callGoal}`, loading: contactsLoading || outcomesLoading, pct: Math.min(100, Math.round((callsToday / callGoal) * 100)), className: [behind ? 'fx-behind' : '', streakClass(dialStreakDays) ?? ''].join(' ').trim() || undefined },
    'Sobriety streak': { value: `${streak} day${streak === 1 ? '' : 's'}`, loading: sobrietyLoading, pct: null },
    'Workouts this week': { value: `${weekCount}`, loading: fitnessLoading, pct: null },
    "Today's macros": { value: `${totals.calories} kcal`, loading: macrosLoading, pct: null },
    'Leads in pipeline': { value: `${leadContacts.length}`, loading: contactsLoading, pct: null },
    'Next on schedule': { value: nextLabel, loading: eventsLoading || planLoading, pct: null },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 9 : 11 }}>
      {STAT_DEFS.map((d) => <Tile key={d.caption} def={d} v={values[d.caption]} cyber={cyber} />)}
    </div>
  );
}

function Tile({ def, v, cyber }: { def: typeof STAT_DEFS[number]; v: { value: string; loading: boolean; pct: number | null; className?: string }; cyber: boolean }) {
  const tilt = useTilt();
  const mountedAt = useRef(Date.now());
  const [sweep, setSweep] = useState(0);
  // The first roll is the boot; only a refresh AFTER the tile has settled
  // earns a scanline sweep.
  const onRoll = () => { if (cyber && Date.now() - mountedAt.current > 2500) setSweep((n) => n + 1); };
  useEffect(() => {
    if (!sweep) return;
    const t = window.setTimeout(() => setSweep(0), 700);
    return () => window.clearTimeout(t);
  }, [sweep]);

  const shown = v.loading ? '—' : v.value;
  const valueStyle: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: shown.length > 10 ? 20 : 26, fontWeight: 600, color: 'var(--text)', marginTop: 8 };
  const isTextTile = def.caption === 'Next on schedule';
  const tileProps = cyber ? tilt : {};
  return (
    <div
      {...tileProps}
      className={cyber ? `${tilt.className} fx-boot` : undefined}
      style={cyber ? { ...tile, '--boot-delay': `${def.delay}ms` } as CSSProperties : tile}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{def.caption}</div>
        <Icon name={def.icon} size={15} color="var(--mm-faint)" />
      </div>
      <div style={valueStyle} className={v.className}>
        {v.loading ? (
          <Skeleton width={72} height={22} />
        ) : isTextTile ? (
          <span className={cyber && v.value === emptyCopy('nextOnSchedule', 'cyberpunk') ? 'fx-empty' : undefined}>{v.value}</span>
        ) : (
          <RollingText text={v.value} delay={def.delay} duration={ROLL_MS} onRoll={onRoll} />
        )}
      </div>
      {v.pct !== null && (
        cyber ? (
          <ProgressBar pct={v.pct} height={4} />
        ) : (
          <div style={{ height: 4, borderRadius: 4, background: 'var(--mm-track)' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, v.pct))}%`, height: '100%', borderRadius: 4, background: 'var(--mm-text)' }} />
          </div>
        )
      )}
      {sweep > 0 && <div key={sweep} className="fx-sweep" aria-hidden="true" />}
    </div>
  );
}
