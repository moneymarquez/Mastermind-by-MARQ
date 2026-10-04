import { useState } from 'react';
import type { ReactNode } from 'react';
import { useBudgeting, currentMonthKey, shiftMonthKey, monthLabel } from '../../../data/useBudgeting';
import type { BudgetType, Cadence } from '../../../data/useBudgeting';
import { useSubscriptionTracker, monthlyCost, isStale } from '../../../data/useSubscriptionTracker';
import type { BillingCycle } from '../../../data/useSubscriptionTracker';
import { askConfirm } from '../../../lib/confirm';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Bars } from '../../mm/charts';
import { Sheet, Field, field, Tabs, useModule } from '../../mm/Page';

type T = 'log' | 'recurring' | 'subs' | 'categories' | 'history';
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const CADENCE: Record<Cadence, string> = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' };
const CYCLE: Record<BillingCycle, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

function Line({ name, meta, amt, tone, first, action }: { name: ReactNode; meta?: ReactNode; amt?: string; tone?: 'in' | 'out'; first?: boolean; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {meta && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{meta}</div>}
      </div>
      {amt && <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: tone === 'in' ? 'var(--success)' : 'var(--text)' }}>{amt}</span>}
      {action}
    </div>
  );
}
const x = (onClick: () => void, label: string) => <button className="mm-icon-btn" aria-label={label} onClick={onClick} style={{ width: 32, height: 32, color: 'var(--text-tertiary)' }}>×</button>;
const TypeToggle = ({ v, set }: { v: BudgetType; set: (t: BudgetType) => void }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
    {(['expense', 'income'] as BudgetType[]).map((t) => <button key={t} className="mm-btn" onClick={() => set(t)} style={{ height: 40, ...(v === t ? { background: 'var(--surface-3)', borderColor: 'var(--text-tertiary)' } : {}) }}>{t === 'expense' ? 'Expense' : 'Income'}</button>)}
  </div>
);

/** Budgeting's working tools under the overview: the log, recurring,
 *  subscriptions, categories and month-over-month history. */
