import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSobriety } from '../../data/useSobriety';
import { useFitness } from '../../data/useFitness';
import { useMacros } from '../../data/useMacros';
import { useDailyPlan } from '../../data/useDailyPlan';
import { useDialingQueue } from '../../data/useLeadflow';
import { formatTimeLabel, dateStr, addDaysStr } from '../../data/time';
import { useReminders } from '../../data/useReminders';
import type { DialState } from '../../lib/dialClock';
import { formatClock, formatCountdown, minutesNow } from '../../lib/dialClock';
import RollingText from '../fx/RollingText';
import Panel, { Rail } from './Panel';
import TickBar from './TickBar';
import { useStatusStripData } from './StatusStrip';

export interface OverviewData {
  dials: number;
  goal: number;
  callStart: number;
  state: DialState;
  dialsLoading: boolean;
  next: { title: string; timeLabel: string; screen: string } | null;
  planLoading: boolean;
  overdue: number;
  sobriety: number;
  workouts: number;
  calories: number;
  calorieTarget: number | null;
  vitalsLoading: boolean;
  /** Leads queued for Dialing; null when LeadFlow isn't connected. */
  queued: number | null;
}

/** The Overview, Cyberpunk: one bold thing (the dial count at 88px), a
 *  tick per call, the next action as a rail with a live button, three
 *  quiet vitals, and the pipeline. Every state derives from data — if it
 *  is all zeros at 2pm, that is what it says. */
