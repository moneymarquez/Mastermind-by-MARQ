import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useNotificationSettings } from '../../data/useNotificationSettings';
import { useReminders } from '../../data/useReminders';
import { useNudges } from '../../data/useNudges';
import type { NudgeSettings } from '../../data/useNudges';
import { isNotificationSupported, requestNotificationPermission } from '../../lib/notifications';
import { subscribeToPush } from '../../lib/push';
import { dateStr } from '../../data/time';
import type { NotificationSettings } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 22, maxWidth: 520 };
const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

function ToggleRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #1c1e23' }}>
      <div>
        <div style={{ fontSize: 13.5, color: '#F5F6F7', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 2 }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 999, cursor: 'pointer', flexShrink: 0, position: 'relative',
          background: checked ? '#F5F6F7' : '#22262B', transition: 'background 0.15s ease',
        }}
      >
        <div
          style={{
            position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
            background: checked ? '#0A0B0D' : '#565b64', transition: 'left 0.15s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function NotificationSettingsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { settings, loading, save } = useNotificationSettings();
  const { reminders, addReminder, markDone, deleteReminder } = useReminders();
  const { settings: nudgeSettings, saveSettings: saveNudgeSettings, loading: nudgesLoading } = useNudges();
  const [permission, setPermission] = useState<NotificationPermission>(() => (isNotificationSupported() ? Notification.permission : 'denied'));

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(dateStr(new Date()));
  const [newTime, setNewTime] = useState('');
  const [newAllDay, setNewAllDay] = useState(true);

  const enableAlerts = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') subscribeToPush();
  };

  const submitReminder = async () => {
    if (!newTitle.trim()) return;
    await addReminder({ title: newTitle.trim(), due_date: newDate, due_time: newAllDay ? null : newTime || null });
    setNewTitle('');
    setNewTime('');
  };

  const toggle = (key: keyof NotificationSettings) => (v: boolean) => save({ [key]: v } as Partial<NotificationSettings>);
  const toggleNudge = (key: keyof NudgeSettings) => (v: boolean) => saveNudgeSettings({ [key]: v } as Partial<NudgeSettings>);

  return (
    <div>
      <div style={homeHeadStyle}>Notifications</div>
      <div style={homeSubStyle}>What you get alerted about, and when — reminders fire even with the app closed once alerts are enabled below.</div>

      {isNotificationSupported() && permission !== 'granted' && (
        <div style={{ ...cardStyle, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#C7CAD1' }}>
            {permission === 'denied' ? 'Notifications are blocked in your browser settings.' : 'Enable notifications to receive any of the alerts below.'}
          </div>
          {permission !== 'denied' && <div style={primaryBtn} onClick={enableAlerts}>Enable alerts</div>}
        </div>
      )}
      {permission === 'granted' && <div style={{ fontSize: 12, color: '#565b64', marginTop: 12 }}>Alerts on.</div>}

      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase' }}>Categories</div>
        {!loading && (
          <>
            <ToggleRow label="Shifts" sub="Evening-before + 60 min before a scheduled shift" checked={settings.shifts_enabled} onChange={toggle('shifts_enabled')} />
            <ToggleRow label="Events" sub="24 hours + 1 hour before appointments and reminders" checked={settings.events_enabled} onChange={toggle('events_enabled')} />
            <ToggleRow label="Meals" sub="Log-your-meal nudges, skipped if already logged" checked={settings.meals_enabled} onChange={toggle('meals_enabled')} />
            <ToggleRow label="Workouts" sub="60 min before + at your active Lock In plan's daily workout time" checked={settings.workouts_enabled} onChange={toggle('workouts_enabled')} />
            <ToggleRow label="Opening/Closing tasks" sub="Task-by-task reminders during your shift" checked={settings.opening_closing_enabled} onChange={toggle('opening_closing_enabled')} />
          </>
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase', marginBottom: 14 }}>Meal reminder times</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Breakfast</label>
            <input type="time" style={inputStyle} value={settings.breakfast_time} onChange={(e) => save({ breakfast_time: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Lunch</label>
            <input type="time" style={inputStyle} value={settings.lunch_time} onChange={(e) => save({ lunch_time: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Dinner</label>
            <input type="time" style={inputStyle} value={settings.dinner_time} onChange={(e) => save({ dinner_time: e.target.value })} />
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase', marginBottom: 14 }}>Reminders</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Title</label>
            <input style={{ ...inputStyle, width: '100%' }} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Renew LLC filing" />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Due date</label>
            <input type="date" style={inputStyle} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 9 }}>
            <input type="checkbox" checked={newAllDay} onChange={(e) => setNewAllDay(e.target.checked)} />
            <span style={{ fontSize: 12, color: '#8A8F98' }}>All-day</span>
          </div>
          {!newAllDay && (
            <div>
              <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Time</label>
              <input type="time" style={inputStyle} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
          )}
          <div style={primaryBtn} onClick={submitReminder}>Add</div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reminders.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: '#101114', border: '1px solid #22262B', borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: '#C7CAD1' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#565b64', marginTop: 2 }}>{r.due_date}{r.due_time ? ` · ${r.due_time.slice(0, 5)}` : ' · all-day'}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => markDone(r.id)}>Done</span>
                <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => deleteReminder(r.id)}>Delete</span>
              </div>
            </div>
          ))}
          {reminders.length === 0 && <div style={{ fontSize: 12.5, color: '#565b64' }}>Nothing on the list.</div>}
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase' }}>Accountability nudges</div>
        <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 4 }}>Proactive, data-driven check-ins — not generic reminders.</div>
        {!nudgesLoading && (
          <>
            <ToggleRow label="Missed check-ins" sub="Broken sobriety streaks" checked={nudgeSettings.missed_checkin_enabled} onChange={toggleNudge('missed_checkin_enabled')} />
            <ToggleRow label="Budget" sub="A category goes over its monthly allocation" checked={nudgeSettings.budget_enabled} onChange={toggleNudge('budget_enabled')} />
            <ToggleRow label="Activity drop-off" sub="Call volume or invoicing falls off compared to the prior week" checked={nudgeSettings.activity_dropoff_enabled} onChange={toggleNudge('activity_dropoff_enabled')} />
            <ToggleRow label="Goal pace" sub="A deadline is close with insufficient progress" checked={nudgeSettings.goal_pace_enabled} onChange={toggleNudge('goal_pace_enabled')} />
            <ToggleRow label="Subscriptions" sub="A flagged-as-unused subscription is about to renew" checked={nudgeSettings.subscription_enabled} onChange={toggleNudge('subscription_enabled')} />
            <ToggleRow label="Cold follow-ups" sub="An overdue callback in Dialing/Contacts" checked={nudgeSettings.cold_followup_enabled} onChange={toggleNudge('cold_followup_enabled')} />
          </>
        )}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid #1c1e23' }}>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Max new nudges/day</label>
            <input type="number" min={1} max={20} style={{ ...inputStyle, width: 90 }} value={nudgeSettings.daily_cap} onChange={(e) => saveNudgeSettings({ daily_cap: Number(e.target.value) })} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Quiet hours start</label>
            <input type="time" style={inputStyle} value={nudgeSettings.quiet_hours_start ?? ''} onChange={(e) => saveNudgeSettings({ quiet_hours_start: e.target.value || null })} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 5, display: 'block' }}>Quiet hours end</label>
            <input type="time" style={inputStyle} value={nudgeSettings.quiet_hours_end ?? ''} onChange={(e) => saveNudgeSettings({ quiet_hours_end: e.target.value || null })} />
          </div>
        </div>
      </div>
    </div>
  );
}
