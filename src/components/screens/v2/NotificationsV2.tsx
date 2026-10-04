import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNotificationSettings } from '../../../data/useNotificationSettings';
import { useReminders } from '../../../data/useReminders';
import { useNudges } from '../../../data/useNudges';
import type { NudgeSettings } from '../../../data/useNudges';
import type { NotificationSettings } from '../../../data/types';
import { isNotificationSupported, requestNotificationPermission } from '../../../lib/notifications';
import { subscribeToPush } from '../../../lib/push';
import { dateStr } from '../../../data/time';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Switch from '../../mm/Switch';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';
import { shortDate, clock } from './util';

function ToggleRow({ label, sub, on, onChange, first }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <Switch on={on} onChange={onChange} label={label} />
    </div>
  );
}
const TimeField = ({ l, children }: { l: string; children: ReactNode }) => <Field l={l}>{children}</Field>;

/** Settings → Notifications: categories, meal times, reminders, nudges. */
export default function NotificationsV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', two = !phone && !(device === 'ipad' && novaOpen);
  const { settings, loading, save } = useNotificationSettings();
  const { reminders, addReminder, markDone, deleteReminder } = useReminders();
  const { settings: ns, saveSettings: saveNudge, loading: nLoading } = useNudges();
  const [perm, setPerm] = useState<NotificationPermission>(() => (isNotificationSupported() ? Notification.permission : 'denied'));
  const [adding, setAdding] = useState(false);
  const t = (k: keyof NotificationSettings) => (v: boolean) => save({ [k]: v } as Partial<NotificationSettings>);
  const tn = (k: keyof NudgeSettings) => (v: boolean) => saveNudge({ [k]: v } as Partial<NudgeSettings>);
  const enable = async () => { const r = await requestNotificationPermission(); setPerm(r); if (r === 'granted') subscribeToPush(); };

  const status = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Alerts on this device</span>
        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{perm === 'granted' ? 'On. Reminders fire even with the app closed.' : perm === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site, then come back.' : 'Turn on alerts to get anything below.'}</span>
      </div>
      {perm === 'granted' ? <Chip k="good">On</Chip> : perm !== 'denied' && isNotificationSupported() && <button className="mm-btn mm-btn--primary" onClick={enable}>Enable alerts</button>}
    </section>
  );
  const cats = (
    <Card title="Categories" flush>
      {!loading && <div style={{ paddingBottom: 6 }}>
        <ToggleRow first label="Shifts" sub="Evening before and 60 min before a shift" on={settings.shifts_enabled} onChange={t('shifts_enabled')} />
        <ToggleRow label="Events" sub="24 hours and 1 hour before appointments" on={settings.events_enabled} onChange={t('events_enabled')} />
        <ToggleRow label="Meals" sub="Log-your-meal nudges, skipped if already logged" on={settings.meals_enabled} onChange={t('meals_enabled')} />
        <ToggleRow label="Workouts" sub="60 min before and at your plan's workout time" on={settings.workouts_enabled} onChange={t('workouts_enabled')} />
        <ToggleRow label="Opening / Closing" sub="Step-by-step reminders during your shift" on={settings.opening_closing_enabled} onChange={t('opening_closing_enabled')} />
      </div>}
    </Card>
  );
  const meals = (
    <Card title="Meal reminder times">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        <TimeField l="Breakfast"><input type="time" value={settings.breakfast_time} onChange={(e) => save({ breakfast_time: e.target.value })} style={field} /></TimeField>
        <TimeField l="Lunch"><input type="time" value={settings.lunch_time} onChange={(e) => save({ lunch_time: e.target.value })} style={field} /></TimeField>
        <TimeField l="Dinner"><input type="time" value={settings.dinner_time} onChange={(e) => save({ dinner_time: e.target.value })} style={field} /></TimeField>
      </div>
    </Card>
  );
  const rem = (
    <Card title="Reminders" flush action={<button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => setAdding(true)}>Add</button>}>
      <div style={{ paddingBottom: 6 }}>
        {reminders.length === 0 && <div style={{ padding: '8px 0 12px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing on the list.</div>}
        {reminders.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>{r.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.recurring ? 'Every day' : shortDate(r.due_date)}{r.due_time ? ` · ${clock(r.due_time.slice(0, 5))}` : ' · all day'}</div>
            </div>
            <button className="mm-btn" style={{ height: 32, fontSize: 13, padding: '0 10px' }} onClick={() => markDone(r.id)}>Done</button>
            <button className="mm-icon-btn" aria-label="Delete reminder" style={{ width: 32, height: 32 }} onClick={() => deleteReminder(r.id)}>×</button>
          </div>
        ))}
      </div>
    </Card>
  );
  const nudges = (
    <Card title="Accountability nudges" meta="From your own data" flush>
      {!nLoading && <div>
        <ToggleRow first label="Missed check-ins" sub="A sobriety streak breaks" on={ns.missed_checkin_enabled} onChange={tn('missed_checkin_enabled')} />
        <ToggleRow label="Budget" sub="A category goes over its monthly amount" on={ns.budget_enabled} onChange={tn('budget_enabled')} />
        <ToggleRow label="Activity drop-off" sub="Calls or invoicing fall off vs last week" on={ns.activity_dropoff_enabled} onChange={tn('activity_dropoff_enabled')} />
        <ToggleRow label="Goal pace" sub="A deadline is close and progress is short" on={ns.goal_pace_enabled} onChange={tn('goal_pace_enabled')} />
        <ToggleRow label="Subscriptions" sub="An unused subscription is about to renew" on={ns.subscription_enabled} onChange={tn('subscription_enabled')} />
        <ToggleRow label="Cold follow-ups" sub="An overdue callback in Dialing or Contacts" on={ns.cold_followup_enabled} onChange={tn('cold_followup_enabled')} />
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, padding: '12px 0 14px', borderTop: '1px solid var(--grid)' }}>
        <Field l="Max per day"><input type="number" min={1} max={20} value={ns.daily_cap} onChange={(e) => saveNudge({ daily_cap: Number(e.target.value) })} style={field} /></Field>
        <Field l="Quiet from"><input type="time" value={ns.quiet_hours_start ?? ''} onChange={(e) => saveNudge({ quiet_hours_start: e.target.value || null })} style={field} /></Field>
        <Field l="Quiet until"><input type="time" value={ns.quiet_hours_end ?? ''} onChange={(e) => saveNudge({ quiet_hours_end: e.target.value || null })} style={field} /></Field>
      </div>
    </Card>
  );
  return (
    <Page title="Notifications" sub="What you get alerted about, and when" back="Settings" backTo="account-settings" fab={{ t: 'Reminder', onClick: () => setAdding(true) }}>
      {status}
      {two ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{cats}{meals}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{rem}{nudges}</div>
        </div>
      ) : <>{cats}{meals}{rem}{nudges}</>}
      {adding && <AddReminder onClose={() => setAdding(false)} onAdd={addReminder} />}
    </Page>
  );
}

function AddReminder({ onClose, onAdd }: { onClose: () => void; onAdd: ReturnType<typeof useReminders>['addReminder'] }) {
  const [title, setTitle] = useState(''); const [date, setDate] = useState(dateStr(new Date())); const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(true); const [daily, setDaily] = useState(false); const [busy, setBusy] = useState(false);
  return (
    <Sheet title="New reminder" onClose={onClose}>
      <Field l="What"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Renew LLC filing" style={field} /></Field>
      <Field l="Due"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} /></Field>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: 'var(--text)', fontSize: 15 }}>All day</span><Switch on={allDay} onChange={setAllDay} label="All day" /></div>
      {!allDay && <Field l="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={field} /></Field>}
      {!allDay && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: 'var(--text)', fontSize: 15 }}>Repeat every day</span><Switch on={daily} onChange={setDaily} label="Repeat every day" /></div>}
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !title.trim()} onClick={async () => { setBusy(true); await onAdd({ title: title.trim(), due_date: date, due_time: allDay ? null : time || null, recurring: daily }); setBusy(false); onClose(); }}>Add reminder</button>
    </Sheet>
  );
}
