import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { supabase } from '../../../lib/supabase';
import { useDailyPlan, requestPlan } from '../../../data/useDailyPlan';
import { useCallsToday } from '../../../data/useCallsToday';
import { dateStr } from '../../../data/time';
import type { DailyPlanBlock, DailyPlanModule } from '../../../data/types';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import { Bars } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule, NovaCard, useAi, AiOffCard } from '../../mm/Page';
import { addDays, clock, clockShort, lastDays, WD3, longToday } from './util';

const MODULE_LABEL: Record<DailyPlanModule, string> = { dialing: 'Dialing', fitness: 'Fitness', 'work-shift': 'Schedule', 'client-work': 'Client Modules', goal: 'Goals', manual: 'Added by you' };
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const FOCUS: DailyPlanBlock['type'][] = ['goal', 'ai_suggested'];
const fmtH = (min: number) => `${Math.round((min / 60) * 10) / 10}h`;

export default function DailyPlanV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const today = dateStr(new Date());
  const dp = useDailyPlan(today);
  const { callsToday } = useCallsToday();
  const [now, setNow] = useState(() => new Date());
  const [adding, setAdding] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [week, setWeek] = useState<{ date: string; min: number }[]>([]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const days = lastDays(7, today);
    supabase.from('daily_plans').select('plan_date, blocks').gte('plan_date', days[0]).lte('plan_date', today).then(({ data }) => {
      const by = new Map((data ?? []).map((r: { plan_date: string; blocks: DailyPlanBlock[] }) => [r.plan_date, r.blocks]));
      setWeek(days.map((d) => ({ date: d, min: (by.get(d) ?? []).filter((b) => FOCUS.includes(b.type)).reduce((s, b) => s + (b.duration || 0), 0) })));
    });
  }, [today, dp.plan]);

  const blocks = useMemo(() => [...(dp.plan?.blocks ?? [])].sort((a, b) => a.time.localeCompare(b.time)), [dp.plan]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowIdx = blocks.findIndex((b) => toMin(b.time) > nowMin);
  const next = blocks.find((b) => toMin(b.time) >= nowMin && !b.done);
  const doneN = blocks.filter((b) => b.done).length;
  const focusMin = blocks.filter((b) => FOCUS.includes(b.type)).reduce((s, b) => s + (b.duration || 0), 0);
  const plannedMin = blocks.reduce((s, b) => s + (b.duration || 0), 0);

  const toggle = async (b: DailyPlanBlock) => {
    const i = (dp.plan?.blocks ?? []).indexOf(b);
    if (i < 0 || !dp.plan) return;
    await dp.updateBlocks(dp.plan.blocks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
  };
  const replan = async () => { setReplanning(true); await requestPlan(today); await dp.reload(); setReplanning(false); };

  const sub = `${longToday(now)}${dp.plan ? ' · built from your schedule, goals and habits' : ''}`;
  if (!dp.loading && !dp.generating && blocks.length === 0) {
    return (
      <Page title="Today" sub={sub} back="Home" backTo="home" fab={{ t: 'Add block', onClick: () => setAdding(true) }}>
        <Empty text="No plan yet. Add your schedule or a goal and Nova builds today from it." cta={replanning ? 'Building…' : "Build today's plan"} onCta={() => void replan()} />
        {ai === false && <AiOffCard text="Without AI, Daily Plan lists your schedule and habits in time order, and you arrange the day yourself." />}
        {adding && <AddBlock onClose={() => setAdding(false)} onAdd={dp.addBlock} />}
      </Page>
    );
  }

  const nowLine = (
    <div key="now" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
      <span style={{ width: 44, textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{clockShort(`${now.getHours()}:${now.getMinutes()}`)}</span>
      <div style={{ width: 12, display: 'flex', justifyContent: 'center' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /></div>
      <div style={{ flex: 1, height: 1, background: 'var(--accent)' }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>Now</span>
    </div>
  );
  const item = (b: DailyPlanBlock, i: number) => {
    const past = toMin(b.time) + (b.duration || 0) <= nowMin;
    const isNext = b === next;
    return (
      <div key={`${b.time}-${i}`} style={{ display: 'flex', gap: 8 }}>
        <span style={{ width: 44, flex: 'none', textAlign: 'right', paddingTop: 12, fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{clockShort(b.time)}</span>
        <div style={{ width: 12, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginTop: 16, width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', background: past || b.done ? 'var(--text-tertiary)' : isNext ? 'var(--accent)' : 'transparent', border: `1.5px solid ${isNext ? 'var(--accent)' : 'var(--text-tertiary)'}` }} />
          <div style={{ flex: 1, width: 1, background: 'var(--grid)' }} />
        </div>
        <button onClick={() => void toggle(b)} aria-pressed={!!b.done} title={b.done ? 'Mark not done' : 'Mark done'} style={{ flex: 1, minWidth: 0, margin: '3px 0', padding: '10px 12px', borderRadius: 10, background: isNext ? 'var(--surface-3)' : 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', border: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ color: b.done ? 'var(--text-secondary)' : 'var(--text)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>{b.title}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{[b.detail || MODULE_LABEL[b.module], b.duration ? (b.duration >= 60 ? fmtH(b.duration) : `${b.duration} min`) : ''].filter(Boolean).join(' · ')}</span>
          </div>
          {b.done && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
        </button>
      </div>
    );
  };
  const rows: ReactElement[] = [];
  blocks.forEach((b, i) => { if (i === nowIdx) rows.push(nowLine); rows.push(item(b, i)); });
  if (nowIdx === -1 && blocks.length) rows.push(nowLine);

  const timeline = (
    <Card title="Timeline" meta={`Now ${clock(now)}`} wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{rows}</div>
    </Card>
  );
  const why = <NovaCard title="Why this order" paras={[]} aiOff="Without AI, Daily Plan lists your schedule and habits in time order, and you arrange the day yourself." />;
  const focus = (
    <Card title="Focus hours" meta="Last 7 days" wide={!phone}>
      <Bars vals={week.map((w) => Math.round((w.min / 60) * 10) / 10)} labels={week.map((w, i) => (i === week.length - 1 ? 'Today' : WD3[new Date(`${w.date}T00:00:00`).getDay()]))} pre="" suf="h" dec={1} h={140} />
    </Card>
  );
  const stats = [
    <Stat key="f" label="Focus time" value={fmtH(focusMin)} pill={`${fmtH(plannedMin)} planned`} />,
    <Stat key="d" label="Done" value={`${doneN} of ${blocks.length}`} pill={blocks.length - doneN ? `${blocks.length - doneN} left today` : 'All done'} k={blocks.length && doneN === blocks.length ? 'good' : 'neutral'} />,
    <Stat key="c" label="Calls made" value={String(callsToday)} pill="Today" />,
    <Stat key="n" label="Next up" value={next ? clock(next.time) : '—'} pill={next ? next.title : 'Nothing left'} k={next ? 'warn' : 'neutral'} />,
  ];
  return (
    <Page title="Today" sub={sub} back="Home" backTo="home" right={{ t: replanning ? 'Replanning…' : 'Replan', onClick: () => void replan() }} fab={phone ? undefined : { t: 'Add block', onClick: () => setAdding(true) }}
      menu={[{ t: 'Add a block', onClick: () => setAdding(true) }, { t: 'Tomorrow’s plan', onClick: () => void requestPlan(addDays(today, 1)) }]}>
      {phone ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats.slice(0, 2)}</div>
          {timeline}
          {why}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1', gridRow: three ? 'span 2' : undefined }}>{timeline}</div>
            {why}
            {focus}
          </div>
        </>
      )}
      {adding && <AddBlock onClose={() => setAdding(false)} onAdd={dp.addBlock} />}
    </Page>
  );
}

function AddBlock({ onClose, onAdd }: { onClose: () => void; onAdd: (b: DailyPlanBlock) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(() => { const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1); return `${String(d.getHours()).padStart(2, '0')}:00`; });
  const [dur, setDur] = useState('60');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add a block" onClose={onClose}>
      <Field l="What"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} style={field} placeholder="Deep work: proposal" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Start"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={field} /></Field>
        <Field l="Minutes"><input inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} style={field} /></Field>
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !title.trim()} onClick={async () => { setBusy(true); await onAdd({ time, duration: Number(dur) || 30, title: title.trim(), detail: '', type: 'fixed', module: 'manual', source: null }); setBusy(false); onClose(); }}>{busy ? 'Adding…' : 'Add to today'}</button>
    </Sheet>
  );
}
