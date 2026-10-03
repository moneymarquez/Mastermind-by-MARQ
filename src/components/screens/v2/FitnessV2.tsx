import { useEffect, useMemo, useState } from 'react';
import { useFitness } from '../../../data/useFitness';
import { useMacros } from '../../../data/useMacros';
import type { FitnessPlanKind, FitnessRoute, WorkoutCategory, WorkoutLibraryItem } from '../../../data/types';
import { askClaude, AiError } from '../../../lib/ai';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Bars, Ring } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule, useAi, AiOffCard } from '../../mm/Page';
import WorkoutLibraryView from '../WorkoutLibraryView';
import LockInView from '../LockInView';
import { addDays, ymd, parseYmd, shortDate, WD3 } from './util';

const CAT: Record<WorkoutCategory, string> = { running: 'Cardio', bro_split: 'Strength', back_biceps: 'Strength', chest_triceps: 'Strength', legs: 'Strength', core: 'Core' };
const CAT_LONG: Record<WorkoutCategory, string> = { running: 'Running / Walking', bro_split: 'Bro Split', back_biceps: 'Back & Biceps', chest_triceps: 'Chest & Triceps', legs: 'Legs', core: 'Core' };
const REST = 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function FitnessV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const F = useFitness();
  const { setNutritionTarget } = useMacros();
  const [live, setLive] = useState<WorkoutLibraryItem | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [view, setView] = useState<'library' | 'lockin' | 'plans' | null>(null);
  const today = ymd(new Date());

  const lastDone = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of F.workouts) if (!m.has(w.workout_type)) m.set(w.workout_type, w.workout_date);
    return m;
  }, [F.workouts]);
  // Today's pick: the library workout you've gone longest without (never done first).
  const pick = useMemo(() => [...F.library].sort((a, b) => (lastDone.get(a.name) ?? '').localeCompare(lastDone.get(b.name) ?? ''))[0] ?? null, [F.library, lastDone]);
  const doneToday = F.workouts.filter((w) => w.workout_date === today);
  const weekStart = addDays(today, -parseYmd(today).getDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Set(F.workouts.map((w) => w.workout_date));
  const month = today.slice(0, 7);
  const monthN = F.workouts.filter((w) => w.workout_date.startsWith(month)).length;
  const weekMin = F.workouts.filter((w) => w.workout_date >= weekStart).reduce((s, w) => s + (w.duration_min ?? 0), 0);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart, -7 * (7 - i)));
  const perWeek = weeks.map((w) => F.workouts.filter((x) => x.workout_date >= w && x.workout_date < addDays(w, 7)).length);

  const onPlanConfirmed = async (route: FitnessRoute) => {
    await setNutritionTarget({ goal_id: null, daily_calories: route.daily_calories, daily_protein_g: route.daily_protein_g, daily_carbs_g: route.daily_carbs_g, daily_fat_g: route.daily_fat_g, rationale: `From Lock In: ${route.label}` });
  };
  const menu = [
    { t: 'Log a workout', onClick: () => setLogOpen(true) },
    { t: 'Workout library', onClick: () => setView('library') },
    { t: 'Lock In plan', onClick: () => setView('lockin') },
    { t: 'Nova plans', onClick: () => setView('plans') },
  ];
  const sheets = (
    <>
      {live && <LiveWorkout w={live} onExit={() => setLive(null)} onFinish={async (min) => { await F.addWorkout({ workout_type: live.name, duration_min: min, distance_mi: null, notes: `From library: ${CAT_LONG[live.category]}` }); setLive(null); }} />}
      {logOpen && <LogSheet onClose={() => setLogOpen(false)} add={F.addWorkout} />}
      {view === 'library' && <Sheet title="Workout library" onClose={() => setView(null)} full><WorkoutLibraryView fitness={F} /></Sheet>}
      {view === 'lockin' && <Sheet title="Lock In plan" onClose={() => setView(null)} full><LockInView fitness={F} onPlanConfirmed={onPlanConfirmed} /></Sheet>}
      {view === 'plans' && <PlansSheet onClose={() => setView(null)} F={F} ai={ai} />}
    </>
  );

  if (!F.loading && !F.library.length && !F.workouts.length) {
    return (
      <Page title="Fitness" sub="Plan, library, live workouts" menu={menu}>
        <Empty text="No workouts yet. Load the starter library or log one you just did." cta="Open the library" onCta={() => setView('library')} />
        {sheets}
      </Page>
    );
  }

  const strip = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
      {week.map((d) => {
        const isToday = d === today, did = byDay.has(d);
        return (
          <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0', borderRadius: 10, background: isToday ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)', border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--border)', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{WD3[parseYmd(d).getDay()][0]}</span>
            <span style={{ color: d > today ? 'var(--text-tertiary)' : 'var(--text)', fontSize: 15, fontWeight: 600 }}>{parseYmd(d).getDate()}</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: did ? 'var(--accent)' : 'transparent' }} />
          </div>
        );
      })}
    </div>
  );
  const todayCard = doneToday.length ? (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Today</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--success)' }}>Done ✓</span></div>
      <span style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}>{doneToday.map((w) => w.workout_type).join(' + ')}</span>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{doneToday.reduce((s, w) => s + (w.duration_min ?? 0), 0)} min logged. Rest up.</span>
      {pick && <button className="mm-btn" style={{ height: 44 }} onClick={() => setLive(pick)}>Start another: {pick.name}</button>}
    </section>
  ) : pick ? (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Today</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{pick.exercises.length} exercises · {CAT_LONG[pick.category]}</span></div>
      <span style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}>{pick.name}</span>
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{lastDone.get(pick.name) ? `Last done ${shortDate(lastDone.get(pick.name)!)}, your longest gap.` : 'Not done yet.'}</span>
      <div>{pick.exercises.map((x, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--grid)', fontSize: 14 }}><span style={{ color: 'var(--text)' }}>{x.name}</span><span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{x.sets} × {x.reps}</span></div>)}</div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} onClick={() => setLive(pick)}>Start workout</button>
    </section>
  ) : (
    <Card title="Today" wide={!phone}><span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Load the library to get a workout picked for you each day.</span><button className="mm-btn" onClick={() => setView('library')}>Open the library</button></Card>
  );
  const library = F.library.length > 0 && (
    <Card title="Library" meta={`${F.library.length} workouts`} flush wide={!phone}>
      <div>{[...F.library].slice(0, phone ? 4 : 6).map((w, i) => <Row key={w.id} first={i === 0} name={w.name} meta={`${w.exercises.length} exercises`} chip={CAT[w.category]} sub={lastDone.get(w.name) ? `Last: ${shortDate(lastDone.get(w.name)!)}` : 'Not done yet'} onClick={() => setLive(w)} />)}</div>
      {F.library.length > (phone ? 4 : 6) && <button className="mm-btn" style={{ margin: '4px 0 14px' }} onClick={() => setView('library')}>See all {F.library.length}</button>}
    </Card>
  );
  const recent = (
    <Card title="Recent" meta={`${F.workouts.length} logged`} flush wide={!phone}>
      {F.workouts.length ? <div>{F.workouts.slice(0, 5).map((w, i) => <Row key={w.id} first={i === 0} name={w.workout_type} meta={shortDate(w.workout_date)} amt={w.duration_min ? `${w.duration_min} min` : ''} sub={w.distance_mi ? `${w.distance_mi} mi` : undefined} onClick={() => { if (window.confirm(`Remove ${w.workout_type} on ${shortDate(w.workout_date)}?`)) void F.removeWorkout(w.id); }} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing logged yet.</div>}
      <button className="mm-btn" style={{ margin: '4px 0 14px' }} onClick={() => setLogOpen(true)}>Log a workout</button>
    </Card>
  );
  const stats = [
    <Stat key="m" label="This month" value={String(monthN)} pill={monthN === 1 ? 'workout' : 'workouts'} />,
    <Stat key="w" label="This week" value={`${week.filter((d) => byDay.has(d)).length} of 7`} pill="days trained" k={week.some((d) => byDay.has(d)) ? 'good' : 'neutral'} />,
    <Stat key="min" label="Minutes this week" value={String(weekMin)} pill="logged" />,
    <Stat key="t" label="Today" value={doneToday.length ? 'Done' : pick?.name ?? '—'} pill={doneToday.length ? `${doneToday.length} logged` : pick ? `${pick.exercises.length} exercises` : 'Rest day'} k={doneToday.length ? 'good' : 'neutral'} />,
  ];
  const bars = perWeek.some(Boolean) && (
    <Card title="Workouts per week" meta="Last 8 weeks" wide={!phone}><Bars vals={perWeek} labels={weeks.map((w) => `${parseYmd(w).getMonth() + 1}/${parseYmd(w).getDate()}`)} pre="" /></Card>
  );

  return (
    <Page title="Fitness" sub={F.activeCustomPlan ? 'Following your Lock In plan' : 'Plan, library, live workouts'} menu={menu}>
      {phone ? (
        <>{strip}{todayCard}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats[0]}{stats[1]}</div>{library}{recent}{bars}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          {strip}
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {todayCard}{library}{bars || recent}{bars && recent}
          </div>
        </>
      )}
      {sheets}
    </Page>
  );
}

function LiveWorkout({ w, onExit, onFinish }: { w: WorkoutLibraryItem; onExit: () => void; onFinish: (min: number) => Promise<void> }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [ex, setEx] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const cur = w.exercises[ex];
  const sets = cur ? Array.from({ length: cur.sets }, (_, i) => i) : [];
  const doneSets = sets.filter((i) => done[`${ex}-${i}`]).length;
  const rest = restUntil ? Math.max(0, (restUntil - now) / 1000) : 0;
  const tick = (i: number) => { const k = `${ex}-${i}`; const on = !done[k]; setDone({ ...done, [k]: on }); if (on) setRestUntil(Date.now() + REST * 1000); };
  const finish = async () => { setBusy(true); await onFinish(Math.max(1, Math.round((now - start) / 60000))); };
  return (
    <Sheet title={cur ? cur.name : w.name} onClose={onExit} full>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginTop: -4 }}>{w.name} · exercise {ex + 1} of {w.exercises.length}</span>
      <section style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Elapsed</span>
        <span style={{ color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{mmss((now - start) / 1000)}</span>
      </section>
      <section style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
        <Ring pcts={[rest ? rest / REST : 0]} center={rest ? mmss(rest) : 'Go'} sub={rest ? 'rest left' : 'ready'} size={104} sw={9} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Up next</span>
          <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{cur ? (doneSets < cur.sets ? `Set ${doneSets + 1} of ${cur.sets}` : 'Exercise done') : 'All done'}</span>
          {cur && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cur.reps} reps</span>}
        </div>
      </section>
      {cur && (
        <Card title="Sets">
          {sets.map((i) => {
            const on = !!done[`${ex}-${i}`];
            return (
              <button key={i} onClick={() => tick(i)} aria-pressed={on} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 28px', alignItems: 'center', height: 44, padding: 0, border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span><span>{cur.reps} reps</span>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid var(--border)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
              </button>
            );
          })}
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="mm-btn" style={{ height: 48 }} disabled={ex === 0} onClick={() => setEx(ex - 1)}>Previous</button>
        {ex < w.exercises.length - 1 ? <button className="mm-btn mm-btn--primary" style={{ height: 48 }} onClick={() => { setEx(ex + 1); setRestUntil(null); }}>Next exercise</button>
          : <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy} onClick={() => void finish()}>{busy ? 'Saving…' : 'Finish and log'}</button>}
      </div>
      <button className="mm-btn" style={{ height: 44 }} disabled={busy} onClick={() => void finish()}>End workout and log {Math.max(1, Math.round((now - start) / 60000))} min</button>
    </Sheet>
  );
}

function LogSheet({ onClose, add }: { onClose: () => void; add: ReturnType<typeof useFitness>['addWorkout'] }) {
  const [type, setType] = useState('');
  const [min, setMin] = useState('');
  const [mi, setMi] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Log a workout" onClose={onClose}>
      <Field l="What did you do?"><input value={type} onChange={(e) => setType(e.target.value)} style={field} placeholder="Run, Push day, Yoga" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field l="Minutes"><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} style={field} /></Field>
        <Field l="Miles (optional)"><input inputMode="decimal" value={mi} onChange={(e) => setMi(e.target.value)} style={field} /></Field>
      </div>
      <Field l="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} style={field} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !type.trim()} onClick={async () => { setBusy(true); await add({ workout_type: type.trim(), duration_min: min ? Number(min) : null, distance_mi: mi ? Number(mi) || null : null, notes: notes.trim() || null }); onClose(); }}>{busy ? 'Saving…' : 'Log workout'}</button>
    </Sheet>
  );
}

