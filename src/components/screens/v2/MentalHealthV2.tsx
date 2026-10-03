import { useMemo, useState } from 'react';
import { useMentalHealth } from '../../../data/useMentalHealth';
import { useMentalHealthProfile } from '../../../data/useMentalHealthProfile';
import { useBender } from '../../../data/useBender';
import type { Mood } from '../../../data/types';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Row from '../../mm/Row';
import { Line, Donut } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, useModule, useAi, AiOffCard, NovaMark, area } from '../../mm/Page';
import MentalHealthProfileView from '../MentalHealthProfileView';
import { reflectOnCheckin } from '../MentalHealthScreen';
import { addDays, ymd, shortDate, num } from './util';
import { MOOD_SCORE, splitTags, dailyMood } from './math';

const SCALE: { m: Mood; l: string }[] = [{ m: 'bad', l: 'Awful' }, { m: 'rough', l: 'Low' }, { m: 'okay', l: 'Okay' }, { m: 'good', l: 'Good' }, { m: 'great', l: 'Great' }];
const LABEL = Object.fromEntries(SCALE.map((s) => [s.m, s.l])) as Record<Mood, string>;
const TAGS = ['Slept well', 'Busy', 'Anxious', 'Lonely', 'Tired', 'Grateful', 'Stressed', 'Social'];

const joinTags = (tags: string[], text: string) => [tags.length ? `Tags: ${tags.join(', ')}.` : '', text.trim()].filter(Boolean).join('\n');