export default function BudgetTools({ b, monthKey }: { b: ReturnType<typeof useBudgeting>; monthKey: string }) {
  const { device } = useModule();
  const phone = device === 'phone';
  const subs = useSubscriptionTracker();
  const [tab, setTab] = useState<T>('log');
  const [sheet, setSheet] = useState<T | null>(null);
  const [costDraft, setCostDraft] = useState('');
  const tx = b.transactions.filter((t) => t.occurred_on.slice(0, 7) === monthKey);
  const inv = b.paidInvoices.filter((i) => i.paid_at.slice(0, 7) === monthKey);
  const history = Array.from({ length: 6 }, (_, i) => shiftMonthKey(currentMonthKey(), -(5 - i))).map((mk) => b.getMonthSummary(mk));
  const addLabel: Record<T, string> = { log: 'Log', recurring: 'Add recurring', subs: 'Add subscription', categories: 'Add category', history: '' };

  const body: Record<T, ReactNode> = {
    log: (
      <div>
        {tx.slice(0, 40).map((t, i) => <Line key={t.id} first={i === 0} name={t.description || (t.type === 'income' ? 'Income' : 'Expense')} meta={`${day(t.occurred_on)}${t.category_id ? ` · ${b.categories.find((c) => c.id === t.category_id)?.name ?? ''}` : ''}`} amt={`${t.type === 'income' ? '+' : '−'}${money(t.amount)}`} tone={t.type === 'income' ? 'in' : 'out'} action={x(async () => { if (await askConfirm('Delete this transaction?')) b.removeTransaction(t.id); }, 'Delete transaction')} />)}
        {inv.map((i, n) => <Line key={i.id} first={!tx.length && n === 0} name={i.label} meta={<><Chip k="client">Invoice paid</Chip> {day(i.paid_at)}</>} amt={`+${money(i.amount)}`} tone="in" />)}
        {!tx.length && !inv.length && <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing logged for {monthLabel(monthKey)} yet.</div>}
      </div>
    ),
    recurring: (
      <div>
        {b.recurring.map((r, i) => <Line key={r.id} first={i === 0} name={r.name} meta={`${CADENCE[r.cadence]} · next ${day(r.next_occurrence)}`} amt={`${r.type === 'income' ? '+' : '−'}${money(r.amount)}`} tone={r.type === 'income' ? 'in' : 'out'} action={x(async () => { if (await askConfirm(`Stop tracking ${r.name}?`)) b.removeRecurring(r.id); }, 'Remove recurring')} />)}
        {!b.recurring.length && <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No recurring income or bills yet. Bills added here show up on the overview and in Cash-Flow.</div>}
      </div>
    ),
    subs: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
          <Stat label="Monthly" value={money(subs.totalMonthly)} />
          <Stat label="Yearly" value={money(subs.totalAnnual)} />
          <Stat label="Renewing soon" value={String(subs.upcomingRenewals.length)} pill="Next 30 days" k={subs.upcomingRenewals.length ? 'warn' : 'neutral'} />
        </div>
        {subs.staleSubscriptions.length > 0 && (
          <div style={{ padding: 14, borderRadius: 12, background: 'color-mix(in srgb, var(--danger) 7%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--border))', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600 }}>Up for review: not used in 45+ days</span>
            {subs.staleSubscriptions.map((s, i) => <Line key={s.id} first={i === 0} name={s.name} meta={`${money(monthlyCost(s))} a month`} action={<><button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => subs.markUsed(s.id)}>Still using</button><button className="mm-btn" style={{ height: 32, fontSize: 13, color: 'var(--danger)' }} onClick={() => subs.removeSubscription(s.id)}>Remove</button></>} />)}
          </div>
        )}
        <div>
          {subs.subscriptions.map((s, i) => <Line key={s.id} first={i === 0} name={<>{s.name}{s.category && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {s.category}</span>}</>} meta={`${CYCLE[s.billing_cycle]} · renews ${day(s.renewal_date)}`} amt={money(s.cost)} action={<>{!isStale(s) && <button className="mm-btn" style={{ height: 32, fontSize: 12.5, padding: '0 10px' }} onClick={() => subs.markUsed(s.id)}>Used</button>}{x(() => subs.removeSubscription(s.id), 'Remove subscription')}</>} />)}
          {!subs.subscriptions.length && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No subscriptions tracked yet.</div>}
        </div>
        <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>What Mastermind replaces</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: 'var(--text-secondary)' }}>Your tracked subscriptions</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(subs.totalMonthly)}/mo</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}><span style={{ color: 'var(--text-secondary)' }}>Mastermind</span><input aria-label="Mastermind monthly cost" type="number" value={costDraft || String(subs.mastermindMonthlyCost)} onChange={(e) => setCostDraft(e.target.value)} onBlur={() => { if (costDraft) { subs.setMastermindCost(Number(costDraft)); setCostDraft(''); } }} style={{ ...field, width: 100, minHeight: 36, height: 36, textAlign: 'right' }} /></div>
          <span style={{ fontSize: 15, fontWeight: 600, color: subs.totalMonthly > subs.mastermindMonthlyCost ? 'var(--success)' : 'var(--text-secondary)' }}>{money(Math.abs(subs.totalMonthly - subs.mastermindMonthlyCost))}/mo {subs.totalMonthly > subs.mastermindMonthlyCost ? 'saved by consolidating' : 'more than your subscriptions today'}</span>
        </div>
      </div>
    ),
    categories: (
      <div>
        {b.categories.map((c, i) => <CategoryLine key={c.id} first={i === 0} name={c.name} amount={Number(c.monthly_amount || 0)} onSave={(n) => b.updateCategory(c.id, { monthly_amount: n })} onRemove={async () => { if (await askConfirm(`Delete the ${c.name} category? Its transactions stay, uncategorized.`)) b.removeCategory(c.id); }} />)}
        {!b.categories.length && <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No categories yet. Add one with a monthly amount and the overview tracks it.</div>}
      </div>
    ),
    history: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 14 }}>
        <Bars vals={history.map((h) => Math.round(h.net))} labels={history.map((h) => monthLabel(h.monthKey).slice(0, 3))} h={120} />
        <div>{history.slice().reverse().map((h, i) => <Line key={h.monthKey} first={i === 0} name={monthLabel(h.monthKey)} meta={`+${money(h.totalIncome)} in · −${money(h.totalExpense)} out`} amt={`${h.net < 0 ? '−' : ''}${money(Math.abs(h.net))}`} tone={h.net >= 0 ? 'in' : 'out'} />)}</div>
      </div>
    ),
  };
  return (
    <>
      <Card title="Tools" meta={tab === 'log' ? monthLabel(monthKey) : undefined} flush wide={!phone}
        action={tab !== 'history' ? <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => setSheet(tab)}>{addLabel[tab]}</button> : undefined}>
        <div style={{ padding: '6px 0 12px' }}>
          <Tabs<T> tabs={[{ id: 'log', label: 'Transactions' }, { id: 'recurring', label: 'Recurring' }, { id: 'subs', label: 'Subscriptions', badge: subs.staleSubscriptions.length || undefined }, { id: 'categories', label: 'Categories' }, { id: 'history', label: 'History' }]} value={tab} onChange={setTab} />
        </div>
        {body[tab]}
      </Card>
      {sheet === 'log' && <TxSheet b={b} onClose={() => setSheet(null)} />}
      {sheet === 'recurring' && <RecurringSheet b={b} onClose={() => setSheet(null)} />}
      {sheet === 'subs' && <SubSheet onAdd={subs.addSubscription} onClose={() => setSheet(null)} />}
      {sheet === 'categories' && <CatSheet onAdd={(n, a) => b.addCategory(n, a)} onClose={() => setSheet(null)} />}
    </>
  );
}

