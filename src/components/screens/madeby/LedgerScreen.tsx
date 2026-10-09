import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Tabs, Sheet, Field, field } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { monthlyPnl, ytd, taxSetAside, TAX_LABEL, ledgerCsv, EXPENSE_CATEGORIES, INCOME_SOURCES, nextInvoiceNumber, invoiceTotal } from '../../../data/madeby';
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
  const load = useCallback(async () => {
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
  const year = new Date().getFullYear();
  const pnl = useMemo(() => monthlyPnl(rows), [rows]);
  const y = useMemo(() => ytd(rows, year), [rows, year]);
  const unconfirmed = rows.filter((r) => !r.confirmed);
  const thisMonth = pnl.find((p) => p.month === new Date().toISOString().slice(0, 7));

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Stat label="This month profit" value={usd(thisMonth?.profit ?? 0)} pill={`${usd(thisMonth?.income ?? 0)} in · ${usd(thisMonth?.expense ?? 0)} out`} k={(thisMonth?.profit ?? 0) >= 0 ? 'good' : 'bad'} />
        <Stat label={`Profit ${year}`} value={usd(y.profit)} pill={`${usd(y.income)} income`} />
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
          <Card title="Monthly P&L">
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
