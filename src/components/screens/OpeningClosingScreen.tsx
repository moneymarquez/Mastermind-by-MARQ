import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { buildSchedule, taskStatus } from '../../data/shiftChecklist';
import type { TaskStatus } from '../../data/shiftChecklist';
import { useShiftChecklist } from '../../data/useShiftChecklist';
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
  done: '#565b64',
  current: '#F5F6F7',
  upcoming: '#8A8F98',
  overdue: '#c47a7a',
};

export default function OpeningClosingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { completedIds, loading, toggleTask } = useShiftChecklist();
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

  useEffect(() => {
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
  }, [tick]);

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
          <div style={homeSubStyle}>{weekdayName} · store hours {hoursLabel}</div>
        </div>
        {isNotificationSupported() && permission !== 'granted' && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, cursor: 'pointer' }}
            onClick={enableAlerts}
          >
            {permission === 'denied' ? 'Alerts blocked — check browser settings' : 'Enable task alerts'}
          </div>
        )}
        {permission === 'granted' && <div style={{ fontSize: 12, color: '#565b64' }}>Alerts on</div>}
      </div>

      {showHomeScreenPrompt && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#14161A', border: '1px solid #22262B', borderRadius: 12, padding: '12px 16px', marginTop: 16, maxWidth: 560 }}>
          <span style={{ fontSize: 12.5, color: '#C7CAD1' }}>Add this to your home screen to get task reminders.</span>
          <span style={{ fontSize: 16, color: '#565b64', cursor: 'pointer', flexShrink: 0 }} onClick={dismissHomeScreenPrompt}>×</span>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 12, maxWidth: 560, lineHeight: 1.5 }}>
        Auto-detected from your device's clock — no need to enter today's date. Re-checks every minute while open; the current task is highlighted.
        With alerts enabled, a reminder also fires as a real push notification even with the app fully closed
        (checked server-side every 5 minutes) — on iOS this requires installing to your home screen first.
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
        {schedule.tasks.map((task) => {
          const done = completedIds.includes(task.id);
          const status = taskStatus(task, now, done);
          const isCurrent = status === 'current';
          return (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderBottom: '1px solid #1c1e23',
                background: isCurrent ? '#1a1c21' : '#101114', cursor: 'pointer',
                borderLeft: isCurrent ? '3px solid #F5F6F7' : '3px solid transparent',
              }}
            >
              <input type="checkbox" checked={done} readOnly style={{ marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#565b64', fontFamily: "'JetBrains Mono', monospace" }}>{clockLabel(task.at)}</span>
                  {task.kind === 'nudge' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: '#8A8F98', border: '1px solid #22262B', borderRadius: 999, padding: '1px 7px' }}>
                      WHILE STEADY
                    </span>
                  )}
                  {task.kind === 'till' && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: '#8A8F98', border: '1px solid #22262B', borderRadius: 999, padding: '1px 7px' }}>
                      FINAL
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13.5, marginTop: 3, color: STATUS_COLOR[status],
                    fontWeight: isCurrent ? 600 : 400,
                    textDecoration: status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {task.name}
                </div>
                {status === 'overdue' && <div style={{ fontSize: 10.5, color: '#c47a7a', marginTop: 2 }}>Overdue</div>}
              </div>
            </div>
          );
        })}
        {!loading && schedule.tasks.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>Nothing scheduled today.</div>
        )}
      </div>
    </div>
  );
}
