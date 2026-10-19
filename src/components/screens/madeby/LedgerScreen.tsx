import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Tabs, Sheet, Field, field } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Bars, Line } from '../../mm/charts';
import { RANGES, toEntries, summarize, socialGrowth } from '../../../data/ledgerRange';
import type { Range } from '../../../data/ledgerRange';
import { taxSetAside, TAX_LABEL, ledgerCsv, EXPENSE_CATEGORIES, INCOME_SOURCES, nextInvoiceNumber, invoiceTotal } from '../../../data/madeby';
import type { LedgerRow } from '../../../data/madeby';

type Row = LedgerRow & { id: string; party: string | null; note: string | null; auto: boolean; confirmed: boolean; bucket: string | null; receipt_path: string | null };
interface Inv { id: string; number: string; to_name: string; to_email: string | null; items: { description: string; qty: number; rate: number }[]; amount_usd: number; issue_date: string; due_date: string | null; status: string; recurring: string | null; next_issue_date: string | null; note: string | null }
interface Rec { id: string; kind: 'income' | 'expense'; party: string; amount_usd: number; category: string; day_of_month: number; active: boolean }
type Tab = 'overview' | 'income' | 'expenses' | 'invoices' | 'recurring';
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Ledger (brief §5.4): business income and expenses, separate from
 *  Invoicing. Monthly P&L, YTD, a rough tax set-aside, CSV, recurring
 *  rows, and invoices to anyone (paid → income automatically). */
