import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { computeInvoiceTotal } from './invoiceAmount';
import { dateStr } from './time';
import { askClaude, AiError } from '../lib/ai';

interface ForecastEvent {
  date: string;
  amount: number; // signed: positive = income, negative = expense
  label: string;
}

export interface ForecastDay {
  date: string;
  balance: number;
  events: ForecastEvent[];
}

export interface Forecast {
  startingBalance: number;
  avgDailyVariableExpense: number;
  days: ForecastDay[];
  balanceAt30: number;
  balanceAt60: number;
  balanceAt90: number;
  firstShortfall: { date: string; drivers: string[] } | null;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function addCadenceDays(dateStrVal: string, cadence: string): string {
  const d = new Date(`${dateStrVal}T00:00:00`);
  if (cadence === 'weekly') d.setDate(d.getDate() + 7);
  else if (cadence === 'biweekly') d.setDate(d.getDate() + 14);
  else if (cadence === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function gatherEvents(today: string, horizonEnd: string): Promise<{ events: ForecastEvent[]; startingBalance: number; avgDailyVariableExpense: number }> {
  const thirtyAgo = addDays(today, -30);
  const [settingsRes, recurringRes, invoicesRes, subsRes, variableTxRes] = await Promise.all([
    supabase.from('budget_settings').select('current_balance').maybeSingle(),
    supabase.from('budget_recurring').select('name, type, amount, cadence, next_occurrence').eq('active', true),
    supabase.from('client_documents').select('label, data').eq('doc_type', 'invoice').neq('status', 'paid'),
    supabase.from('tracked_subscriptions').select('name, cost, billing_cycle, renewal_date'),
    supabase.from('budget_transactions').select('amount').eq('type', 'expense').is('recurring_id', null).gte('occurred_on', thirtyAgo).lt('occurred_on', today),
  ]);

  const events: ForecastEvent[] = [];

  for (const r of recurringRes.data ?? []) {
    let occ = r.next_occurrence as string;
    let guard = 0;
    while (occ <= horizonEnd && guard < 60) {
      if (occ >= today) {
        events.push({ date: occ, amount: r.type === 'income' ? Number(r.amount) : -Number(r.amount), label: r.name as string });
      }
      occ = addCadenceDays(occ, r.cadence as string);
      guard += 1;
    }
  }

  for (const inv of (invoicesRes.data ?? []) as { label: string; data: Record<string, unknown> }[]) {
    const dueDate = typeof inv.data.due_date === 'string' && inv.data.due_date ? inv.data.due_date : null;
    if (!dueDate || dueDate < today || dueDate > horizonEnd) continue;
    const amount = computeInvoiceTotal(inv.data);
    if (amount > 0) events.push({ date: dueDate, amount, label: `Invoice: ${inv.label}` });
  }

  for (const s of subsRes.data ?? []) {
    let occ = s.renewal_date as string;
    let guard = 0;
    while (occ <= horizonEnd && guard < 60) {
      if (occ >= today) events.push({ date: occ, amount: -Number(s.cost), label: `Subscription: ${s.name}` });
      occ = addCadenceDays(occ, s.billing_cycle === 'yearly' ? 'yearly' : s.billing_cycle === 'weekly' ? 'weekly' : 'monthly');
      guard += 1;
    }
  }

  const variableTotal = (variableTxRes.data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  const avgDailyVariableExpense = variableTotal / 30;

  return { events, startingBalance: Number(settingsRes.data?.current_balance ?? 0), avgDailyVariableExpense };
}

function buildForecast(today: string, startingBalance: number, avgDailyVariableExpense: number, events: ForecastEvent[]): Forecast {
  const days: ForecastDay[] = [];
  let balance = startingBalance;
  let firstShortfall: { date: string; drivers: string[] } | null = null;
  const recentDrivers: string[] = [];

  for (let i = 0; i <= 90; i++) {
    const date = addDays(today, i);
    const dayEvents = events.filter((e) => e.date === date);
    for (const e of dayEvents) {
      balance += e.amount;
      recentDrivers.push(`${e.label} (${e.amount >= 0 ? '+' : ''}${e.amount.toFixed(0)} on ${date})`);
    }
    if (i > 0) balance -= avgDailyVariableExpense; // day 0 (today) isn't discounted — the day's already happening
    days.push({ date, balance, events: dayEvents });
    if (balance < 0 && !firstShortfall) {
      firstShortfall = { date, drivers: recentDrivers.slice(-5) };
    }
  }

  return {
    startingBalance, avgDailyVariableExpense, days,
    balanceAt30: days[30].balance, balanceAt60: days[60].balance, balanceAt90: days[90].balance,
    firstShortfall,
  };
}

export function useCashFlow() {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioAnswer, setScenarioAnswer] = useState('');
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const today = dateStr(new Date());
    const horizonEnd = addDays(today, 90);
    const { events, startingBalance, avgDailyVariableExpense } = await gatherEvents(today, horizonEnd);
    setForecast(buildForecast(today, startingBalance, avgDailyVariableExpense, events));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStartingBalance = async (value: number) => {
    await supabase.from('budget_settings').upsert({ current_balance: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    await load();
  };

  const askScenario = async (question: string) => {
    if (!forecast) return;
    setScenarioLoading(true);
    setScenarioError('');
    setScenarioAnswer('');
    try {
      const text = await askClaude({
        system:
          "You are Nova, doing scenario analysis on Cristopher's real cash-flow forecast inside Mastermind by MARQ. " +
          'Reason from the real numbers given — don\'t invent figures not in the data. Give a direct, numeric answer where possible, and note this is an estimate, not a guarantee.',
        messages: [{
          role: 'user',
          content:
            `Current forecast: starting balance $${forecast.startingBalance.toFixed(0)}, average daily variable spend $${forecast.avgDailyVariableExpense.toFixed(0)}, ` +
            `projected balance in 30 days $${forecast.balanceAt30.toFixed(0)}, 60 days $${forecast.balanceAt60.toFixed(0)}, 90 days $${forecast.balanceAt90.toFixed(0)}. ` +
            `${forecast.firstShortfall ? `Projected shortfall on ${forecast.firstShortfall.date}, driven by: ${forecast.firstShortfall.drivers.join(', ')}.` : 'No projected shortfall in the next 90 days.'}\n\n` +
            `Scenario question: ${question}`,
        }],
        maxTokens: 500,
      });
      setScenarioAnswer(text);
    } catch (e) {
      setScenarioError(e instanceof AiError ? e.message : 'Could not run that scenario.');
    } finally {
      setScenarioLoading(false);
    }
  };

  return { forecast, loading, setStartingBalance, askScenario, scenarioAnswer, scenarioLoading, scenarioError };
}
