import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { buildSchedule, taskStatus } from '../../data/shiftChecklist';
import type { TaskStatus } from '../../data/shiftChecklist';
import { useShiftChecklist } from '../../data/useShiftChecklist';
import { useEvents } from '../../data/useEvents';
import { dateStr } from '../../data/time';
import { isNotificationSupported, notify, requestNotificationPermission } from '../../lib/notifications';
import { isStandalone } from '../../lib/pwa';
import { subscribeToPush } from '../../lib/push';

const HOME_SCREEN_PROMPT_KEY = 'mastermind-home-screen-prompt-dismissed';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

function clockLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  done: 'var(--text-tertiary)',
  current: 'var(--text)',
  upcoming: 'var(--text-secondary)',
  overdue: '#c47a7a',
};

export default function OpeningClosingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { completedIds, loading, toggleTask } = useShiftChecklist();
  const { events, loading: eventsLoading } = useEvents();
  const [tick, setTick] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>(() => (isNotificationSupported() ? Notification.permission : 'denied'));
  const [showHomeScreenPrompt, setShowHomeScreenPrompt] = useState(
    () => !isStandalone() && localStorage.getItem(HOME_SCREEN_PROMPT_KEY) !== '1'
  );
  const firedRef = useRef<Set<string>>(new Set());

  const dismissHomeScreenPrompt = () => {
    localStorage.setItem(HOME_SCREEN_PROMPT_KEY, '1');
    setShowHomeScreenPrompt(false);
  };

  // Re-check every 60s — this is what re-detects the current time and
  // re-evaluates task status/notifications without any user input.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(), [tick]);
  const schedule = useMemo(() => buildSchedule(now), [now]);

  // Store hours cover every day of the week, but that doesn't mean you're
  // actually working today — buildSchedule() has no idea. Gate the whole
  // checklist (and its notifications) on an actual holiday-type shift for
  // today, same source of truth as the Schedule calendar, so this only ever
  // shows up on days you're really scheduled to work.
  const todayStr = dateStr(now);
  const hasShiftToday = events.some((e) => e.type === 'holiday' && e.event_date === todayStr);

  useEffect(() => {
    if (!hasShiftToday) return;
    const done = new Set(completedIds);
    // Fire a notification once per task/milestone as its time is crossed —
    // but only if we crossed it recently (within 5 min). Without that guard,
    // opening the app hours into a shift would fire every already-passed
    // task's notification at once.
    for (const task of schedule.tasks) {
      if (firedRef.current.has(task.id) || done.has(task.id)) continue;
      const deltaMs = now.getTime() - task.at.getTime();
      if (deltaMs >= 0) {
        firedRef.current.add(task.id);
        if (deltaMs < 5 * 60000) notify(task.name, `Scheduled for ${clockLabel(task.at)}`);
      }
    }
    for (const m of schedule.milestones) {
      if (firedRef.current.has(m.id)) continue;
      const deltaMs = now.getTime() - m.at.getTime();
      if (deltaMs >= 0) {
        firedRef.current.add(m.id);
        if (deltaMs < 5 * 60000) notify('Mastermind', m.message);
      }
    }
    // Deliberately keyed on tick, not schedule/completedIds — this should
    // only re-scan once per minute, not on every completion toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, hasShiftToday]);

  const enableAlerts = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') subscribeToPush();
  };

  // Already granted from a previous visit — make sure the push subscription
  // still exists server-side (e.g. first run after this feature shipped, or
  // browser storage got cleared). Cheap no-op if already subscribed.
  useEffect(() => {
    if (permission === 'granted') subscribeToPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekdayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const hoursLabel = `${clockLabel(schedule.openTime)} – ${clockLabel(schedule.closeTime)}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Opening/Closing</div>
          <div style={homeSubStyle}>
            {weekdayName} · {hasShiftToday ? `store hours ${hoursLabel}` : "you're not scheduled to work today"}
          </div>
        </div>
        {isNotificationSupported() && permission !== 'granted' && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }}
            onClick={enableAlerts}
          >
            {permission === 'denied' ? 'Alerts blocked — check browser settings' : 'Enable task alerts'}
          </div>
        )}
        {permission === 'granted' && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Alerts on</div>}
      </div>

      {showHomeScreenPrompt && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginTop: 16, maxWidth: 560 }}>
          <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)' }}>Add this to your home screen to get task reminders.</span>
          <span style={{ fontSize: 'var(--text-head)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={dismissHomeScreenPrompt}>×</span>
        </div>
      )}

      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 12, maxWidth: 560, lineHeight: 1.5 }}>
        Auto-detected from your device's clock — no need to enter today's date. Re-checks every minute while open; the current task is highlighted.
        With alerts enabled, a reminder also fires as a real push notification even with the app fully closed
        (checked server-side every 5 minutes) — on iOS this requires installing to your home screen first.
      </div>

      {!eventsLoading && !hasShiftToday && (
        <div style={{ marginTop: 20, padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', maxWidth: 640, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)', fontWeight: 500 }}>No shift today</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
            The checklist and its task alerts only show up on days you actually have a shift scheduled — add one under
            Schedule → Holiday Calendar and it'll appear here.
          </div>
        </div>
      )}

      {hasShiftToday && (
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', maxWidth: 640 }}>
        {schedule.tasks.map((task) => {
          const done = completedIds.includes(task.id);
          const status = taskStatus(task, now, done);
          const isCurrent = status === 'current';
          return (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--surface-3)',
                background: isCurrent ? 'var(--surface-4)' : 'var(--surface-2)', cursor: 'pointer',
                borderLeft: isCurrent ? '3px solid var(--text)' : '3px solid transparent',
              }}
            >
              <input type="checkbox" checked={done} readOnly style={{ marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{clockLabel(task.at)}</span>
                  {task.kind === 'nudge' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '1px 7px' }}>
                      WHILE STEADY
                    </span>
                  )}
                  {task.kind === 'till' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '1px 7px' }}>
                      FINAL
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-body-lg)', marginTop: 3, color: STATUS_COLOR[status],
                    fontWeight: isCurrent ? 600 : 400,
                    textDecoration: status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {task.name}
                </div>
                {status === 'overdue' && <div style={{ fontSize: 'var(--text-micro)', color: '#c47a7a', marginTop: 2 }}>Overdue</div>}
              </div>
            </div>
          );
        })}
        {!loading && schedule.tasks.length === 0 && (
          <div style={{ padding: 18, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>Nothing scheduled today.</div>
        )}
      </div>
      )}
    </div>
  );
}
