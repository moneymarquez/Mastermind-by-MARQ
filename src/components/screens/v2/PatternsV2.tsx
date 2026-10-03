import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { usePatternDetection } from '../../../data/usePatternDetection';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, useModule, useAi, AiOffCard, NovaMark } from '../../mm/Page';
import { addDays, ymd, num, lastDays } from './util';
import { WINDOW, MIN_PAIRS, MIN_GROUP, MOOD, strength, comparisons } from './math';
import type { Series, Scatter, Comp } from './math';

async function loadSeries(): Promise<Series> {
  const from = addDays(ymd(new Date()), -WINDOW);
  const [mh, tx, calls, sob, fit] = await Promise.all([
    supabase.from('mental_health_checkins').select('mood, created_at').gte('created_at', from),
    supabase.from('budget_transactions').select('amount, occurred_on').eq('type', 'expense').gte('occurred_on', from),
    supabase.from('call_outcomes').select('call_date').gte('call_date', from),
    supabase.from('sobriety_checkins').select('checkin_date, drank, weed, nicotine').gte('checkin_date', from),
    supabase.from('fitness_workouts').select('workout_date').gte('workout_date', from),
  ]);
  const moodAcc = new Map<string, number[]>();
  for (const m of (mh.data ?? []) as { mood: string; created_at: string }[]) { const d = ymd(new Date(m.created_at)); moodAcc.set(d, [...(moodAcc.get(d) ?? []), MOOD[m.mood] ?? 3]); }
  const spend = new Map<string, number>();
  for (const t of (tx.data ?? []) as { amount: number; occurred_on: string }[]) spend.set(t.occurred_on, (spend.get(t.occurred_on) ?? 0) + Number(t.amount));
  const c = new Map<string, number>();
  for (const x of (calls.data ?? []) as { call_date: string }[]) c.set(x.call_date, (c.get(x.call_date) ?? 0) + 1);
  const clean = new Map<string, boolean>();
  for (const s of (sob.data ?? []) as { checkin_date: string; drank: boolean; weed: boolean; nicotine: boolean }[]) clean.set(s.checkin_date, !s.drank && !s.weed && !s.nicotine);
  const workout = new Set(((fit.data ?? []) as { workout_date: string }[]).map((w) => w.workout_date));
  const mood = new Map([...moodAcc].map(([d, vs]) => [d, vs.reduce((s, v) => s + v, 0) / vs.length]));
  const any = new Set([...mood.keys(), ...spend.keys(), ...c.keys(), ...clean.keys(), ...workout]);
  return { mood, spend, calls: c, clean, workout, days: any.size };
}