export function CyberOverviewView({ d, isMobile, onNavigate }: { d: OverviewData; isMobile: boolean; onNavigate: (screen: string) => void }) {
  const behind = d.state.pace === 'behind';
  const closed = d.state.phase === 'closed';
  const heroColor = behind ? 'var(--amber)' : closed ? 'var(--magenta)' : 'var(--text)';

  // 5. Behind-pace glitch: once every 20s, 90ms, then still.
  const [glitchKey, setGlitchKey] = useState(0);
  useEffect(() => {
    if (!behind) return;
    const id = window.setInterval(() => setGlitchKey((k) => k + 1), 20000);
    return () => window.clearInterval(id);
  }, [behind]);

  const short = Math.max(0, d.goal - (d.queued ?? 0));
  const pipelineLine = d.queued === null
    ? 'LeadFlow not connected — load leads from the pool when it is.'
    : d.queued === 0
    ? `No leads loaded — ${d.goal} short of one hour.`
    : short > 0
    ? `${d.queued} lead${d.queued === 1 ? '' : 's'} loaded — ${short} short of one hour.`
    : `${d.queued} leads loaded — enough for the hour.`;

  const gap: CSSProperties = { marginTop: isMobile ? 18 : 22 };
  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Hero: the dial count. The one bold thing on the screen. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 6 }}>
        <div key={glitchKey} className={glitchKey ? 'cp-glitch-once' : undefined} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="cp-hero-num" style={{ color: heroColor }}>
            {d.dialsLoading ? '—' : <RollingText text={String(d.dials)} duration={400} />}
          </span>
        </div>
        <div style={{ textAlign: 'right', paddingBottom: 6 }}>
          <div className="cp-label" style={{ color: 'var(--text)' }}>Today's dials</div>
          <div className="cp-label" style={{ marginTop: 4 }}>target <span className="cp-num" style={{ fontSize: 12, color: 'var(--muted)' }}>{d.goal}</span></div>
          {d.state.phase === 'before' && <div className="cp-label" style={{ marginTop: 4, color: 'var(--cyan)' }}>{formatClock(d.callStart)} in {formatCountdown(d.state.minutesToStart)}</div>}
          {d.state.phase === 'live' && <div className="cp-label" style={{ marginTop: 4, color: behind ? 'var(--amber)' : 'var(--green)' }}>{behind ? `behind — ${Math.floor(d.state.expected)} by now` : 'on pace'}</div>}
          {closed && <div className="cp-label" style={{ marginTop: 4, color: 'var(--magenta)' }}>hour closed</div>}
          {d.state.phase === 'done' && <div className="cp-label" style={{ marginTop: 4, color: 'var(--green)' }}>goal hit</div>}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <TickBar total={d.goal} lit={d.dials} pace={d.state.pace} />
        <div className="cp-label" style={{ marginTop: 8 }}>{d.goal} segments, {Math.min(d.goal, d.dials)} lit</div>
      </div>

      {/* Overdue reminders beat everything — the honesty rule. */}
      {d.overdue > 0 && (
        <Rail accent="magenta" style={{ ...gap, marginLeft: isMobile ? -20 : -32, marginRight: isMobile ? -20 : -32, padding: isMobile ? '10px 20px' : '10px 32px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="cp-label" style={{ color: 'var(--magenta)' }}>Overdue</span>
          <span className="cp-body" style={{ flex: '1 1 200px' }}><span className="cp-num" style={{ fontSize: 14 }}>{d.overdue}</span> reminder{d.overdue === 1 ? '' : 's'} past due.</span>
          <button className="cp-btn cp-btn--ghost" onClick={() => onNavigate('daily-plan')}>See them</button>
        </Rail>
      )}

      {/* Next action: a rail with a live button. */}
      <Rail accent={d.next ? 'cyan' : 'amber'} style={{ ...gap, marginLeft: isMobile ? -20 : -32, marginRight: isMobile ? -20 : -32, padding: isMobile ? '12px 20px' : '12px 32px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="cp-label" style={{ color: d.next ? 'var(--cyan)' : 'var(--amber)' }}>{d.next ? 'Next ▸' : 'No action queued'}</span>
        <span className="cp-body" style={{ flex: '1 1 200px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.planLoading ? '…' : d.next ? <>{d.next.title} — <span className="cp-num" style={{ fontSize: 14 }}>{d.next.timeLabel}</span></> : 'Open the Daily Plan to load the day.'}
        </span>
        <button className={`cp-btn${d.next ? '' : ' cp-btn--cyan'}`} onClick={() => onNavigate(d.next ? d.next.screen : 'daily-plan')}>{d.next ? 'Go' : 'Open Daily Plan'}</button>
      </Rail>

      {/* Vitals: readouts, no panels. Type size is the hierarchy. */}
      <div style={{ ...gap, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div className="cp-readout">
          <span className="cp-num" style={{ fontSize: 34, lineHeight: 1 }}>{d.vitalsLoading ? '—' : <RollingText text={`${d.sobriety}d`} delay={220} duration={400} />}</span>
          <span className="cp-label">Sobriety</span>
        </div>
        <div className="cp-readout">
          <span className="cp-num" style={{ fontSize: 34, lineHeight: 1 }}>{d.vitalsLoading ? '—' : <RollingText text={String(d.workouts)} delay={300} duration={400} />}</span>
          <span className="cp-label">Workouts</span>
        </div>
        <div className="cp-readout">
          <span className="cp-num" style={{ fontSize: 34, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {d.vitalsLoading ? '—' : <RollingText text={d.calories.toLocaleString()} delay={380} duration={400} />}
            {!d.vitalsLoading && d.calorieTarget && !isMobile && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> / {d.calorieTarget.toLocaleString()}</span>}
          </span>
          <span className="cp-label">Calories{d.calorieTarget && isMobile ? ` / ${d.calorieTarget.toLocaleString()}` : ''}</span>
        </div>
      </div>

      {/* Pipeline. */}
      <Panel style={{ ...gap, padding: 18 }}>
        <div className="cp-panel-head">Pipeline</div>
        <div className="cp-body" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{pipelineLine}</div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="cp-btn cp-btn--cyan" onClick={() => onNavigate('leadflow')}>Load leads</button>
          <button className="cp-btn cp-btn--ghost" onClick={() => onNavigate('dialing')}>Open Dialing</button>
        </div>
      </Panel>
    </div>
  );
}

export default function CyberOverview({ isMobile, onNavigate }: { isMobile: boolean; onNavigate: (screen: string) => void }) {
  const strip = useStatusStripData();
  const { plan, loading: planLoading } = useDailyPlan();
  const { plan: tomorrowPlan } = useDailyPlan(addDaysStr(dateStr(new Date()), 1));
  const { reminders } = useReminders();
  const { streak: sobriety, loading: sobrietyLoading } = useSobriety();
  const { weekCount, loading: fitnessLoading } = useFitness();
  const { totals, nutritionTarget, loading: macrosLoading } = useMacros();
  const { queue, loading: queueLoading, notConnected } = useDialingQueue();

  const now = minutesNow();
  const nowHHMM = `${String(Math.floor(now / 60)).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`;
  const nextBlock = (plan?.blocks ?? []).filter((b) => b.time >= nowHHMM).sort((a, b) => a.time.localeCompare(b.time))[0];
  const tomorrowFirst = (tomorrowPlan?.blocks ?? []).slice().sort((a, b) => a.time.localeCompare(b.time))[0];
  const next = nextBlock
    ? { title: nextBlock.title, timeLabel: formatTimeLabel(nextBlock.time), screen: nextBlock.module === 'dialing' ? 'dialing' : 'daily-plan' }
    : tomorrowFirst
    ? { title: tomorrowFirst.title, timeLabel: `tomorrow ${formatTimeLabel(tomorrowFirst.time)}`, screen: 'daily-plan' }
    : null;
  const overdue = reminders.filter((r) => !r.done && r.due_date < dateStr(new Date())).length;

  const d: OverviewData = {
    dials: strip.dials, goal: strip.goal, callStart: strip.callStart, state: strip.state, dialsLoading: strip.loading,
    next, planLoading, overdue,
    sobriety, workouts: weekCount, calories: totals.calories, calorieTarget: nutritionTarget?.daily_calories ?? null,
    vitalsLoading: sobrietyLoading || fitnessLoading || macrosLoading,
    queued: notConnected ? null : queueLoading ? 0 : queue.filter((l) => !l.last_called_at || new Date(l.last_called_at).toDateString() !== new Date().toDateString()).length,
  };
  return <CyberOverviewView d={d} isMobile={isMobile} onNavigate={onNavigate} />;
}