export default function MentalHealthV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const mh = useMentalHealth();
  const profile = useMentalHealthProfile();
  const { activeBender } = useBender();
  const [mood, setMood] = useState<Mood | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'reflect' | null>(null);
  const [saved, setSaved] = useState(false);

  const today = ymd(new Date());
  const days = useMemo(() => dailyMood(mh.checkins), [mh.checkins]);
  const last30 = days.filter((d) => d.day > addDays(today, -30));
  const prev30 = days.filter((d) => d.day <= addDays(today, -30) && d.day > addDays(today, -60));
  const avg = (a: { v: number }[]) => (a.length ? a.reduce((s, d) => s + d.v, 0) / a.length : null);
  const a30 = avg(last30), aPrev = avg(prev30);
  const low = last30.filter((d) => d.v <= 2).length;
  const todayV = days.find((d) => d.day === today);
  const latestInsight = mh.checkins.find((c) => c.ai_insight);
  const tagCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of mh.checkins) if (ymd(new Date(r.created_at)) > addDays(today, -30)) for (const t of splitTags(r.note).tags) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [mh.checkins, today]);

  const submit = async () => {
    if (!mood) return;
    setBusy('save');
    const text = joinTags(tags, note);
    const row = await mh.addCheckin(mood, text);
    setSaved(true); setMood(null); setTags([]); setNote('');
    if (row && ai) {
      setBusy('reflect');
      try { await mh.saveInsight(row.id, await reflectOnCheckin(row.mood, text, activeBender, profile.answers)); } catch { /* the check-in saved; the reflection is a bonus */ }
    }
    setBusy(null);
  };

  const checkin = (
    <Card title="How are you right now?" meta={saved && !mood ? 'Saved' : 'Today'} wide={!phone}>
      <div role="radiogroup" aria-label="Mood" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
        {SCALE.map((s, i) => {
          const on = mood === s.m;
          return (
            <button key={s.m} role="radio" aria-checked={on} onClick={() => { setMood(s.m); setSaved(false); }}
              style={{ height: 58, borderRadius: 10, background: on ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface-3)', border: on ? '1.5px solid var(--accent)' : '1.5px solid transparent', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600 }}>{i + 1}</span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{s.l}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TAGS.map((t) => {
          const on = tags.includes(t);
          return <button key={t} aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} style={{ padding: '6px 11px', borderRadius: 999, background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--bg)' : 'var(--text)', border: on ? '1px solid var(--text)' : '1px solid var(--border)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{t}</button>;
        })}
      </div>
      {mood && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's going on? (optional)" style={{ ...area, height: 72 }} />
          <button className="mm-btn mm-btn--primary" style={{ height: 44, fontSize: 15 }} disabled={busy !== null} onClick={() => void submit()}>{busy === 'save' ? 'Saving…' : 'Log check-in'}</button>
        </>
      )}
      {busy === 'reflect' && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nova is reflecting on that…</span>}
    </Card>
  );

  if (!mh.loading && mh.checkins.length === 0) {
    return (
      <Page title="Mental Health" sub="Private to you" more={{ label: 'Your profile', render: () => <MentalHealthProfileView profile={profile} /> }}>
        {checkin}
        <Empty text="No check-ins yet. One tap a day is enough to start seeing your pattern." />
        {ai === false && <AiOffCard text="AI reflections are off. Check-ins and your mood chart still work." />}
        <Crisis />
      </Page>
    );
  }

  const chart = (
    <Card title="Mood" meta={`Last 30 days · 1 to 5`} wide={!phone}>
      <Line vals={last30.map((d) => Math.round(d.v * 10) / 10)} min={1} max={5} dec={1} h={140}
        labels={last30.length ? [shortDate(last30[0].day), last30.length > 2 ? shortDate(last30[Math.floor(last30.length / 2)].day) : '', last30[last30.length - 1].day === today ? 'Today' : shortDate(last30[last30.length - 1].day)] : []}
        pts={last30.map((d) => shortDate(d.day))} />
    </Card>
  );
  const s = {
    avg: <Stat key="avg" label="30-day average" value={a30 == null ? '—' : num(a30, 1)} pill={a30 != null && aPrev != null ? `${a30 >= aPrev ? '↑' : '↓'} ${num(Math.abs(a30 - aPrev), 1)} vs prior 30` : 'First month'} k={a30 != null && aPrev != null ? (a30 >= aPrev ? 'good' : 'bad') : 'neutral'} />,
    count: <Stat key="count" label="Check-ins" value={`${last30.length} of 30`} pill={`${30 - last30.length} days missed`} />,
    low: <Stat key="low" label="Low days" value={String(low)} pill="2 or under" k={low ? 'warn' : 'good'} />,
    today: <Stat key="today" label="Today" value={todayV ? num(todayV.v, todayV.v % 1 ? 1 : 0) : '—'} pill={todayV ? LABEL[SCALE[Math.round(todayV.v) - 1].m] : 'Not logged'} k={todayV && todayV.v >= 4 ? 'good' : 'neutral'} />,
  };
  const reflection = ai === false
    ? <AiOffCard text="AI reflections are off. Check-ins and your mood chart still work." />
    : latestInsight && (
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NovaMark title="Reflection" />
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text)' }}>{latestInsight.ai_insight}</p>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>On your {LABEL[latestInsight.mood].toLowerCase()} check-in, {shortDate(ymd(new Date(latestInsight.created_at)))}</span>
      </section>
    );
  const tagsCard = tagCounts.length > 0 && (
    <Card title="What you tagged" meta="30 days" wide={!phone}><Donut rows={tagCounts} pre="" center="Tags" /></Card>
  );
  const recent = (
    <Card title="Recent check-ins" meta={`${Math.min(6, mh.checkins.length)} of ${mh.checkins.length}`} flush wide={!phone}>
      <div>{mh.checkins.slice(0, 6).map((c, i) => { const t = splitTags(c.note); return <Row key={c.id} first={i === 0} name={LABEL[c.mood]} meta={new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} chip={t.tags.length ? t.tags.join(' · ') : undefined} note={t.text || undefined} amt={String(MOOD_SCORE[c.mood])} />; })}</div>
    </Card>
  );

  return (
    <Page title="Mental Health" sub="Private to you" more={{ label: `Your profile${profile.loading ? '' : ` (${profile.answeredCount})`}`, render: () => <MentalHealthProfileView profile={profile} /> }}>
      {phone ? (
        <>
          {checkin}{chart}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{s.avg}{s.count}</div>
          {reflection}{tagsCard}{recent}
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{s.avg}{s.count}{s.low}{s.today}</div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{chart}</div>
            {checkin}
            {reflection}
            {tagsCard}
            <div style={{ gridColumn: three ? 'span 1' : 'auto' }}>{recent}</div>
          </div>
        </>
      )}
      <Crisis />
    </Page>
  );
}

/** Always visible, not gated behind AI: the static safety net. */
function Crisis() {
  return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>If you're in crisis or thinking about harming yourself, call or text <b style={{ color: 'var(--text-secondary)' }}>988</b> (Suicide &amp; Crisis Lifeline), or text HOME to 741741. Available any time.</p>;
}