function PlansSheet({ onClose, F, ai }: { onClose: () => void; F: ReturnType<typeof useFitness>; ai: boolean | null }) {
  const [busy, setBusy] = useState<FitnessPlanKind | null>(null);
  const [err, setErr] = useState('');
  const gen = async (kind: FitnessPlanKind) => {
    setBusy(kind); setErr('');
    const recent = F.workouts.slice(0, 14).map((w) => `${w.workout_date}: ${w.workout_type}${w.duration_min ? `, ${w.duration_min}min` : ''}${w.distance_mi ? `, ${w.distance_mi}mi` : ''}`).join('\n') || '(no workouts logged yet)';
    try {
      const text = await askClaude({
        system: kind === 'workout'
          ? 'You are Nova, a fitness coach inside a personal tracker. Write a practical 7-day workout plan grounded in the recent training history below: match the apparent level and habits, progress sensibly. Plain text, day by day, no markdown headers, concise.'
          : 'You are Nova, a nutrition coach inside a personal tracker. Write a practical daily diet plan (meals and rough macro targets) that supports the training load below. Plain text, no markdown headers, concise.',
        messages: [{ role: 'user', content: `Recent workouts:\n${recent}\n\nGenerate the plan.` }],
        maxTokens: 900,
      });
      await F.savePlan(kind, text);
    } catch (e) { setErr(e instanceof AiError ? e.message : 'Could not generate a plan.'); }
    setBusy(null);
  };
  return (
    <Sheet title="Nova plans" onClose={onClose} full>
      {ai === false && <AiOffCard text="Nova's plans are off. The library, Lock In, live workouts and your log all still work." />}
      {(['workout', 'diet'] as FitnessPlanKind[]).map((k) => {
        const p = F.plans.find((x) => x.kind === k);
        return (
          <Card key={k} title={k === 'workout' ? 'Workout plan' : 'Diet plan'} meta={p ? shortDate(p.created_at.slice(0, 10)) : 'None yet'}>
            {p && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{p.plan_text}</p>}
            {ai !== false && <button className="mm-btn" style={{ alignSelf: 'flex-start' }} disabled={busy !== null} onClick={() => void gen(k)}>{busy === k ? 'Writing…' : p ? 'Write a new one' : 'Write one'}</button>}
          </Card>
        );
      })}
      {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
    </Sheet>
  );
}