function CategoryLine({ name, amount, onSave, onRemove, first }: { name: string; amount: number; onSave: (n: number) => void; onRemove: () => void; first: boolean }) {
  const [v, setV] = useState(String(amount));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>{name}</span>
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>$</span>
      <input aria-label={`${name} monthly amount`} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== amount) onSave(n); }} style={{ ...field, width: 100, minHeight: 36, height: 36, textAlign: 'right' }} />
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>/mo</span>
      <button className="mm-icon-btn" aria-label={`Delete ${name}`} onClick={onRemove} style={{ width: 32, height: 32, color: 'var(--text-tertiary)' }}>×</button>
    </div>
  );
}

function TxSheet({ b, onClose }: { b: ReturnType<typeof useBudgeting>; onClose: () => void }) {
  const [type, setType] = useState<BudgetType>('expense'); const [amount, setAmount] = useState(''); const [what, setWhat] = useState('');
  const [cat, setCat] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false);
  const n = Number(amount.replace(/[$,\s]/g, ''));
  return (
    <Sheet title="Log a transaction" onClose={onClose}>
      <TypeToggle v={type} set={setType} />
      <input autoFocus inputMode="decimal" placeholder="$0.00" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...field, height: 56, fontSize: 26, fontWeight: 600 }} />
      <Field l="What was it?"><input value={what} onChange={(e) => setWhat(e.target.value)} style={field} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={field}><option value="">None</option>{b.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field l="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} /></Field>
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !(n > 0)} onClick={async () => { setBusy(true); await b.addTransaction({ type, amount: n, description: what.trim() || null, category_id: cat || null, occurred_on: date }); setBusy(false); onClose(); }}>{busy ? 'Saving…' : type === 'income' ? 'Log income' : 'Log expense'}</button>
    </Sheet>
  );
}
function RecurringSheet({ b, onClose }: { b: ReturnType<typeof useBudgeting>; onClose: () => void }) {
  const [type, setType] = useState<BudgetType>('expense'); const [name, setName] = useState(''); const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly'); const [cat, setCat] = useState(''); const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add recurring" onClose={onClose}>
      <TypeToggle v={type} set={setType} />
      <Field l="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent" style={field} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Amount"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={field} /></Field>
        <Field l="How often"><select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} style={field}>{Object.entries(CADENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={field}><option value="">None</option>{b.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field l="Next date"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={field} /></Field>
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !name.trim() || !(Number(amount) > 0)} onClick={async () => { setBusy(true); await b.addRecurring({ type, name: name.trim(), amount: Number(amount), cadence, category_id: cat || null, next_occurrence: start }); setBusy(false); onClose(); }}>Add</button>
    </Sheet>
  );
}
function SubSheet({ onAdd, onClose }: { onAdd: ReturnType<typeof useSubscriptionTracker>['addSubscription']; onClose: () => void }) {
  const [name, setName] = useState(''); const [cost, setCost] = useState(''); const [cycle, setCycle] = useState<BillingCycle>('monthly'); const [renew, setRenew] = useState(''); const [cat, setCat] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add subscription" onClose={onClose}>
      <Field l="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Canva" style={field} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Cost"><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} style={field} /></Field>
        <Field l="Billed"><select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} style={field}>{Object.entries(CYCLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Renews"><input type="date" value={renew} onChange={(e) => setRenew(e.target.value)} style={field} /></Field>
        <Field l="Category"><input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Optional" style={field} /></Field>
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !name.trim() || !(Number(cost) > 0) || !renew} onClick={async () => { setBusy(true); await onAdd({ name: name.trim(), cost: Number(cost), billing_cycle: cycle, renewal_date: renew, category: cat.trim() || null }); setBusy(false); onClose(); }}>Add</button>
    </Sheet>
  );
}
function CatSheet({ onAdd, onClose }: { onAdd: (n: string, a: number) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add category" onClose={onClose}>
      <Field l="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Food" style={field} /></Field>
      <Field l="Monthly amount"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" style={field} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !name.trim()} onClick={async () => { setBusy(true); await onAdd(name.trim(), Number(amount) || 0); setBusy(false); onClose(); }}>Add category</button>
    </Sheet>
  );
}