function ScatterPlot({ pts, xl, yPre }: { pts: [number, number][]; xl: [string, string]; yPre: string }) {
  const W = 322, H = 170, L = 34;
  const ys = pts.map((p) => p[1]), hi = Math.max(1, ...ys) * 1.1;
  const X = (x: number) => L + ((x - 1) / 4) * (W - L - 6), Y = (y: number) => 10 + (1 - y / hi) * (H - 30);
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = ys.reduce((s, v) => s + v, 0) / pts.length;
  const den = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0), sl = den ? pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / den : 0;
  const yAt = (x: number) => Math.max(0, my + sl * (x - mx));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 18}`} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label={`${pts.length} days plotted`}>
      {[0.9, 0.45, 0].map((f) => { const v = hi * f, y = Y(v); return <g key={f}><line x1={L} x2={W} y1={y} y2={y} stroke="var(--grid)" /><text x="0" y={y + 4} fontSize="10.5" fontWeight="500" fill="var(--text-tertiary)">{yPre}{Math.round(v)}</text></g>; })}
      {pts.map((p, i) => <circle key={i} cx={X(p[0] + ((i % 5) - 2) * 0.04)} cy={Y(p[1])} r="4" fill="var(--accent)" opacity="0.75" />)}
      <line x1={X(1)} y1={Y(yAt(1))} x2={X(5)} y2={Y(yAt(5))} stroke="var(--text-secondary)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x={L} y={H + 14} fontSize="10.5" fontWeight="500" fill="var(--text-tertiary)">{xl[0]}</text>
      <text x={W} y={H + 14} fontSize="10.5" fontWeight="500" fill="var(--text-tertiary)" textAnchor="end">{xl[1]}</text>
    </svg>
  );
}

function NeedsData({ title, have, need, text }: { title: string; have: number; need: number; text: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, backgroundColor: 'var(--surface-2)', backgroundImage: 'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{text}</span>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)' }}><div style={{ width: `${Math.min(100, (have / need) * 100)}%`, height: '100%', borderRadius: 999, background: 'var(--text-tertiary)' }} /></div>
    </div>
  );
}

export default function PatternsV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const P = usePatternDetection();
  const [s, setS] = useState<Series | null>(null);
  useEffect(() => { void loadSeries().then(setS); }, []);
  const days = useMemo(() => lastDays(WINDOW), []);
  const comps = useMemo(() => (s ? comparisons(s, days) : []), [s, days]);

  if (!s) return <Page title="Patterns" sub="Links across your modules"><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Reading your modules…</span></Page>;

  const ready = comps.filter((c) => c.text);
  const waiting = comps.filter((c) => !c.text);
  if (s.days < 7 && !P.insights.length) {
    return (
      <Page title="Patterns" sub="Links across your modules">
        <Empty text={`Patterns appear after a few weeks of data in at least two modules. You're at ${s.days} ${s.days === 1 ? 'day' : 'days'}.`} />
        {ai === false && <AiOffCard text="Nova's pattern search is off. The comparisons here still update from your data." />}
      </Page>
    );
  }

  const card = (c: Comp) => {
    if (!c.text) return c.kind === 'scatter'
      ? <NeedsData key={c.id} title={c.title} have={c.have} need={MIN_PAIRS} text={`Needs ${MIN_PAIRS} days with both logged. You're at ${c.have}.`} />
      : <NeedsData key={c.id} title={c.title} have={Math.min(c.a.n, c.b.n)} need={MIN_GROUP} text={`Needs ${MIN_GROUP} days on each side. So far: ${c.a.n} ${c.a.l.toLowerCase()}, ${c.b.n} ${c.b.l.toLowerCase()}.`} />;
    if (c.kind === 'scatter') return (
      <Card key={c.id} title={c.title} meta={`${c.pts.length} days`} wide={!phone}>
        <ScatterPlot pts={c.pts} xl={c.xl} yPre={c.yPre} />
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{c.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Chip k="neutral">{strength(c.r!)}</Chip><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>r = {c.r! < 0 ? '−' : ''}{num(Math.abs(c.r!), 2)} · {c.mods}</span></div>
      </Card>
    );
    return (
      <Card key={c.id} title={c.title} meta={`${WINDOW} days`} wide={!phone}>
        {[c.a, c.b].map((g, i) => (
          <div key={g.l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}><span>{g.l}</span><span style={{ color: 'var(--text)' }}>{g.v != null ? c.fmtV(g.v) : '—'}</span></div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-3)' }}><div style={{ width: `${g.v != null ? Math.min(100, (g.v / c.max) * 100) : 0}%`, height: '100%', borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'var(--accent-soft)' }} /></div>
          </div>
        ))}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{c.unit} · {c.a.n} vs {c.b.n} days · {c.mods}</span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{c.text}</p>
      </Card>
    );
  };
  const nova = ai === false ? <AiOffCard text="Nova's pattern search is off. The comparisons here still update from your data." /> : (
    <Card title="Nova noticed" meta={P.insights.length ? `${P.insights.length} saved` : 'Weekly data'} wide={!phone}>
      <NovaMark />
      {P.insights.slice(0, 3).map((i) => (
        <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--grid)' }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{i.summary}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Chip k={i.confidence === 'high' ? 'good' : i.confidence === 'medium' ? 'warn' : 'neutral'}>{i.confidence[0].toUpperCase() + i.confidence.slice(1)} confidence</Chip><button className="mm-btn" style={{ height: 30, fontSize: 12.5, marginLeft: 'auto' }} onClick={() => void P.dismiss(i.id)}>Dismiss</button></div>
        </div>
      ))}
      {P.error && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{P.error}</span>}
      <button className="mm-btn" style={{ alignSelf: 'flex-start' }} disabled={P.generating} onClick={() => void P.refresh()}>{P.generating ? 'Looking…' : 'Look for patterns'}</button>
    </Card>
  );
  const strongest = ready.filter((c): c is Scatter => c.kind === 'scatter' && c.r != null).sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!))[0];
  const foot = <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'center' }}>Patterns show links, not causes.</span>;

  return (
    <Page title="Patterns" sub={`${s.days} days of data · last ${WINDOW} days`}>
      {phone ? (
        <>{ready.map(card)}{nova}{waiting.map(card)}{foot}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Links found" value={String(ready.length)} pill={`Of ${comps.length} comparisons`} />
            <Stat label="Strongest" value={strongest ? `r = ${strongest.r! < 0 ? '−' : ''}${num(Math.abs(strongest.r!), 2)}` : '—'} pill={strongest ? strongest.title : ready[0]?.title ?? 'Needs more data'} />
            <Stat label="Days of data" value={String(s.days)} pill={`Last ${WINDOW} days`} />
            <Stat label="Needs more data" value={String(waiting.length)} pill={waiting[0]?.title ?? 'All set'} k={waiting.length ? 'warn' : 'good'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {ready.map(card)}{nova}{waiting.map(card)}
          </div>
          {foot}
        </>
      )}
    </Page>
  );
}
