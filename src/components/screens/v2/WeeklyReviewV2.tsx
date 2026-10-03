import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useWeeklyReview } from '../../../data/useWeeklyReview';
import { dateStr, weekStartOf } from '../../../data/time';
import type { Goal } from '../../../data/types';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import type { PillKind } from '../../mm/Stat';
import { Bars } from '../../mm/charts';
import { Page, useModule, useAi, AiOffCard, NovaMark, area } from '../../mm/Page';
import { goalPace, weekNo } from './math';
import { addDays, shortDate, usd, num } from './util';

type Tile = { l: string; v: string; d: string; k?: PillKind };
type Nums = { calls: number; callsPrev: number; spent: number; spentPrev: number; clean: number | null; logged: number; workouts: number; mood: number | null; moodPrev: number | null; goalsOn: number; goalsAll: number };

const MOOD = { bad: 1, rough: 2, okay: 3, good: 4, great: 5 } as Record<string, number>;
/** The week's numbers, pulled from every module that has them. Read-only. */
async function weekNumbers(start: string): Promise<Nums> {
  const end = addDays(start, 7), prev = addDays(start, -7);
  const [calls, callsP, tx, sob, fit, mh, goals] = await Promise.all([
    supabase.from('call_outcomes').select('id', { count: 'exact', head: true }).gte('call_date', start).lt('call_date', end),
    supabase.from('call_outcomes').select('id', { count: 'exact', head: true }).gte('call_date', prev).lt('call_date', start),
    supabase.from('budget_transactions').select('type, amount, occurred_on').eq('type', 'expense').gte('occurred_on', prev).lt('occurred_on', end),
    supabase.from('sobriety_checkins').select('checkin_date, drank, weed, nicotine').gte('checkin_date', start).lt('checkin_date', end),
    supabase.from('fitness_workouts').select('id', { count: 'exact', head: true }).gte('workout_date', start).lt('workout_date', end),
    supabase.from('mental_health_checkins').select('mood, created_at').gte('created_at', prev).lt('created_at', end),
    supabase.from('goals').select('*, goal_steps(*)'),
  ]);
  const txs = (tx.data ?? []) as { amount: number; occurred_on: string }[];
  const sum = (a: typeof txs) => a.reduce((s, t) => s + Number(t.amount), 0);
  const sobs = (sob.data ?? []) as { drank: boolean; weed: boolean; nicotine: boolean }[];
  const moods = (mh.data ?? []) as { mood: string; created_at: string }[];
  const avg = (a: typeof moods) => (a.length ? a.reduce((s, m) => s + (MOOD[m.mood] ?? 3), 0) / a.length : null);
  const gs = ((goals.data ?? []) as (Goal & { goal_steps: Goal['steps'] })[]).map((g) => ({ ...g, steps: g.goal_steps ?? [], checkins: [], paths: [] }));
  const paces = gs.map((g) => goalPace(g, 0)).filter((p) => p && !p.done && p.onPace !== null);
  return {
    calls: calls.count ?? 0, callsPrev: callsP.count ?? 0,
    spent: sum(txs.filter((t) => t.occurred_on >= start)), spentPrev: sum(txs.filter((t) => t.occurred_on < start)),
    clean: sobs.length ? sobs.filter((s) => !s.drank && !s.weed && !s.nicotine).length : null, logged: sobs.length,
    workouts: fit.count ?? 0,
    mood: avg(moods.filter((m) => m.created_at.slice(0, 10) >= start)), moodPrev: avg(moods.filter((m) => m.created_at.slice(0, 10) < start)),
    goalsOn: paces.filter((p) => p!.onPace).length, goalsAll: paces.length,
  };
}

function tiles(n: Nums): Tile[] {
  const delta = (a: number, b: number, f: (x: number) => string, upGood: boolean): { d: string; k: PillKind } => {
    if (!b && !a) return { d: 'Nothing logged', k: 'neutral' };
    if (a === b) return { d: 'Same as last week', k: 'neutral' };
    return { d: `${a > b ? '↑' : '↓'} ${f(Math.abs(a - b))} vs last week`, k: (a > b) === upGood ? 'good' : 'bad' };
  };
  return [
    { l: 'Calls made', v: num(n.calls), ...delta(n.calls, n.callsPrev, num, true) },
    { l: 'Spent', v: usd(n.spent), ...delta(n.spent, n.spentPrev, usd, false) },
    { l: 'Clean days', v: n.clean == null ? '—' : `${n.clean} of 7`, d: n.clean == null ? 'Nothing logged' : `${7 - n.logged} not logged`, k: 'neutral' },
    { l: 'Workouts', v: String(n.workouts), d: n.workouts ? 'Logged in Fitness' : 'Nothing logged', k: 'neutral' },
    { l: 'Mood average', v: n.mood == null ? '—' : num(n.mood, 1), ...(n.mood != null && n.moodPrev != null ? { d: `${n.mood >= n.moodPrev ? '↑' : '↓'} ${num(Math.abs(n.mood - n.moodPrev), 1)}`, k: (n.mood >= n.moodPrev ? 'good' : 'bad') as PillKind } : { d: n.mood == null ? 'No check-ins' : 'First week', k: 'neutral' as PillKind }) },
    { l: 'Goals', v: n.goalsAll ? `${n.goalsOn} of ${n.goalsAll}` : '—', d: n.goalsAll ? 'on pace' : 'None with a deadline', k: 'neutral' },
  ];
}
const tileColor = (k?: PillKind) => (k === 'good' ? 'var(--success)' : k === 'bad' ? 'var(--danger)' : 'var(--text-tertiary)');

