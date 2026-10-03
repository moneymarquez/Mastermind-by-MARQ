import { useMemo, useState } from 'react';
import { useCashFlow, buildForecast } from '../../../data/useCashFlow';
import type { Forecast, ForecastEvent } from '../../../data/useCashFlow';
import { dateStr } from '../../../data/time';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Line } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule, useAi, AiOffCard, NovaMark } from '../../mm/Page';
import { addDays, shortDate, usd, num } from './util';

type Horizon = 30 | 60 | 90;
type Scenario = { id: string; q: string; legend: string; events: (e: ForecastEvent[]) => ForecastEvent[]; daily?: (v: number) => number; note: string };

const cents = (n: number) => `.${String(Math.round(Math.abs(n) * 100) % 100).padStart(2, '0')}`;
const whole = (n: number) => `${n < 0 ? '−' : ''}$${Math.floor(Math.abs(n)).toLocaleString('en-US')}`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Every Nth day of the forecast up to the horizon, always keeping the last. Pure. */
export function sample(days: Forecast['days'], horizon: number, max = 26) {
  const step = Math.max(1, Math.ceil(horizon / max));
  const out = days.filter((_, i) => i <= horizon && (i % step === 0 || i === horizon));
  return out;
}
const kindOf = (e: ForecastEvent) => (e.label.startsWith('Invoice: ') ? { c: 'Invoice', k: 'neutral' as const } : e.label.startsWith('Subscription: ') ? { c: 'Subscription', k: 'neutral' as const } : { c: e.amount >= 0 ? 'Recurring income' : 'Recurring bill', k: 'neutral' as const });
const cleanLabel = (l: string) => l.replace(/^(Invoice|Subscription): /, '');

