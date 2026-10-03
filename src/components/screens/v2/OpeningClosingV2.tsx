import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { buildSchedule, taskStatus, OPENING_TASKS, CLOSING_TASKS } from '../../../data/shiftChecklist';
import type { ScheduledTask } from '../../../data/shiftChecklist';
import { useShiftChecklist } from '../../../data/useShiftChecklist';
import { useEvents } from '../../../data/useEvents';
import { useHolidayShifts } from '../../../data/useHolidayShifts';
import { dateStr } from '../../../data/time';
import { isNotificationSupported, notify, requestNotificationPermission } from '../../../lib/notifications';
import { isStandalone } from '../../../lib/pwa';
import { subscribeToPush } from '../../../lib/push';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Bars, Ring } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, useModule } from '../../mm/Page';
import { addDays, shortDate, WD3 } from './util';

type Phase = 'opening' | 'closing';
const HOME_KEY = 'mastermind-home-screen-prompt-dismissed';
const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const inPhase = (t: ScheduledTask, p: Phase) => (p === 'opening' ? t.kind === 'opening' : t.kind === 'closing' || t.kind === 'till');
const CLOSE_IDS = [...CLOSING_TASKS.map((_, i) => `closing-${i}`), 'till-count'];
const OPEN_IDS = OPENING_TASKS.map((_, i) => `opening-${i}`);
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export default function OpeningClosingV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const { completedIds, loading, toggleTask } = useShiftChecklist();
  const { events, loading: evLoading } = useEvents();
  const { shifts } = useHolidayShifts();
  const [tick, setTick] = useState(0);
  const now = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const schedule = useMemo(() => buildSchedule(now), [now]);
  const midday = new Date(schedule.openTime.getTime() + (schedule.closeTime.getTime() - schedule.openTime.getTime()) / 2);
  const [phase, setPhase] = useState<Phase>(() => (new Date() < midday ? 'opening' : 'closing'));
  const [perm, setPerm] = useState<NotificationPermission>(() => (isNotificationSupported() ? Notification.permission : 'denied'));
  const [homePrompt, setHomePrompt] = useState(() => !isStandalone() && lsGet(HOME_KEY) !== '1');
  const [history, setHistory] = useState<{ date: string; ids: string[] }[]>([]);
  const fired = useRef<Set<string>>(new Set());
  const today = dateStr(now);

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { if (perm === 'granted') subscribeToPush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void supabase.from('shift_checklist_state').select('checklist_date, completed_task_ids').gte('checklist_date', addDays(today, -21)).lt('checklist_date', today).order('checklist_date')
      .then(({ data }) => setHistory(((data ?? []) as { checklist_date: string; completed_task_ids: string[] }[]).map((r) => ({ date: r.checklist_date, ids: r.completed_task_ids ?? [] }))));
  }, [today]);

  // Same gate as before: only on a day you actually have a shift.
  const hasShift = events.some((e) => e.type === 'holiday' && e.event_date === today) || shifts.some((s) => s.is_self && s.shift_date === today);

  // Notify once per task / milestone as its time is crossed, only if it was crossed in the last 5 minutes.
  useEffect(() => {
    if (!hasShift) return;
    const done = new Set(completedIds);
    for (const t of schedule.tasks) {
      if (fired.current.has(t.id) || done.has(t.id)) continue;
      const d = now.getTime() - t.at.getTime();
      if (d >= 0) { fired.current.add(t.id); if (d < 5 * 60000) notify(t.name, `Scheduled for ${clock(t.at)}`); }
    }
    for (const m of schedule.milestones) {
      if (fired.current.has(m.id)) continue;
      const d = now.getTime() - m.at.getTime();
      if (d >= 0) { fired.current.add(m.id); if (d < 5 * 60000) notify('Mastermind', m.message); }
    }
  }, [tick, hasShift]); // eslint-disable-line react-hooks/exhaustive-deps

  const enable = async () => { const r = await requestNotificationPermission(); setPerm(r); if (r === 'granted') subscribeToPush(); };
  const alertsBtn = isNotificationSupported() && perm !== 'granted' ? { t: perm === 'denied' ? 'Alerts blocked' : 'Turn on alerts', onClick: () => void enable() } : undefined;
  const hours = `${clock(schedule.openTime)} – ${clock(schedule.closeTime)}`;

  if (!evLoading && !hasShift) {
    return (
      <Page title="Opening / Closing" sub={`${WD3[now.getDay()]} · not scheduled today`} right={alertsBtn}>
        <Empty text="The checklist shows up on days you have a shift. Add one in Schedule under Holiday Calendar and check This is my shift." />
      </Page>
    );
  }

  const tasks = schedule.tasks.filter((t) => inPhase(t, phase));
  const nudges = schedule.tasks.filter((t) => t.kind === 'nudge');
  const done = new Set(completedIds);
  const doneN = tasks.filter((t) => done.has(t.id)).length;
  const last = tasks[tasks.length - 1];
  const left = tasks.filter((t) => !done.has(t.id));
  const late = left.some((t) => taskStatus(t, now, false) === 'overdue');
  const ids = phase === 'opening' ? OPEN_IDS : CLOSE_IDS;
  const past = history.filter((h) => h.ids.some((i) => ids.includes(i))).slice(-7);
  const full = past.filter((h) => ids.every((i) => h.ids.includes(i))).length;
  const curIdx = tasks.findIndex((t) => !done.has(t.id));

  const seg = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: phone ? undefined : 320 }}>
      {(['opening', 'closing'] as Phase[]).map((p) => <button key={p} aria-pressed={phase === p} onClick={() => setPhase(p)} style={{ padding: '8px 0', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: phase === p ? 'var(--text)' : 'transparent', color: phase === p ? 'var(--bg)' : 'var(--text-secondary)' }}>{p === 'opening' ? 'Opening' : 'Closing'}</button>)}
    </div>
  );
  const ring = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
      <Ring pcts={[tasks.length ? doneN / tasks.length : 0]} center={`${doneN}/${tasks.length}`} sub="done" size={120} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{phase === 'opening' ? 'Opening' : 'Closing'} · {hours}</span>
        <span style={{ color: 'var(--text)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em' }}>{left.length ? `${left.length} ${left.length === 1 ? 'step' : 'steps'} left` : 'All done'}</span>
        {last && <span style={{ alignSelf: 'flex-start' }}><Chip k={!left.length ? 'good' : late ? 'bad' : 'good'}>{!left.length ? 'Done' : late ? 'Behind' : `On time · due ${clock(last.endAt)}`}</Chip></span>}
      </div>
    </section>
  );
  const list = (
    <Card title="Checklist" meta={`${tasks.length} steps`} wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tasks.map((t, i) => {
          const isDone = done.has(t.id), st = taskStatus(t, now, isDone), cur = i === curIdx;
          return (
            <button key={t.id} onClick={() => void toggleTask(t.id)} aria-pressed={isDone} style={{ display: 'flex', gap: 12, padding: 0, border: 0, background: 'transparent', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', width: '100%' }}>
              <div style={{ width: 22, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', background: isDone ? 'var(--accent)' : 'transparent', border: isDone ? 'none' : cur ? '2px solid var(--accent)' : '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: 11, fontWeight: 700 }}>{isDone ? '✓' : ''}</div>
                <div style={{ flex: 1, width: 2, minHeight: 12, background: i === tasks.length - 1 ? 'transparent' : isDone ? 'var(--accent)' : 'var(--grid)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1px 0 14px', minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ color: isDone ? 'var(--text-tertiary)' : 'var(--text)', fontSize: 14.5, fontWeight: cur ? 600 : 500, textDecoration: isDone ? 'line-through' : 'none' }}>{t.name}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{clock(t.at)} · {t.duration} min{t.kind === 'till' ? ' · final' : ''}</span>
                </div>
                {!isDone && st === 'overdue' && <Chip k="bad">Overdue</Chip>}
                {!isDone && st === 'current' && <Chip k="accent">Now</Chip>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
  const steady = nudges.length > 0 && (
    <Card title="While it's steady" meta={`${nudges.filter((n) => done.has(n.id)).length} of ${nudges.length}`} flush wide={!phone}>
      <div style={{ paddingBottom: 10 }}>{nudges.map((n, i) => (
        <button key={n.id} onClick={() => void toggleTask(n.id)} aria-pressed={done.has(n.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, width: '100%', padding: '12px 0', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ color: done.has(n.id) ? 'var(--text-tertiary)' : 'var(--text)', fontSize: 15, fontWeight: 500, textDecoration: done.has(n.id) ? 'line-through' : 'none' }}>{n.name}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{clock(n.at)}</span>
        </button>
      ))}</div>
    </Card>
  );
  const hist = past.length > 0 && (
    <Card title={`Steps done · last ${past.length} ${phase === 'opening' ? 'openings' : 'closes'}`} meta={`${full} complete`} wide={!phone}>
      <Bars vals={past.map((h) => h.ids.filter((x) => ids.includes(x)).length)} labels={past.map((h) => shortDate(h.date))} pre="" max={ids.length} />
    </Card>
  );
  const prompt = homePrompt && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>Add this app to your home screen to get step reminders even when it's closed.</span>
      <button className="mm-btn" style={{ height: 34 }} onClick={() => { try { localStorage.setItem(HOME_KEY, '1'); } catch { /* fine */ } setHomePrompt(false); }}>Got it</button>
    </div>
  );

  return (
    <Page title={phase === 'opening' ? 'Opening' : 'Closing'} sub={`${WD3[now.getDay()]} · store hours ${hours}`} back="All modules" right={alertsBtn}>
      {seg}
      {loading ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading today's checklist…</span> : phone ? (
        <>{ring}{list}{steady}{hist}{prompt}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label={phase === 'opening' ? 'This morning' : 'Tonight'} value={`${doneN} of ${tasks.length}`} pill={left.length ? `${left.length} steps left` : 'All done'} k={left.length ? 'neutral' : 'good'} />
            <Stat label="Due by" value={last ? clock(last.endAt) : '—'} pill={late ? 'Behind' : 'On time'} k={late ? 'bad' : 'good'} />
            <Stat label={`Last ${past.length || 7} ${phase === 'opening' ? 'openings' : 'closes'}`} value={past.length ? `${full} complete` : '—'} pill={past.length ? `${past.length - full} unfinished` : 'No history yet'} k={past.length && full < past.length ? 'warn' : 'neutral'} />
            <Stat label="Alerts" value={perm === 'granted' ? 'On' : 'Off'} pill={perm === 'granted' ? 'Push reminders' : perm === 'denied' ? 'Blocked in browser' : 'Tap Turn on alerts'} k={perm === 'granted' ? 'good' : 'neutral'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{ring}{steady}</div>
            <div style={{ gridColumn: three ? 'span 2' : 'auto', minWidth: 0 }}>{list}</div>
            {hist}
          </div>
          {prompt}
        </>
      )}
    </Page>
  );
}
