import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useBudgeting, currentMonthKey, shiftMonthKey, monthLabel } from '../../data/useBudgeting';
import type { BudgetType, Cadence } from '../../data/useBudgeting';
import { useSubscriptionTracker, monthlyCost, isStale } from '../../data/useSubscriptionTracker';
import type { BillingCycle } from '../../data/useSubscriptionTracker';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)', marginTop: 36, marginBottom: 14 };
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CADENCE_LABEL: Record<Cadence, string> = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' };
const CYCLE_LABEL: Record<BillingCycle, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700, color: color ?? 'var(--text)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

function CategoryForm({ onAdd }: { onAdd: (name: string, amount: number) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const submit = async () => {
    if (!name.trim() || !amount) return;
    await onAdd(name.trim(), Number(amount));
    setName(''); setAmount(''); setOpen(false);
  };
  if (!open) return <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setOpen(true)}>+ Add category</div>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input style={{ ...inputStyle, width: 160 }} placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ ...inputStyle, width: 120 }} placeholder="Monthly $" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={submit}>Save</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
    </div>
  );
}

function TransactionForm({ categories, onAdd }: { categories: { id: string; name: string }[]; onAdd: (type: BudgetType, amount: number, description: string, categoryId: string | null, occurredOn: string) => Promise<void> }) {
  const [type, setType] = useState<BudgetType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const submit = async () => {
    if (!amount) return;
    await onAdd(type, Number(amount), description.trim(), categoryId || null, occurredOn);
    setAmount(''); setDescription('');
  };
  return (
    <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={{ ...inputStyle, width: 100 }} value={type} onChange={(e) => setType(e.target.value as BudgetType)}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
      <input style={{ ...inputStyle, width: 100 }} placeholder="$" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      {type === 'expense' && (
        <select style={{ ...inputStyle, width: 150 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <input style={{ ...inputStyle, width: 145 }} type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
      <div style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={submit}>Log it</div>
    </div>
  );
}

function RecurringForm({ categories, onAdd }: { categories: { id: string; name: string }[]; onAdd: (input: { type: BudgetType; name: string; amount: number; cadence: Cadence; category_id: string | null; next_occurrence: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BudgetType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const submit = async () => {
    if (!name.trim() || !amount) return;
    await onAdd({ type, name: name.trim(), amount: Number(amount), cadence, category_id: categoryId || null, next_occurrence: start });
    setName(''); setAmount(''); setOpen(false);
  };
  if (!open) return <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setOpen(true)}>+ Add recurring item</div>;
  return (
    <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={{ ...inputStyle, width: 100 }} value={type} onChange={(e) => setType(e.target.value as BudgetType)}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
      <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="e.g. Rent, Paycheck" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ ...inputStyle, width: 100 }} placeholder="$" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select style={{ ...inputStyle, width: 140 }} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
        {(['weekly', 'biweekly', 'monthly', 'yearly'] as const).map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
      </select>
      {type === 'expense' && (
        <select style={{ ...inputStyle, width: 150 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <input style={{ ...inputStyle, width: 145 }} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      <div style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={submit}>Save</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
    </div>
  );
}

function SubscriptionForm({ onAdd }: { onAdd: (input: { name: string; cost: number; billing_cycle: BillingCycle; renewal_date: string; category: string | null }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [renewalDate, setRenewalDate] = useState('');
  const [category, setCategory] = useState('');
  const submit = async () => {
    if (!name.trim() || !cost || !renewalDate) return;
    await onAdd({ name: name.trim(), cost: Number(cost), billing_cycle: cycle, renewal_date: renewalDate, category: category.trim() || null });
    setName(''); setCost(''); setRenewalDate(''); setCategory(''); setOpen(false);
  };
  if (!open) return <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setOpen(true)}>+ Add subscription</div>;
  return (
    <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Name (e.g. Netflix)" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={{ ...inputStyle, width: 100 }} placeholder="$" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      <select style={{ ...inputStyle, width: 120 }} value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
        {(['weekly', 'monthly', 'yearly'] as const).map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}
      </select>
      <input style={{ ...inputStyle, width: 145 }} type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
      <input style={{ ...inputStyle, width: 130 }} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      <div style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={submit}>Save</div>
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
    </div>
  );
}

export default function BudgetingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const budgeting = useBudgeting();
  const subs = useSubscriptionTracker();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [costDraft, setCostDraft] = useState('');

  const summary = budgeting.getMonthSummary(monthKey);
  const isCurrentMonth = monthKey === currentMonthKey();

  const history = Array.from({ length: 6 }, (_, i) => shiftMonthKey(currentMonthKey(), -(5 - i))).map((mk) => budgeting.getMonthSummary(mk));

  return (
    <div>
      <div style={homeHeadStyle}>Budgeting</div>
      <div style={homeSubStyle}>Income, expenses, and what's coming up — including money from paid invoices.</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
        <span style={{ fontSize: 'var(--text-head)', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}>&larr;</span>
        <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)', minWidth: 140, textAlign: 'center' }}>{monthLabel(monthKey)}</div>
        <span style={{ fontSize: 'var(--text-head)', cursor: isCurrentMonth ? 'default' : 'pointer', color: isCurrentMonth ? '#33363c' : 'var(--text-secondary)' }} onClick={() => !isCurrentMonth && setMonthKey(shiftMonthKey(monthKey, 1))}>&rarr;</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <StatTile label="Income" value={money(summary.totalIncome)} color="var(--success)" />
        <StatTile label="Expenses" value={money(summary.totalExpense)} color="var(--danger)" />
        <StatTile label="Net" value={money(summary.net)} color={summary.net >= 0 ? 'var(--success)' : 'var(--danger)'} />
      </div>

      <div style={sectionTitle}>Categories</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {summary.byCategory.map(({ category, allocated, spent, remaining }) => {
          const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : spent > 0 ? 100 : 0;
          const over = remaining < 0;
          return (
            <div key={category.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-body)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{category.name}</span>
                <span style={{ color: over ? 'var(--danger)' : 'var(--text-secondary)' }}>{money(spent)} of {money(allocated)}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-pill)', marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--danger)' : 'var(--text)', borderRadius: 'var(--radius-pill)' }} />
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: over ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 6 }}>
                {over ? `${money(Math.abs(remaining))} over` : `${money(remaining)} remaining`}
              </div>
            </div>
          );
        })}
        {summary.byCategory.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No categories yet.</div>}
        <CategoryForm onAdd={(name, amount) => budgeting.addCategory(name, amount)} />
      </div>

      <div style={sectionTitle}>Log a transaction</div>
      <TransactionForm
        categories={budgeting.categories}
        onAdd={(type, amount, description, categoryId, occurredOn) => budgeting.addTransaction({ type, amount, description: description || null, category_id: categoryId, occurred_on: occurredOn })}
      />
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginTop: 12 }}>
        {budgeting.transactions.filter((t) => t.occurred_on.slice(0, 7) === monthKey).slice(0, 25).map((t) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--surface-3)', fontSize: 'var(--text-body-sm)' }}>
            <span style={{ color: 'var(--text)' }}>{t.description || (t.type === 'income' ? 'Income' : 'Expense')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{new Date(t.occurred_on + 'T00:00:00').toLocaleDateString()}</span>
              <span style={{ fontWeight: 600, color: t.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</span>
              <span style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => budgeting.removeTransaction(t.id)}>Delete</span>
            </div>
          </div>
        ))}
        {budgeting.paidInvoices.filter((i) => i.paid_at.slice(0, 7) === monthKey).map((inv) => (
          <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--surface-3)', fontSize: 'var(--text-body-sm)' }}>
            <span style={{ color: 'var(--text)' }}>{inv.label} <span style={{ color: 'var(--text-tertiary)' }}>(invoice, paid)</span></span>
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>+{money(inv.amount)}</span>
          </div>
        ))}
        {budgeting.transactions.filter((t) => t.occurred_on.slice(0, 7) === monthKey).length === 0 && budgeting.paidInvoices.filter((i) => i.paid_at.slice(0, 7) === monthKey).length === 0 && (
          <div style={{ padding: 16, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing logged for this month yet.</div>
        )}
      </div>

      <div style={sectionTitle}>Recurring</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {budgeting.recurring.map((r) => (
          <div key={r.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{CADENCE_LABEL[r.cadence]} · next {new Date(r.next_occurrence + 'T00:00:00').toLocaleDateString()}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, color: r.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>{r.type === 'income' ? '+' : '-'}{money(r.amount)}</span>
              <span style={{ color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--text-small)' }} onClick={() => budgeting.removeRecurring(r.id)}>Remove</span>
            </div>
          </div>
        ))}
        <RecurringForm categories={budgeting.categories} onAdd={budgeting.addRecurring} />
      </div>

      <div style={sectionTitle}>Month over month</div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {history.map((h) => (
          <div key={h.monthKey} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--surface-3)', fontSize: 'var(--text-body-sm)' }}>
            <span style={{ color: 'var(--text)' }}>{monthLabel(h.monthKey)}</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ color: 'var(--success)' }}>+{money(h.totalIncome)}</span>
              <span style={{ color: 'var(--danger)' }}>-{money(h.totalExpense)}</span>
              <span style={{ fontWeight: 600, color: h.net >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 80, textAlign: 'right' }}>{money(h.net)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Tracker */}
      <div style={{ ...sectionTitle, marginTop: 48, fontSize: 17 }}>Subscription Tracker</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatTile label="Monthly spend" value={money(subs.totalMonthly)} />
        <StatTile label="Annual spend" value={money(subs.totalAnnual)} />
        <StatTile label="Renewing in 30 days" value={String(subs.upcomingRenewals.length)} color={subs.upcomingRenewals.length > 0 ? 'var(--warning)' : undefined} />
      </div>

      {subs.staleSubscriptions.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 14, borderColor: 'color-mix(in srgb, var(--danger) 33%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)' }}>
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--danger)' }}>Up for review — not marked used in 45+ days</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {subs.staleSubscriptions.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-body-sm)' }}>
                <span style={{ color: 'var(--text)' }}>{s.name} — {money(monthlyCost(s))}/mo</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--success)', cursor: 'pointer' }} onClick={() => subs.markUsed(s.id)}>Still using it</span>
                  <span style={{ color: 'var(--danger)', cursor: 'pointer' }} onClick={() => subs.removeSubscription(s.id)}>Cancel/remove</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {subs.subscriptions.map((s) => (
          <div key={s.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{s.name}{s.category ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {s.category}</span> : null}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{CYCLE_LABEL[s.billing_cycle]} · renews {new Date(s.renewal_date + 'T00:00:00').toLocaleDateString()}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{money(s.cost)}</span>
              {!isStale(s) && <span style={{ color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--text-small)' }} onClick={() => subs.markUsed(s.id)}>Mark used</span>}
              <span style={{ color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 'var(--text-small)' }} onClick={() => subs.removeSubscription(s.id)}>Remove</span>
            </div>
          </div>
        ))}
        {subs.subscriptions.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No subscriptions tracked yet.</div>}
        <SubscriptionForm onAdd={subs.addSubscription} />
      </div>

      <div style={{ ...cardStyle, marginTop: 20, maxWidth: 480 }}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Mastermind savings comparison</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 12 }}>What you'd pay for what Mastermind consolidates, vs. what Mastermind costs.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-body)', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Your tracked subscriptions</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{money(subs.totalMonthly)}/mo</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-body)', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Mastermind</span>
          <input
            style={{ ...inputStyle, width: 90, padding: '5px 8px', textAlign: 'right' }}
            type="number"
            value={costDraft || String(subs.mastermindMonthlyCost)}
            onChange={(e) => setCostDraft(e.target.value)}
            onBlur={() => { if (costDraft) { subs.setMastermindCost(Number(costDraft)); setCostDraft(''); } }}
          />
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-label)', fontWeight: 700 }}>
          <span style={{ color: 'var(--text)' }}>{subs.totalMonthly > subs.mastermindMonthlyCost ? "You're still paying more elsewhere" : 'Your subscriptions cost less right now'}</span>
        </div>
        <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: subs.totalMonthly > subs.mastermindMonthlyCost ? 'var(--success)' : 'var(--danger)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          {money(Math.abs(subs.totalMonthly - subs.mastermindMonthlyCost))}/mo {subs.totalMonthly > subs.mastermindMonthlyCost ? 'saved by consolidating' : 'more than your subscriptions'}
        </div>
      </div>
    </div>
  );
}
