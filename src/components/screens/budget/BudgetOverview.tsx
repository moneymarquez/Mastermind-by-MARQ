import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import '../../shell/shell.css';
import type { Device } from '../../shell/Shell';
import { GPlus, GChevron, GChevronLeft, GClose } from '../../shell/glyphs';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import { Pill } from '../../mm/Stat';
import Chip from '../../mm/Chip';
import Pace from '../../mm/Pace';
import Row from '../../mm/Row';
import { Bars, Donut } from '../../mm/charts';
import { Empty } from '../../mm/States';
import type { useBudgeting } from '../../../data/useBudgeting';
import { currentMonthKey, shiftMonthKey } from '../../../data/useBudgeting';
import { monthBudget, sparkPaths, money, splitMoney } from '../../../data/homeMath';

/** Budgeting's top half (design handoff: Budget): hero "Spent in <month>"
 *  with a pace meter, stat tiles, six months of spending, where it went,
 *  category budgets and this month's bills. The tools to log, plan and
 *  track subscriptions sit below it, unchanged. */
export default function BudgetOverview({ device, b, monthKey, setMonthKey, onAdd }: { device: Device; b: ReturnType<typeof useBudgeting>; monthKey: string; setMonthKey: (k: string) => void; onAdd?: () => void }) {
  const phone = device === 'phone', desk = device === 'desktop';
  const [billFilter, setBillFilter] = useState<'All' | 'Unpaid' | 'Paid'>('All');
  const [adding, setAdding] = useState(false);
  const isCurrent = monthKey === currentMonthKey();
  const [y, m] = monthKey.split('-').map(Number);
  const asOf = isCurrent ? new Date() : new Date(y, m, 0, 12);
  const totalBudget = b.categories.reduce((s, c) => s + Number(c.monthly_amount || 0), 0);
  const mb = useMemo(() => monthBudget(totalBudget, b.transactions, asOf), [totalBudget, b.transactions, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = b.getMonthSummary(monthKey);
  const prev = b.getMonthSummary(shiftMonthKey(monthKey, -1));
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long' });
  const short = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const history = Array.from({ length: 6 }, (_, i) => shiftMonthKey(monthKey, -(5 - i))).map((k) => ({ k, s: b.getMonthSummary(k) }));
  const spentByDay = (() => { let run = 0; return mb.remainingByDay.map((r) => { run = totalBudget - r; return run; }); })();
  const spark = sparkPaths(spentByDay.length > 1 ? spentByDay : [0, summary.totalExpense], 322, desk ? 64 : 56);
  const { whole, cents } = splitMoney(summary.totalExpense);
  const incomeDelta = prev.totalIncome > 0 ? ((summary.totalIncome - prev.totalIncome) / prev.totalIncome) * 100 : null;
  const saved = summary.totalIncome - summary.totalExpense;

  // Bills: this month's recurring expenses — paid once their transaction posted.
  const bills = b.recurring.filter((r) => r.type === 'expense').map((r) => {
    const paidTx = b.transactions.find((t) => t.recurring_id === r.id && t.occurred_on.slice(0, 7) === monthKey);
    const due = paidTx ? paidTx.occurred_on : r.next_occurrence;
    const inMonth = due.slice(0, 7) === monthKey;
    const cat = b.categories.find((c) => c.id === r.category_id)?.name ?? null;
    return { r, paid: !!paidTx, due, inMonth, cat, amount: Number(paidTx?.amount ?? r.amount) };
  }).filter((x) => x.inMonth).sort((a, b2) => a.due.localeCompare(b2.due));
  const today = new Date().toISOString().slice(0, 10);
  const unpaid = bills.filter((x) => !x.paid);
  const stillToPay = unpaid.reduce((s, x) => s + x.amount, 0);
  const shownBills = bills.filter((x) => billFilter === 'All' || (billFilter === 'Paid' ? x.paid : !x.paid));
  const billChip = (x: (typeof bills)[number]) => {
    if (x.paid) return { t: 'Paid', k: 'good' as const };
    const days = Math.round((new Date(`${x.due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (days < 0) return { t: `${-days} day${days === -1 ? '' : 's'} overdue`, k: 'bad' as const };
    if (days === 0) return { t: 'Due today', k: 'warn' as const };
    return { t: days <= 7 ? `Due in ${days} day${days === 1 ? '' : 's'}` : `Due ${new Date(`${x.due}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, k: days <= 7 ? 'warn' as const : 'neutral' as const };
  };
  const behind = isCurrent && totalBudget > 0 && mb.overPace > 1;

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, color: 'var(--text)', fontSize: phone ? 24 : 28, fontWeight: 700, letterSpacing: '-0.035em' }}>Budget</h1>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{monthName} {y}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 36, padding: '0 4px', borderRadius: 999, border: '1px solid var(--border)' }}>
          <button aria-label="Previous month" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} style={navBtn}><GChevronLeft size={14} /></button>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', minWidth: 74, textAlign: 'center' }}>{short}</span>
          <button aria-label="Next month" disabled={isCurrent} onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} style={{ ...navBtn, opacity: isCurrent ? 0.3 : 1 }}><GChevron size={14} /></button>
        </div>
        {!phone && <button className="mm-btn mm-btn--primary" onClick={() => setAdding(true)}><GPlus size={14} />Add expense</button>}
      </div>
    </div>
  );

  if (!b.loading && b.categories.length === 0 && b.transactions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {header}
        <Empty text="Add your first category with a monthly amount — then everything you log shows against it." cta="Add expense" onCta={() => setAdding(true)} />
        {adding && <AddSheet phone={phone} b={b} onClose={() => setAdding(false)} />}
      </div>
    );
  }

  const hero = (
    <Card hero wide={!phone} style={{ gap: 12 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)' }}>Spent in {monthName}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{whole}<span style={{ fontSize: 22, color: 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>{cents}</span></div>
      {isCurrent && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pill k={mb.spentLast7 > 0 ? 'bad' : 'neutral'}>↑ {money(mb.spentLast7, false)}</Pill><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>this week</span></div>}
      <svg width="100%" height={desk ? 64 : 56} viewBox={`0 0 322 ${desk ? 64 : 56}`} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true"><path d={spark.area} fill="var(--accent-wash)" /><path d={spark.line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
      {totalBudget > 0 ? (
        <div style={{ paddingTop: 12, borderTop: '1px solid var(--grid)' }}>
          <Pace label="Pace" val={money(summary.totalExpense)} max={money(totalBudget)} fill={(summary.totalExpense / totalBudget) * 100} mark={mb.pacePct}
            chip={behind ? `Behind pace by ${money(mb.overPace, false)}` : isCurrent ? 'On pace' : summary.totalExpense > totalBudget ? `Over by ${money(summary.totalExpense - totalBudget, false)}` : 'Under budget'}
            k={behind || summary.totalExpense > totalBudget ? 'warn' : 'good'} note={isCurrent ? `Day ${mb.day} of ${mb.daysInMonth} · target ${money(mb.target, false)}` : undefined} />
        </div>
      ) : <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingTop: 12, borderTop: '1px solid var(--grid)' }}>Give your categories monthly amounts to see your pace.</span>}
    </Card>
  );
  const stats = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: phone ? 10 : 16 }}>
      <Stat label="Income" value={money(summary.totalIncome, false)} pill={incomeDelta != null ? `${incomeDelta >= 0 ? '↑' : '↓'} ${Math.abs(incomeDelta).toFixed(1)}%` : undefined} k={incomeDelta != null && incomeDelta >= 0 ? 'good' : 'bad'} />
      <Stat label="Left to spend" value={totalBudget ? money(totalBudget - summary.totalExpense, false) : '—'} pill={isCurrent && mb.perDay != null ? `${money(mb.perDay, false)} a day` : undefined} k="neutral" />
      <Stat label="Saved" value={money(Math.max(0, saved), false)} pill={saved < 0 ? `${money(-saved, false)} short` : undefined} k="bad" />
      <Stat label="Bills due" value={money(stillToPay, false)} pill={unpaid.length ? `${unpaid.length} unpaid` : bills.length ? 'All paid' : undefined} k={unpaid.some((x) => billChip(x).k === 'bad') ? 'bad' : 'neutral'} />
    </div>
  );
  const bars = (
    <Card wide={!phone} title="Monthly spending" meta="Last 6 months · tap a bar">
      <Bars vals={history.map((h) => h.s.totalExpense)} labels={history.map((h) => new Date(Number(h.k.slice(0, 4)), Number(h.k.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: 'short' }))} dec={0} />
    </Card>
  );
  const donut = (
    <Card wide={!phone} title="Where it went" meta="Tap a slice">
      <Donut rows={[...summary.byCategory.map((c) => ({ name: c.category.name, value: c.spent })), { name: 'Uncategorized', value: b.transactions.filter((t) => t.type === 'expense' && !t.category_id && t.occurred_on.slice(0, 7) === monthKey).reduce((s, t) => s + Number(t.amount), 0) }]} dec={2} total={money(summary.totalExpense)} />
    </Card>
  );
  const cats = (
    <Card wide={!phone} title="Category budgets" meta={totalBudget ? `${money(totalBudget, false)} total` : ''}>
      {summary.byCategory.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No categories yet.</span>}
      {summary.byCategory.map(({ category, allocated, spent, remaining }, i) => {
        const over = remaining < 0, pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
        return (
          <div key={category.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'][i] ?? 'var(--cat-other)' }} />
              <span style={{ flex: 1, color: 'var(--text)', fontSize: 14.5, fontWeight: 500 }}>{category.name}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(spent, false)}</span> of {money(allocated, false)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${over ? 100 : pct}%`, height: '100%', borderRadius: 999, background: over ? 'var(--danger)' : 'var(--accent)' }} /></div>
            <span>{over ? <Chip k="bad">Over by {money(-remaining, false)}</Chip> : remaining === 0 && allocated > 0 ? <Chip k="neutral">Fully spent</Chip> : <Chip k="neutral">{money(remaining, false)} left</Chip>}</span>
          </div>
        );
      })}
    </Card>
  );
  const filterPills = (
    <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
      {(['All', 'Unpaid', 'Paid'] as const).map((f) => <button key={f} onClick={() => setBillFilter(f)} style={{ padding: '6px 12px', borderRadius: 999, border: 0, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', background: billFilter === f ? 'var(--text)' : 'transparent', color: billFilter === f ? 'var(--bg)' : 'var(--text-secondary)' }}>{f}</button>)}
    </div>
  );
  const billsCard = phone ? (
    <Card flush title="Bills">
      {filterPills}
      {shownBills.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', padding: '10px 0' }}>{bills.length ? 'Nothing here.' : 'No recurring bills this month. Add them under Recurring below.'}</span>}
      {shownBills.map((x, i) => { const c = billChip(x); return <Row key={x.r.id} first={i === 0} name={x.r.name} meta={x.cat ?? undefined} chip={c.t} k={c.k} amt={money(x.amount)} dim={x.paid} />; })}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--grid)', fontSize: 13, fontWeight: 500 }}><span>Still to pay this month</span><span style={{ color: 'var(--text)' }}>{money(stillToPay)}</span></div>
    </Card>
  ) : (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Bills</span>{filterPills}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>Still to pay <span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(stillToPay)}</span></span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Bill', ...(desk ? ['Category'] : []), 'Due', 'Status', 'Amount'].map((h) => <th key={h} style={{ ...th, textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {shownBills.map((x) => { const c = billChip(x); return (
            <tr key={x.r.id}>
              <td style={{ ...td, color: 'var(--text)', fontWeight: 500 }}>{x.r.name}</td>
              {desk && <td style={td}>{x.cat ?? '—'}</td>}
              <td style={td}>{new Date(`${x.due}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
              <td style={td}><Chip k={c.k}>{c.t}</Chip></td>
              <td style={{ ...td, textAlign: 'right', color: x.paid ? 'var(--text-secondary)' : 'var(--text)', fontWeight: 600 }}>{money(x.amount)}</td>
            </tr>
          ); })}
          {shownBills.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-tertiary)' }}>{bills.length ? 'Nothing here.' : 'No recurring bills this month. Add them under Recurring below.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 20 : 16 }}>
      {header}
      {phone ? <>{hero}{stats}{bars}{donut}{billsCard}</> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: desk ? 'minmax(0, 1.35fr) minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>{hero}{stats}</div>
          <div style={{ display: 'grid', gridTemplateColumns: desk ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>{bars}{donut}{cats}</div>
          {billsCard}
        </>
      )}
      {phone && <button className="mm-btn mm-btn--primary" onClick={() => (onAdd ? onAdd() : setAdding(true))} style={{ position: 'fixed', right: 16, bottom: 'calc(80px + max(env(safe-area-inset-bottom), 20px))', zIndex: 40, height: 48, padding: '0 18px', fontSize: 15, boxShadow: '0 0 40px rgba(0,0,0,.25)' }}><GPlus size={16} />Add expense</button>}
      {adding && <AddSheet phone={phone} b={b} onClose={() => setAdding(false)} />}
    </div>
  );
}

const navBtn: CSSProperties = { width: 28, height: 28, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const th: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', padding: '10px 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' };
const td: CSSProperties = { padding: '14px 20px', borderBottom: '1px solid var(--grid)', fontSize: 14, color: 'var(--text-secondary)' };
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 46, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', outline: 'none' };

/** Add expense: amount, what, category, date. */
function AddSheet({ phone, b, onClose }: { phone: boolean; b: ReturnType<typeof useBudgeting>; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [cat, setCat] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const n = Number(amount.replace(/[$,\s]/g, ''));
  const save = async () => { if (!(n > 0)) return; setBusy(true); await b.addTransaction({ type: 'expense', amount: n, description: what.trim() || null, category_id: cat || null, occurred_on: date }); setBusy(false); onClose(); };
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--mm-scrim)' }} />
      <div role="dialog" aria-label="Add expense" style={{ position: 'fixed', zIndex: 91, ...(phone ? { left: 0, right: 0, bottom: 0, borderRadius: '16px 16px 0 0', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' } : { left: '50%', top: '18vh', transform: 'translateX(-50%)', width: 420, borderRadius: 16 }), background: 'var(--surface)', border: '1px solid var(--border)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}><span style={{ flex: 1, color: 'var(--text)', fontSize: 17, fontWeight: 600 }}>Add expense</span><button aria-label="Close" onClick={onClose} style={{ ...navBtn, width: 34, height: 34 }}><GClose size={16} /></button></div>
        <input autoFocus inputMode="decimal" placeholder="$0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...field, height: 56, fontSize: 26, fontWeight: 600 }} />
        <input placeholder="What was it?" value={what} onChange={(e) => setWhat(e.target.value)} style={field} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...field, flex: 1 }}><option value="">No category</option>{b.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, width: 150 }} />
        </div>
        <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !(n > 0)} onClick={save}>{busy ? 'Saving…' : 'Add expense'}</button>
      </div>
    </>
  );
}