export default function CashFlowV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const C = useCashFlow();
  const [h, setH] = useState<Horizon>(60);
  const [sc, setSc] = useState<string | null>(null);
  const [extra, setExtra] = useState('1000');
  const [setting, setSetting] = useState(false);
  const [q, setQ] = useState('');
  const today = dateStr(new Date());
  const f = C.forecast;

  const firstInvoice = C.events.find((e) => e.label.startsWith('Invoice: ') && e.amount > 0);
  const scenarios: Scenario[] = useMemo(() => {
    const amt = Math.max(0, Number(extra.replace(/[$,]/g, '')) || 0);
    const list: Scenario[] = [
      { id: 'income', q: `What if I add ${usd(amt)} a month in income?`, legend: `+${usd(amt)}/mo`, note: `Assumes ${usd(amt)} lands on the 1st of each month from next month.`,
        events: (e) => { const add: ForecastEvent[] = []; for (let m = 1; m <= 3; m++) { const d = new Date(`${today}T00:00:00`); d.setMonth(d.getMonth() + m, 1); add.push({ date: dateStr(d), amount: amt, label: 'Scenario income' }); } return [...e, ...add]; } },
      { id: 'cut', q: 'What if I cut everyday spending 30%?', legend: 'Spending −30%', note: 'Cuts your average non-recurring daily spend by 30%. Bills and invoices stay as they are.', events: (e) => e, daily: (v) => v * 0.7 },
    ];
    if (firstInvoice) list.push({ id: 'late', q: `What if ${cleanLabel(firstInvoice.label)} pays 30 days late?`, legend: '30 days late', note: `Moves ${usd(firstInvoice.amount)} from ${shortDate(firstInvoice.date)} to ${shortDate(addDays(firstInvoice.date, 30))}.`,
      events: (e) => e.map((x) => (x === firstInvoice ? { ...x, date: addDays(x.date, 30) } : x)) });
    return list;
  }, [extra, firstInvoice, today]);
  const active = scenarios.find((s) => s.id === sc) ?? null;
  const alt = useMemo(() => (f && active ? buildForecast(today, f.startingBalance, active.daily ? active.daily(f.avgDailyVariableExpense) : f.avgDailyVariableExpense, active.events(C.events)) : null), [f, active, C.events, today]);

  if (C.loading || !f) return <Page title="Cash-Flow Forecast" sub="All accounts"><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Building the forecast…</span></Page>;

  const menu = [{ t: 'Set current balance', onClick: () => setSetting(true) }];
  if (f.startingBalance === 0 && C.events.length === 0 && f.avgDailyVariableExpense === 0) {
    return (
      <Page title="Cash-Flow Forecast" sub="All accounts" menu={menu}>
        <Empty text="Set your current balance and add recurring bills or invoices, and the forecast draws itself." cta="Set current balance" onCta={() => setSetting(true)} />
        {setting && <BalanceSheet now={f.startingBalance} onClose={() => setSetting(false)} save={C.setStartingBalance} />}
      </Page>
    );
  }

  const end = f.days[h], delta = end.balance - f.startingBalance;
  const pts = sample(f.days, h);
  const altPts = alt ? sample(alt.days, h) : null;
  const win30 = f.days.slice(1, 31).flatMap((d) => d.events);
  const in30 = win30.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const out30 = win30.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0) + f.avgDailyVariableExpense * 30;
  const low = f.days.slice(0, h + 1).reduce((m, d) => (d.balance < m.balance ? d : m), f.days[0]);
  const burn = (f.startingBalance - f.days[30].balance);
  const runway = burn > 0 ? f.startingBalance / burn : null;
  const upcoming = f.days.slice(0, 31).flatMap((d) => d.events);

  const seg = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: phone ? undefined : 360 }}>
      {([30, 60, 90] as Horizon[]).map((x) => <button key={x} aria-pressed={h === x} onClick={() => setH(x)} style={{ padding: '8px 0', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: h === x ? 'var(--text)' : 'transparent', color: h === x ? 'var(--bg)' : 'var(--text-secondary)' }}>{x} days</button>)}
    </div>
  );
  const hero = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Projected balance on {shortDate(end.date)}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', color: end.balance < 0 ? 'var(--danger)' : 'var(--text)', fontSize: phone ? 40 : 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{whole(end.balance)}<span style={{ fontSize: 22, color: 'var(--text-tertiary)' }}>{cents(end.balance)}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip k={delta >= 0 ? 'good' : 'bad'}>{delta >= 0 ? '↑' : '↓'} {usd(Math.abs(Math.round(delta)))}</Chip>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>from {usd(Math.round(f.startingBalance))} today</span>
      </div>
      <Line vals={pts.map((d) => Math.round(d.balance))} today={0} labels={['Today', shortDate(end.date)]} pts={pts.map((d) => shortDate(d.date))} pre="$" h={150} />
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Dashed = forecast. Includes about {usd(f.avgDailyVariableExpense)} a day of everyday spending from your last 30 days.</span>
    </section>
  );
  const whatIf = (
    <Card title="What if…" meta="Scenarios" wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenarios.map((s) => {
          const on = sc === s.id;
          return <button key={s.id} aria-pressed={on} onClick={() => setSc(on ? null : s.id)} style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'left', background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--bg)' : 'var(--text)', border: on ? '1px solid var(--text)' : '1px solid var(--border)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{s.q}</button>;
        })}
      </div>
      {sc === 'income' && <Field l="Extra income a month"><input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} style={field} /></Field>}
      {active && alt && altPts && (
        <>
          <Line vals={pts.map((d) => Math.round(d.balance))} alt={altPts.map((d) => Math.round(d.balance))} today={0} labels={['Today', shortDate(end.date)]} pts={pts.map((d) => shortDate(d.date))} pre="$" h={130} />
          <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--accent)' }} />Current</span><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--cat-3)' }} />{active.legend}</span></div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>Ends at <span style={{ color: 'var(--text)' }}>{usd(Math.round(alt.days[h].balance))}</span>, {usd(Math.abs(Math.round(alt.days[h].balance - end.balance)))} {alt.days[h].balance >= end.balance ? 'higher' : 'lower'}. {active.note}</p>
        </>
      )}
    </Card>
  );
  const askNova = ai === false ? <AiOffCard text="Ask-anything scenarios are off. The forecast and the what-ifs above still work." /> : (
    <Card title="Ask anything" meta="Nova" wide={!phone}>
      <NovaMark />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && q.trim() && !C.scenarioLoading) void C.askScenario(q.trim()); }} placeholder="What if rent goes up $200?" style={{ ...field, flex: 1 }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!q.trim() || C.scenarioLoading} onClick={() => void C.askScenario(q.trim())}>{C.scenarioLoading ? 'Thinking…' : 'Ask'}</button>
      </div>
      {C.scenarioError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{C.scenarioError}</span>}
      {C.scenarioAnswer && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{C.scenarioAnswer}</p>}
    </Card>
  );
  const coming = (
    <Card title="Coming up" meta="Next 30 days" flush wide={!phone}>
      {upcoming.length ? <div>{upcoming.slice(0, 10).map((e, i) => { const k = kindOf(e); return <Row key={`${e.label}-${e.date}-${i}`} first={i === 0} name={cleanLabel(e.label)} meta={shortDate(e.date)} chip={k.c} k={k.k} amt={signed(e.amount)} />; })}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing scheduled. Recurring items, unpaid invoices with due dates, and subscription renewals show up here.</div>}
    </Card>
  );
  const shortfall = f.firstShortfall && f.firstShortfall.date <= end.date && (
    <section style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 40%, var(--border))', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ alignSelf: 'flex-start' }}><Chip k="bad">Below $0 on {shortDate(f.firstShortfall.date)}</Chip></span>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>Biggest bills before then: {f.days.filter((d) => d.date <= f.firstShortfall!.date).flatMap((d) => d.events).filter((e) => e.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 3).map((e) => `${cleanLabel(e.label)} ${usd(-e.amount)} on ${shortDate(e.date)}`).join(', ') || 'everyday spending'}.</span>
    </section>
  );
  const stats = [
    <Stat key="in" label="In, next 30 days" value={`+${usd(Math.round(in30))}`} pill={`${win30.filter((e) => e.amount > 0).length} payments`} k={in30 ? 'good' : 'neutral'} />,
    <Stat key="out" label="Out, next 30 days" value={`−${usd(Math.round(out30))}`} pill="Bills + everyday spending" />,
    <Stat key="low" label="Lowest point" value={usd(Math.round(low.balance))} pill={low.date === today ? 'Today' : shortDate(low.date)} k={low.balance < 0 ? 'bad' : low.balance < f.startingBalance * 0.5 ? 'warn' : 'neutral'} />,
    <Stat key="run" label="Runway" value={runway ? `${num(runway, 1)} mo` : 'Growing'} pill={runway ? 'At current spend' : 'Balance rises over 30 days'} k={runway && runway < 2 ? 'bad' : runway ? 'neutral' : 'good'} />,
  ];

  return (
    <Page title="Cash-Flow Forecast" sub="All accounts" menu={menu}>
      {phone ? (
        <>{seg}{hero}{shortfall}{whatIf}{coming}{askNova}</>
      ) : (
        <>
          {seg}
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }}>
            {hero}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          </div>
          {shortfall}
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{whatIf}</div>
            {askNova}
            <div style={{ gridColumn: '1 / -1' }}>{coming}</div>
          </div>
        </>
      )}
      {setting && <BalanceSheet now={f.startingBalance} onClose={() => setSetting(false)} save={C.setStartingBalance} />}
    </Page>
  );
}

function BalanceSheet({ now, onClose, save }: { now: number; onClose: () => void; save: (v: number) => Promise<void> }) {
  const [v, setV] = useState(now ? String(now) : '');
  const [busy, setBusy] = useState(false);
  const n = Number(v.replace(/[$,\s]/g, ''));
  return (
    <Sheet title="Current balance" onClose={onClose}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>What's in your accounts right now? The forecast starts here.</span>
      <Field l="Balance"><input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} style={field} placeholder="6310" /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !v.trim() || !Number.isFinite(n)} onClick={async () => { setBusy(true); await save(n); onClose(); }}>{busy ? 'Saving…' : 'Save'}</button>
    </Sheet>
  );
}