export default function LedgerScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  const [rows, setRows] = useState<Row[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [pct, setPct] = useState(25);
  const [entry, setEntry] = useState<Partial<Row> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inv, setInv] = useState<Partial<Inv> | null>(null);
  const [rec, setRec] = useState<Partial<Rec> | null>(null);
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState(false);
  const [range, setRange] = useState<Range>('1m');
  const [extra, setExtra] = useState<{ ai: { date: string; cost_usd: number }[]; orders: { placed_at: string | null; created_at: string; total: number; supplier_cost: number | null; ship_cost: number | null; product_title: string | null }[]; accounts: { id: string; platform: string; handle: string | null; followers: number | null }[]; snaps: { account_id: string; captured_at: string; followers: number | null }[] }>({ ai: [], orders: [], accounts: [], snaps: [] });
  const load = useCallback(async () => {
    // Every money source, not just Ledger rows: Claude spend and Shopify sales
    // never land in biz_ledger, which is why the P&L looked stuck.
    const [ai, ord, acc, sn] = await Promise.all([
      supabase.from('ai_cost_ledger').select('date,cost_usd').order('date', { ascending: false }).limit(10000),
      supabase.from('ecom_orders').select('placed_at,created_at,total,supplier_cost,ship_cost,product_title').limit(5000),
      supabase.from('social_accounts').select('id,platform,handle,followers'),
      supabase.from('social_account_snapshots').select('account_id,captured_at,followers').order('captured_at', { ascending: true }).limit(10000),
    ]);
    setExtra({ ai: (ai.data ?? []) as never[], orders: (ord.data ?? []) as never[], accounts: (acc.data ?? []) as never[], snaps: (sn.data ?? []) as never[] });
    const [l, i, r, b] = await Promise.all([
      supabase.from('biz_ledger').select('*').order('date', { ascending: false }).limit(2000),
      supabase.from('biz_invoices').select('*').order('issue_date', { ascending: false }).limit(300),
      supabase.from('ledger_recurring').select('*').order('created_at'),
      supabase.from('business_profile').select('tax_set_aside_pct').maybeSingle(),
    ]);
    setMissing(!!l.error || !!i.error);
    setRows((l.data ?? []) as Row[]); setInvs((i.data ?? []) as Inv[]); setRecs((r.data ?? []) as Rec[]);
    const p = (b.data as { tax_set_aside_pct?: number | null } | null)?.tax_set_aside_pct; if (p != null) setPct(Number(p));
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Comes back to the tab after a sale or a bot run: show fresh numbers.
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible') void load(); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, [load]);
  const year = new Date().getFullYear();
  const now = useMemo(() => new Date(), [rows, extra]); // eslint-disable-line react-hooks/exhaustive-deps
  const entries = useMemo(() => toEntries({ ledger: rows, aiCosts: extra.ai, orders: extra.orders }), [rows, extra]);
  const sum = useMemo(() => summarize(entries, range, now), [entries, range, now]);
  const growth = useMemo(() => socialGrowth(extra.accounts, extra.snaps, range, now), [extra, range, now]);
  const rangeLabel = RANGES.find((x) => x.id === range)!.label;
  // Monthly P&L and the tax estimate use every source too.
  const pnl = useMemo(() => summarize(entries, 'all', now).buckets.filter((b) => b.income || b.expense).map((b) => ({ month: b.key, income: b.income, expense: b.expense, profit: b.profit })), [entries, now]);
  const y = useMemo(() => { const yr = pnl.filter((p) => p.month.startsWith(String(year))); const income = yr.reduce((a, p) => a + p.income, 0), expense = yr.reduce((a, p) => a + p.expense, 0); return { income, expense, profit: income - expense }; }, [pnl, year]);
  const unconfirmed = rows.filter((r) => !r.confirmed);

  const saveEntry = async () => {
    if (!entry?.amount_usd || !entry.kind) return;
    let receipt: string | null = entry.receipt_path ?? null;
    if (file) { const { data: u } = await supabase.auth.getUser(); const path = `${u.user?.id}/receipts/${Date.now()}-${file.name.replace(/[^\w.-]/g, '')}`; const up = await supabase.storage.from('brain-docs').upload(path, file); if (!up.error) receipt = path; }
    const row = { kind: entry.kind, amount_usd: Number(entry.amount_usd), date: entry.date ?? new Date().toISOString().slice(0, 10), category: entry.category ?? 'other', party: entry.party || null, note: entry.note || null, receipt_path: receipt, confirmed: true, updated_at: new Date().toISOString() };
    const { error } = entry.id ? await supabase.from('biz_ledger').update(row).eq('id', entry.id) : await supabase.from('biz_ledger').insert(row);
    setMsg(error ? error.message : 'Saved.'); setEntry(null); setFile(null); await load();
  };
  const confirm = async (id: string) => { await supabase.from('biz_ledger').update({ confirmed: true }).eq('id', id); await load(); };
  const csv = () => { const blob = new Blob([ledgerCsv(rows.filter((r) => r.confirmed))], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ledger-${year}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  const savePct = async (v: number) => { setPct(v); await supabase.from('business_profile').upsert({ tax_set_aside_pct: v, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); };
  const saveInv = async () => {
    if (!inv?.to_name?.trim()) return;
    const items = (inv.items ?? []).filter((i) => i.description.trim());
    const row = { number: inv.number ?? nextInvoiceNumber(invs.map((x) => x.number)), to_name: inv.to_name.trim(), to_email: inv.to_email || null, items, amount_usd: invoiceTotal(items), issue_date: inv.issue_date ?? new Date().toISOString().slice(0, 10), due_date: inv.due_date || null, recurring: inv.recurring || null, next_issue_date: inv.recurring ? (inv.next_issue_date ?? nextMonth(inv.issue_date ?? new Date().toISOString().slice(0, 10))) : null, note: inv.note || null, updated_at: new Date().toISOString() };
    const { error } = inv.id ? await supabase.from('biz_invoices').update(row).eq('id', inv.id) : await supabase.from('biz_invoices').insert(row);
    setMsg(error ? error.message : 'Invoice saved.'); setInv(null); await load();
  };
  const sendInv = async (id: string) => { const r = await api<{ status?: string; error?: string }>('/api/invoices/send', { body: { id } }); setMsg(r.error ?? (r.status === 'dry_run' ? 'DRY_RUN: logged, not emailed.' : 'Sent.')); await load(); };
  const paidInv = async (id: string) => { const r = await api<{ error?: string }>('/api/invoices/paid', { body: { id } }); setMsg(r.error ?? 'Marked paid. It\'s in the Ledger as income.'); await load(); };
  const saveRec = async () => {
    if (!rec?.party?.trim() || !rec.amount_usd) return;
    const row = { kind: rec.kind ?? 'income', party: rec.party.trim(), amount_usd: Number(rec.amount_usd), category: rec.category ?? (rec.kind === 'expense' ? 'software/tools' : 'APHS / James'), day_of_month: rec.day_of_month ?? 1, active: rec.active ?? true };
    const { error } = rec.id ? await supabase.from('ledger_recurring').update(row).eq('id', rec.id) : await supabase.from('ledger_recurring').insert(row);
    setMsg(error ? error.message : 'Saved. It adds itself each month for you to confirm.'); setRec(null); await load();
  };

  if (missing) return <Page title="Ledger"><Empty text="The Ledger needs the October migrations (schema_121 and schema_125) applied." /></Page>;
  const list = (kind: 'income' | 'expense') => rows.filter((r) => r.kind === kind);
  return (
    <Page title="Ledger" sub="Business money in and out. Separate from client invoicing." fab={{ t: tab === 'invoices' ? 'Invoice' : tab === 'recurring' ? 'Recurring' : 'Entry', onClick: () => tab === 'invoices' ? setInv({ items: [{ description: '', qty: 1, rate: 0 }] }) : tab === 'recurring' ? setRec({ kind: 'income', day_of_month: 1, active: true }) : setEntry({ kind: tab === 'expenses' ? 'expense' : 'income', date: new Date().toISOString().slice(0, 10), category: tab === 'expenses' ? 'software/tools' : 'Client' }) }} menu={[{ t: 'Export CSV for your accountant', onClick: csv }]}>
      <Tabs tabs={RANGES} value={range} onChange={setRange} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Stat label={`Profit · ${rangeLabel}`} value={usd(sum.profit)} pill={`${usd(sum.income)} in · ${usd(sum.expense)} out`} k={sum.profit >= 0 ? 'good' : 'bad'} />
        <Stat label="Best day" value={sum.bestDay ? usd(sum.bestDay.profit) : '—'} pill={sum.bestDay ? `${sum.bestDay.date} · ${usd(sum.bestDay.income)} in` : 'No sales yet'} k={sum.bestDay ? 'good' : undefined} />
        <Stat label="Set aside for taxes" value={usd(taxSetAside(y.profit, pct))} pill={`${pct}% · estimate`} />
        <Stat label="To confirm" value={String(unconfirmed.length)} k={unconfirmed.length ? 'warn' : undefined} />
      </div>
      <Tabs tabs={[{ id: 'overview', label: 'P&L' }, { id: 'income', label: 'Income' }, { id: 'expenses', label: 'Expenses' }, { id: 'invoices', label: 'Invoices', badge: invs.filter((i) => i.status === 'draft').length }, { id: 'recurring', label: 'Recurring' }]} value={tab} onChange={setTab} />
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}
      {unconfirmed.length > 0 && (
        <Card title="Confirm these came in" meta="recurring and auto rows">
          {unconfirmed.map((r, i) => <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1 }}>{r.party ?? r.category} · {r.date}</span><strong>{usd(Number(r.amount_usd))}</strong><button className="mm-btn mm-btn--primary" style={{ height: 32 }} onClick={() => void confirm(r.id)}>Confirm</button><button className="mm-btn" style={{ height: 32 }} onClick={() => setEntry(r)}>Edit</button></div>)}
        </Card>
      )}
      {tab === 'overview' && (
        <>
          <Card title={sum.bucketBy === 'day' ? 'Money in, day by day' : 'Money in, month by month'} meta={`${rangeLabel} · ${usd(sum.income)} in`}>
            {sum.income > 0
              ? <Bars vals={sum.buckets.map((b) => b.income)} labels={sum.buckets.map((b) => b.label)} />
              : <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No money in for this range yet. Sales, paid invoices and income you log show up here.</div>}
            {sum.buckets.filter((b) => b.income || b.expense).slice(-14).reverse().map((b, i) => (
              <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '90px repeat(3,minmax(0,1fr))', gap: 8, padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{b.label}{sum.bestDay?.date === b.key ? ' ★' : ''}</span><span>+{usd(b.income)}</span><span>−{usd(b.expense)}</span><strong style={{ color: b.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{usd(b.profit)}</strong>
              </div>
            ))}
          </Card>
          <Card title="Where it came from" meta={rangeLabel}>
            {sum.bySource.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing in this range.</div>}
            {sum.bySource.map((x, i) => (
              <div key={x.source} style={{ display: 'flex', gap: 8, padding: '6px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ flex: 1 }}>{x.source}</span>{x.income > 0 && <span style={{ color: 'var(--success)' }}>+{usd(x.income)}</span>}{x.expense > 0 && <span style={{ color: 'var(--text-secondary)' }}>−{usd(x.expense)}</span>}
              </div>
            ))}
          </Card>
          <Card title="Audience growth" meta={rangeLabel}>
            {growth.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Connect an account in Content → Accounts to track followers here.</div>}
            {growth.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>@{g.handle} <span style={{ color: 'var(--text-tertiary)' }}>· {g.platform}</span></span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{g.followersNow != null ? g.followersNow.toLocaleString('en-US') : '—'}</strong>
                  {g.change != null
                    ? <Chip k={g.change > 0 ? 'good' : g.change < 0 ? 'bad' : 'neutral'}>{g.change >= 0 ? '+' : ''}{g.change.toLocaleString('en-US')}{g.pct != null ? ` (${g.pct >= 0 ? '+' : ''}${g.pct}%)` : ''}</Chip>
                    : <Chip k="neutral">tracking started</Chip>}
                </div>
                {g.points.length > 2 && <Line vals={g.points} h={60} />}
              </div>
            ))}
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Followers are saved every few hours while an account stays connected; growth shows once there are two readings in the range.</span>
          </Card>
          <Card title="Monthly P&L" meta="all sources">
            {pnl.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No entries yet. Paid invoices, Masterminds subscriptions and approved bot spend land here on their own.</div>}
            {[...pnl].reverse().slice(0, 12).map((p, i) => (
              <div key={p.month} style={{ display: 'grid', gridTemplateColumns: '90px repeat(3,minmax(0,1fr))', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{p.month}</span><span>+{usd(p.income)}</span><span>−{usd(p.expense)}</span><strong style={{ color: p.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{usd(p.profit)}</strong>
              </div>
            ))}
          </Card>
          <Card title="Tax set-aside" meta={TAX_LABEL}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>Set aside <input type="number" min={0} max={60} style={{ ...field, width: 80, height: 36 }} value={pct} onChange={(e) => void savePct(Number(e.target.value) || 0)} />% of profit → <strong>{usd(taxSetAside(y.profit, pct))}</strong> for {year} so far.</div>
          </Card>
        </>
      )}
      {(tab === 'income' || tab === 'expenses') && (
        <Card title={tab === 'income' ? 'Income' : 'Expenses'} meta={`${list(tab === 'income' ? 'income' : 'expense').length}`}>
          {list(tab === 'income' ? 'income' : 'expense').length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing yet.</div>}
          {list(tab === 'income' ? 'income' : 'expense').slice(0, 200).map((r, i) => (
            <button key={r.id} onClick={() => setEntry(r)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}>
              <span style={{ width: 86, color: 'var(--text-tertiary)' }}>{r.date}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{r.party ?? '—'} <span style={{ color: 'var(--text-tertiary)' }}>· {r.category}</span></span>
              {r.auto && <Chip k="neutral">auto</Chip>}{r.receipt_path && <span title="receipt">🧾</span>}
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(Number(r.amount_usd))}</strong>
            </button>
          ))}
        </Card>
      )}
      {tab === 'invoices' && (
        <Card title="Invoices to anyone" meta="APHS, clients, anyone with an email">
          {invs.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No invoices yet. Use this for anyone, including APHS for the monthly dev work (set it to recur).</div>}
          {invs.map((x, i) => (
            <div key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14, flexWrap: 'wrap' }}>
              <button onClick={() => setInv(x)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 160 }}><strong>{x.number}</strong> · {x.to_name} {x.recurring && <Chip k="accent">monthly</Chip>}</button>
              <strong>{usd(Number(x.amount_usd))}</strong>
              <Chip k={x.status === 'paid' ? 'good' : x.status === 'sent' ? 'warn' : 'neutral'}>{x.status}</Chip>
              {x.status === 'draft' && <button className="mm-btn" style={{ height: 32 }} disabled={!x.to_email} onClick={() => void sendInv(x.id)}>Send</button>}
              {x.status !== 'paid' && x.status !== 'void' && <button className="mm-btn" style={{ height: 32 }} onClick={() => void paidInv(x.id)}>Mark paid</button>}
            </div>
          ))}
        </Card>
      )}
      {tab === 'recurring' && (
        <Card title="Recurring" meta="adds itself each month, unconfirmed, for you to confirm">
          {recs.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Add James's monthly pay, software subscriptions, anything that repeats.</div>}
          {recs.map((r, i) => <button key={r.id} onClick={() => setRec(r)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1 }}>{r.party} · {r.category} · day {r.day_of_month}</span><Chip k={r.kind === 'income' ? 'good' : 'neutral'}>{r.kind}</Chip><strong>{usd(Number(r.amount_usd))}</strong>{!r.active && <Chip k="neutral">paused</Chip>}</button>)}
        </Card>
      )}

      {entry && (
        <Sheet title={entry.id ? 'Edit entry' : entry.kind === 'expense' ? 'New expense' : 'New income'} onClose={() => setEntry(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>{(['income', 'expense'] as const).map((k) => <button key={k} className={`mm-btn ${entry.kind === k ? 'mm-btn--primary' : ''}`} style={{ flex: 1, height: 38 }} onClick={() => setEntry({ ...entry, kind: k })}>{k}</button>)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Amount ($)"><input style={field} inputMode="decimal" value={entry.amount_usd ?? ''} onChange={(e) => setEntry({ ...entry, amount_usd: Number(e.target.value) || 0 })} /></Field>
              <Field l="Date"><input type="date" style={field} value={entry.date ?? ''} onChange={(e) => setEntry({ ...entry, date: e.target.value })} /></Field>
            </div>
            <Field l={entry.kind === 'expense' ? 'Category' : 'Source'}><input style={field} list="ledger-cats" value={entry.category ?? ''} onChange={(e) => setEntry({ ...entry, category: e.target.value })} /><datalist id="ledger-cats">{(entry.kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_SOURCES).map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field l={entry.kind === 'expense' ? 'Vendor' : 'From (client name, APHS…)'}><input style={field} value={entry.party ?? ''} onChange={(e) => setEntry({ ...entry, party: e.target.value })} /></Field>
            <Field l="Note"><input style={field} value={entry.note ?? ''} onChange={(e) => setEntry({ ...entry, note: e.target.value })} /></Field>
            {entry.kind === 'expense' && <Field l="Receipt (optional)"><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>}
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!entry.amount_usd} onClick={() => void saveEntry()}>Save</button>
            {entry.id && <button className="mm-btn" style={{ height: 40, color: 'var(--danger)' }} onClick={async () => { if (!window.confirm('Delete this entry?')) return; await supabase.from('biz_ledger').delete().eq('id', entry.id!); setEntry(null); await load(); }}>Delete</button>}
          </div>
        </Sheet>
      )}
      {inv && (
        <Sheet title={inv.id ? `Invoice ${inv.number}` : 'New invoice'} onClose={() => setInv(null)} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Bill to"><input style={field} value={inv.to_name ?? ''} onChange={(e) => setInv({ ...inv, to_name: e.target.value })} /></Field>
              <Field l="Email"><input type="email" style={field} value={inv.to_email ?? ''} onChange={(e) => setInv({ ...inv, to_email: e.target.value })} /></Field>
            </div>
            {(inv.items ?? []).map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 100px', gap: 8 }}>
                <input style={field} placeholder="Description" value={it.description} onChange={(e) => setInv({ ...inv, items: (inv.items ?? []).map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                <input style={field} inputMode="decimal" placeholder="Qty" value={it.qty} onChange={(e) => setInv({ ...inv, items: (inv.items ?? []).map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)) })} />
                <input style={field} inputMode="decimal" placeholder="Rate" value={it.rate} onChange={(e) => setInv({ ...inv, items: (inv.items ?? []).map((x, j) => (j === i ? { ...x, rate: Number(e.target.value) || 0 } : x)) })} />
              </div>
            ))}
            <button className="mm-btn" style={{ alignSelf: 'flex-start', height: 32 }} onClick={() => setInv({ ...inv, items: [...(inv.items ?? []), { description: '', qty: 1, rate: 0 }] })}>+ Line</button>
            <div style={{ fontSize: 15 }}>Total: <strong>{usd(invoiceTotal(inv.items ?? []))}</strong></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Issue date"><input type="date" style={field} value={inv.issue_date ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setInv({ ...inv, issue_date: e.target.value })} /></Field>
              <Field l="Due date"><input type="date" style={field} value={inv.due_date ?? ''} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} /></Field>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={inv.recurring === 'monthly'} onChange={(e) => setInv({ ...inv, recurring: e.target.checked ? 'monthly' : null })} /> Repeat monthly (a new draft is made each month for you to send)</label>
            <Field l="Note"><input style={field} value={inv.note ?? ''} onChange={(e) => setInv({ ...inv, note: e.target.value })} /></Field>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!inv.to_name?.trim()} onClick={() => void saveInv()}>Save</button>
          </div>
        </Sheet>
      )}
      {rec && (
        <Sheet title="Recurring" onClose={() => setRec(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>{(['income', 'expense'] as const).map((k) => <button key={k} className={`mm-btn ${rec.kind === k ? 'mm-btn--primary' : ''}`} style={{ flex: 1, height: 38 }} onClick={() => setRec({ ...rec, kind: k })}>{k}</button>)}</div>
            <Field l="From / to"><input style={field} value={rec.party ?? ''} placeholder="APHS / James" onChange={(e) => setRec({ ...rec, party: e.target.value })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Amount ($)"><input style={field} inputMode="decimal" value={rec.amount_usd ?? ''} onChange={(e) => setRec({ ...rec, amount_usd: Number(e.target.value) || 0 })} /></Field>
              <Field l="Day of month"><input style={field} inputMode="numeric" value={rec.day_of_month ?? 1} onChange={(e) => setRec({ ...rec, day_of_month: Math.max(1, Math.min(28, Number(e.target.value) || 1)) })} /></Field>
            </div>
            <Field l="Category"><input style={field} list="ledger-cats2" value={rec.category ?? ''} onChange={(e) => setRec({ ...rec, category: e.target.value })} /><datalist id="ledger-cats2">{[...INCOME_SOURCES, ...EXPENSE_CATEGORIES].map((c) => <option key={c} value={c} />)}</datalist></Field>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={rec.active ?? true} onChange={(e) => setRec({ ...rec, active: e.target.checked })} /> Active</label>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void saveRec()}>Save</button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
function nextMonth(d: string) { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m, Math.min(day, 28))).toISOString().slice(0, 10); }
