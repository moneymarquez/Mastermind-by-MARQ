import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { computeInvoiceTotal } from './invoiceAmount';

export type BudgetType = 'income' | 'expense';
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface BudgetCategory {
  id: string;
  name: string;
  monthly_amount: number;
  icon: string | null;
}

export interface BudgetRecurring {
  id: string;
  category_id: string | null;
  type: BudgetType;
  name: string;
  amount: number;
  cadence: Cadence;
  next_occurrence: string;
  active: boolean;
}

export interface BudgetTransaction {
  id: string;
  category_id: string | null;
  recurring_id: string | null;
  type: BudgetType;
  amount: number;
  description: string | null;
  occurred_on: string;
}

export interface PaidInvoiceIncome {
  id: string;
  label: string;
  amount: number;
  paid_at: string;
}

export interface MonthSummary {
  monthKey: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  byCategory: { category: BudgetCategory; allocated: number; spent: number; remaining: number }[];
}

const monthKeyOf = (dateStr: string) => dateStr.slice(0, 7); // 'YYYY-MM' off an ISO date/timestamp

function addCadence(dateStr: string, cadence: Cadence): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (cadence === 'weekly') d.setDate(d.getDate() + 7);
  else if (cadence === 'biweekly') d.setDate(d.getDate() + 14);
  else if (cadence === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function useBudgeting() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [recurring, setRecurring] = useState<BudgetRecurring[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoiceIncome[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, recRes, txRes, invRes] = await Promise.all([
      supabase.from('budget_categories').select('*').order('name'),
      supabase.from('budget_recurring').select('*').eq('active', true),
      supabase.from('budget_transactions').select('*').order('occurred_on', { ascending: false }),
      supabase.from('client_documents').select('id, label, data, paid_at').eq('doc_type', 'invoice').eq('status', 'paid').not('paid_at', 'is', null),
    ]);
    setCategories(((catRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, name: r.name as string, monthly_amount: Number(r.monthly_amount), icon: r.icon as string | null,
    })));
    setRecurring(((recRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, category_id: r.category_id as string | null, type: r.type as BudgetType, name: r.name as string,
      amount: Number(r.amount), cadence: r.cadence as Cadence, next_occurrence: r.next_occurrence as string, active: r.active as boolean,
    })));
    setTransactions(((txRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, category_id: r.category_id as string | null, recurring_id: r.recurring_id as string | null,
      type: r.type as BudgetType, amount: Number(r.amount), description: r.description as string | null, occurred_on: r.occurred_on as string,
    })));
    setPaidInvoices(((invRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, label: r.label as string, amount: computeInvoiceTotal(r.data as Record<string, unknown>), paid_at: r.paid_at as string,
    })));
    setLoading(false);
  }, []);

  // Materializes any recurring rule whose next_occurrence has arrived (or
  // passed, e.g. the app wasn't opened for a while) into real
  // budget_transactions rows, then advances next_occurrence past today —
  // this is the "auto-populate each period" requirement. Runs once after
  // the initial load, capped per-rule so a very old rule can't generate an
  // unbounded backlog in one pass.
  const catchUpRecurring = useCallback(async () => {
    const { data: recRows } = await supabase.from('budget_recurring').select('*').eq('active', true);
    const today = new Date().toISOString().slice(0, 10);
    let anyInserted = false;
    for (const row of (recRows ?? []) as Record<string, unknown>[]) {
      let next = row.next_occurrence as string;
      const cadence = row.cadence as Cadence;
      let guard = 0;
      const toInsert: { occurred_on: string }[] = [];
      while (next <= today && guard < 36) {
        toInsert.push({ occurred_on: next });
        next = addCadence(next, cadence);
        guard += 1;
      }
      if (toInsert.length === 0) continue;
      anyInserted = true;
      await supabase.from('budget_transactions').insert(
        toInsert.map((t) => ({
          category_id: row.category_id, recurring_id: row.id, type: row.type, amount: row.amount,
          description: row.name, occurred_on: t.occurred_on,
        }))
      );
      await supabase.from('budget_recurring').update({ next_occurrence: next }).eq('id', row.id as string);
    }
    if (anyInserted) await load();
  }, [load]);

  useEffect(() => {
    load().then(() => catchUpRecurring());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async (name: string, monthly_amount: number, icon?: string) => {
    await supabase.from('budget_categories').insert({ name, monthly_amount, icon: icon ?? null });
    await load();
  };
  const updateCategory = async (id: string, patch: Partial<Pick<BudgetCategory, 'name' | 'monthly_amount' | 'icon'>>) => {
    await supabase.from('budget_categories').update(patch).eq('id', id);
    await load();
  };
  const removeCategory = async (id: string) => {
    await supabase.from('budget_categories').delete().eq('id', id);
    await load();
  };

  const addRecurring = async (input: Omit<BudgetRecurring, 'id' | 'active'>) => {
    await supabase.from('budget_recurring').insert({ ...input, active: true });
    await load();
  };
  const removeRecurring = async (id: string) => {
    await supabase.from('budget_recurring').update({ active: false }).eq('id', id);
    await load();
  };

  const addTransaction = async (input: Omit<BudgetTransaction, 'id' | 'recurring_id'>) => {
    await supabase.from('budget_transactions').insert({ ...input, recurring_id: null });
    await load();
  };
  const removeTransaction = async (id: string) => {
    await supabase.from('budget_transactions').delete().eq('id', id);
    await load();
  };

  const getMonthSummary = useCallback((monthKey: string): MonthSummary => {
    const monthTx = transactions.filter((t) => monthKeyOf(t.occurred_on) === monthKey);
    const monthInvoices = paidInvoices.filter((i) => monthKeyOf(i.paid_at) === monthKey);
    const manualIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const invoiceIncome = monthInvoices.reduce((s, i) => s + i.amount, 0);
    const totalIncome = manualIncome + invoiceIncome;
    const totalExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const byCategory = categories.map((cat) => {
      const spent = monthTx.filter((t) => t.type === 'expense' && t.category_id === cat.id).reduce((s, t) => s + t.amount, 0);
      return { category: cat, allocated: cat.monthly_amount, spent, remaining: cat.monthly_amount - spent };
    });
    return { monthKey, totalIncome, totalExpense, net: totalIncome - totalExpense, byCategory };
  }, [transactions, paidInvoices, categories]);

  return {
    loading, categories, recurring, transactions, paidInvoices,
    addCategory, updateCategory, removeCategory,
    addRecurring, removeRecurring,
    addTransaction, removeTransaction,
    getMonthSummary, refresh: load,
  };
}

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
