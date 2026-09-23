import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCallsToday } from '../../data/useCallsToday';
import { useDailyCallGoal } from '../../data/useDailyCallGoal';
import { useDailyPlan } from '../../data/useDailyPlan';
import { timeToMinutes } from '../../data/time';
import { dialState, formatClock, formatCountdown, minutesNow } from '../../lib/dialClock';
import type { DialState } from '../../lib/dialClock';
import RollingText from '../fx/RollingText';

export const STATUS_STRIP_HEIGHT = 44;

export interface StatusStripData {
  dials: number;
  goal: number;
  streak: number;
  callStart: number;
  state: DialState;
  loading: boolean;
}

/** The strip, given its numbers. Kept separate from the hooks so it can
 *  be rendered with fixture data. */
export function StatusStripView({ data, style }: { data: StatusStripData; style?: CSSProperties }) {
  const { dials, goal, streak, callStart, state, loading } = data;
  const dots = <span className="cp-dots" aria-hidden="true" />;
  const n = (v: number | string) => <span className="cp-num"><RollingText text={String(v)} duration={360} /></span>;
  return (
    <div className="cp-strip" data-phase={state.phase} style={style} role="status">
      {state.phase === 'live' ? (
        <>
          <span className="cp-label">Calling hour — live</span>
          {dots}
          <span className="cp-label">Dials</span>
          {n(loading ? '—' : `${dials}/${goal}`)}
          {dots}
          <span className="cp-label">{formatCountdown(state.minutesLeft)} left</span>
        </>
      ) : state.phase === 'closed' ? (
        <>
          <span className="cp-label">Hour closed</span>
          {n(loading ? '—' : `${dials}/${goal}`)}
          {dots}
          <span className="cp-label">Streak</span>
          {n(`${streak}d`)}
        </>
      ) : (
        <>
          <span className="cp-label">Dials</span>
          {n(loading ? '—' : `${dials}/${goal}`)}
          {dots}
          <span className="cp-label">Streak</span>
          {n(`${streak}d`)}
          {dots}
          {state.phase === 'done'
            ? <span className="cp-label" style={{ color: 'var(--green)' }}>Goal hit</span>
            : <><span className="cp-label">{formatClock(callStart)} in</span>{n(formatCountdown(state.minutesToStart))}</>}
        </>
      )}
    </div>
  );
}

/** Ticks the clock; the numbers come from the same hooks Dialing uses. */
export function useStatusStripData(): StatusStripData {
  const { callsToday, streak, loading } = useCallsToday();
  const goal = useDailyCallGoal();
  const { plan } = useDailyPlan();
  const callBlock = plan?.blocks.find((b) => b.source === 'dials-calls');
  const callStart = callBlock ? timeToMinutes(callBlock.time) : 16 * 60;
  const [now, setNow] = useState(minutesNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(minutesNow()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return { dials: callsToday, goal, streak, callStart, state: dialState(now, callStart, callsToday, goal), loading };
}

export default function StatusStrip({ style }: { style?: CSSProperties }) {
  const data = useStatusStripData();
  return <StatusStripView data={data} style={style} />;
}