export default function WeeklyReviewV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const W = useWeeklyReview();
  const thisWeek = dateStr(weekStartOf(dateStr(new Date())));
  const [week, setWeek] = useState(addDays(thisWeek, -7));
  const [nums, setNums] = useState<Nums | null>(null);
  const rev = W.reviews.find((r) => r.week_start === week);
  const [form, setForm] = useState({ went_well: '', didnt: '', one_change: '' });
  const [rating, setRating] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNums(null); void weekNumbers(week).then(setNums); }, [week]);
  useEffect(() => {
    setForm({ went_well: rev?.went_well ?? '', didnt: rev?.didnt ?? '', one_change: rev?.one_change ?? '' });
    setRating(rev?.rating ?? null); setMsg(null);
  }, [rev, week]);

  const submit = async () => {
    setBusy(true);
    const err = await W.saveSelf(week, { went_well: form.went_well.trim(), didnt: form.didnt.trim(), one_change: form.one_change.trim(), rating });
    setMsg(err ? { t: err, bad: true } : { t: 'Saved. Only you see this.' });
    setBusy(false);
  };
  const end = addDays(week, 6);
  const t = nums ? tiles(nums) : [];
  const rated = [...W.reviews].filter((r) => r.rating).sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-8);

  const numbers = (
    <Card title="Your numbers" meta="From your modules" wide={!phone}>
      {!nums ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Pulling the week's numbers…</span> : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phone ? 2 : 3},minmax(0,1fr))`, gap: 8 }}>
          {t.map((x) => (
            <div key={x.l} style={{ padding: 12, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{x.l}</span>
              <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.035em' }}>{x.v}</span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: tileColor(x.k) }}>{x.d}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
  const prompts: [keyof typeof form, string][] = [['went_well', 'What went well?'], ['didnt', "What didn't?"], ['one_change', 'One change for next week']];
  const honest = (
    <Card title="Be honest" meta="Only you see this" wide={!phone}>
      {prompts.map(([k, q]) => (
        <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{q}</span>
          <textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ ...area, height: 76, fontSize: 15 }} />
        </label>
      ))}
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Rate the week</span>
      <div role="radiogroup" aria-label="Rate the week" style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} style={{ height: 40, borderRadius: 8, border: rating === n ? '1.5px solid var(--accent)' : '1.5px solid transparent', background: rating === n ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface-3)', color: 'var(--text)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>{n}</button>
        ))}
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 44, fontSize: 15 }} disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : rev?.submitted_at ? 'Update review' : 'Submit review'}</button>
      {msg && <span style={{ fontSize: 13, color: msg.bad ? 'var(--danger)' : 'var(--success)' }}>{msg.t}</span>}
    </Card>
  );
  const ratings = rated.length > 0 && (
    <Card title="Week ratings" meta={`Last ${rated.length} ${rated.length === 1 ? 'week' : 'weeks'}`} wide={!phone}>
      <Bars vals={rated.map((r) => r.rating!)} labels={rated.map((r) => String(weekNo(r.week_start)))} pre="" max={10} cur={rated.findIndex((r) => r.week_start === week) >= 0 ? rated.findIndex((r) => r.week_start === week) : undefined} />
    </Card>
  );
  const nova = ai === false
    ? <AiOffCard text="No AI summary draft this week. You write the review; the numbers still fill in." />
    : (
      <Card title="Nova draft" meta={rev?.summary ? shortDate(rev.generated_at.slice(0, 10)) : 'Optional'} wide={!phone}>
        <NovaMark />
        {rev?.summary ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{rev.summary}</p>
            {rev.recommended_actions.length > 0 && <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, lineHeight: 1.45, color: 'var(--text)' }}>{rev.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}</ol>}
          </>
        ) : <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>Nova can draft a first pass from your numbers. You always write the final review.</p>}
        {W.error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{W.error}</span>}
        <button className="mm-btn" style={{ alignSelf: 'flex-start' }} disabled={W.generating} onClick={() => void W.draftFor(week)}>{W.generating ? 'Drafting…' : rev?.summary ? 'Redraft' : 'Draft it'}</button>
      </Card>
    );
  const weekPick = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: phone ? undefined : 320 }}>
      {[[addDays(thisWeek, -7), 'Last week'], [thisWeek, 'This week']].map(([w, l]) => (
        <button key={w} aria-pressed={week === w} onClick={() => setWeek(w)} style={{ padding: '8px 0', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: week === w ? 'var(--text)' : 'transparent', color: week === w ? 'var(--bg)' : 'var(--text-secondary)' }}>{l}</button>
      ))}
    </div>
  );
  const title = `Week ${weekNo(week)}`, sub = `${shortDate(week)} – ${shortDate(end)}${week === thisWeek ? ' · in progress' : ''}`;
  const n = nums;

  return (
    <Page title={title} sub={sub} right={phone ? { t: busy ? 'Saving…' : 'Submit', onClick: () => void submit() } : undefined}>
      {weekPick}
      {phone ? (
        <>{numbers}{honest}{ratings}{nova}</>
      ) : (
        <>
          {n && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
              <Stat label="Calls made" value={num(n.calls)} pill={t[0].d} k={t[0].k} />
              <Stat label="Spent" value={usd(n.spent)} pill={t[1].d} k={t[1].k} />
              <Stat label="Clean days" value={t[2].v} pill={t[2].d} />
              <Stat label="Week rating" value={rating ? String(rating) : '—'} pill={rating ? 'You gave it' : 'Not rated yet'} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{numbers}</div>
            {ratings || nova}
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{honest}</div>
            {ratings && nova}
          </div>
        </>
      )}
    </Page>
  );
}
