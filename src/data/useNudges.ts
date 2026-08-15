import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dateStr } from './time';

export type NudgeCategory = 'missed_checkin' | 'budget' | 'activity_dropoff' | 'goal_pace' | 'subscription' | 'cold_followup';

export interface Nudge {
  id: string;
  category: NudgeCategory;
  message: string;
  target_screen: string | null;
  created_at: string;
}

export interface NudgeSettings {
  missed_checkin_enabled: boolean;
  budget_enabled: boolean;
  activity_dropoff_enabled: boolean;
  goal_pace_enabled: boolean;
  subscription_enabled: boolean;
  cold_followup_enabled: boolean;
  daily_cap: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const DEFAULT_SETTINGS: NudgeSettings = {
  missed_checkin_enabled: true, budget_enabled: true, activity_dropoff_enabled: true,
  goal_pace_enabled: true, subscription_enabled: true, cold_followup_enabled: true,
  daily_cap: 5, quiet_hours_start: null, quiet_hours_end: null,
};

interface Candidate {
  category: NudgeCategory;
  message: string;
  target_screen: string | null;
  source_key: string;
}

function inQuietHours(settings: NudgeSettings): boolean {
  if (!settings.quiet_hours_start || !settings.quiet_hours_end) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = settings.quiet_hours_start.split(':').map(Number);
  const [eh, em] = settings.quiet_hours_end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
}

// ── Trigger checks — each reads only the tables it needs and returns
// candidate nudges with a stable source_key so re-running never
// duplicates the same underlying fact. ──────────────────────────────────

async function checkMissedCheckin(): Promise<Candidate[]> {
  const since = new Date();
  since.setDate(since.getDate() - 3);
  const { data } = await supabase
    .from('bender_sessions')
    .select('id, started_at')
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((s) => ({
    category: 'missed_checkin' as const,
    message: `Your sobriety streak reset on ${new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — worth a look at what led into it.`,
    target_screen: 'sobriety',
    source_key: `streak-broken-${s.id}`,
  }));
}

async function checkBudget(): Promise<Candidate[]> {
  const monthKey = new Date().toISOString().slice(0, 7);
  const [catRes, txRes] = await Promise.all([
    supabase.from('budget_categories').select('id, name, monthly_amount'),
    supabase.from('budget_transactions').select('category_id, amount, type, occurred_on').eq('type', 'expense').gte('occurred_on', `${monthKey}-01`),
  ]);
  const categories = catRes.data ?? [];
  const tx = txRes.data ?? [];
  const out: Candidate[] = [];
  for (const cat of categories) {
    const spent = tx.filter((t) => t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0);
    const allocated = Number(cat.monthly_amount);
    if (allocated > 0 && spent > allocated) {
      const overPct = Math.round(((spent - allocated) / allocated) * 100);
      out.push({
        category: 'budget',
        message: `${cat.name} is ${overPct}% over budget this month — $${spent.toFixed(0)} spent against a $${allocated.toFixed(0)} allocation.`,
        target_screen: 'budgeting',
        source_key: `budget-overrun-${cat.id}-${monthKey}`,
      });
    }
  }
  return out;
}

async function checkActivityDropoff(): Promise<Candidate[]> {
  const today = new Date();
  const sevenAgo = new Date(today); sevenAgo.setDate(today.getDate() - 7);
  const fourteenAgo = new Date(today); fourteenAgo.setDate(today.getDate() - 14);
  const out: Candidate[] = [];

  const { data: calls } = await supabase.from('call_outcomes').select('call_date').gte('call_date', dateStr(fourteenAgo));
  const recentCalls = (calls ?? []).filter((c) => c.call_date >= dateStr(sevenAgo)).length;
  const priorCalls = (calls ?? []).filter((c) => c.call_date < dateStr(sevenAgo)).length;
  if (priorCalls >= 5 && recentCalls <= priorCalls * 0.6) {
    out.push({
      category: 'activity_dropoff',
      message: `Call volume dropped from ${priorCalls} to ${recentCalls} over the last 7 days versus the week before — worth checking in on why.`,
      target_screen: 'dialing',
      source_key: `call-dropoff-${dateStr(today)}`,
    });
  }

  const { data: invoices } = await supabase.from('client_documents').select('created_at').eq('doc_type', 'invoice').gte('created_at', fourteenAgo.toISOString());
  const recentInvoices = (invoices ?? []).filter((i) => i.created_at >= sevenAgo.toISOString()).length;
  const priorInvoices = (invoices ?? []).filter((i) => i.created_at < sevenAgo.toISOString()).length;
  if (priorInvoices >= 2 && recentInvoices === 0) {
    out.push({
      category: 'activity_dropoff',
      message: `No new invoices in the last 7 days, after ${priorInvoices} the week before — check whether anything's stuck.`,
      target_screen: 'invoicing',
      source_key: `invoicing-dropoff-${dateStr(today)}`,
    });
  }
  return out;
}

async function checkGoalPace(): Promise<Candidate[]> {
  const today = new Date();
  const { data: goals } = await supabase.from('goals').select('id, title, deadline, progress_pct, created_at').not('deadline', 'is', null).lt('progress_pct', 100);
  const out: Candidate[] = [];
  for (const g of goals ?? []) {
    const deadline = new Date(`${g.deadline}T00:00:00`);
    const created = new Date(g.created_at);
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 || daysLeft > 14) continue;
    const totalDays = Math.max(1, (deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const expectedPct = Math.min(100, (elapsedDays / totalDays) * 100);
    const actualPct = Number(g.progress_pct);
    if (expectedPct - actualPct >= 20) {
      out.push({
        category: 'goal_pace',
        message: `You're ${daysLeft} day${daysLeft === 1 ? '' : 's'} out from "${g.title}" with ${Math.round(100 - actualPct)}% of the work left.`,
        target_screen: 'goals',
        source_key: `goal-pace-${g.id}-${dateStr(today)}`,
      });
    }
  }
  return out;
}

async function checkSubscriptions(): Promise<Candidate[]> {
  const today = new Date();
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const { data } = await supabase.from('tracked_subscriptions').select('id, name, renewal_date, last_marked_used_at').gte('renewal_date', dateStr(today)).lte('renewal_date', dateStr(in7));
  const out: Candidate[] = [];
  for (const s of data ?? []) {
    const staleDays = s.last_marked_used_at ? (today.getTime() - new Date(s.last_marked_used_at).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
    if (staleDays >= 45) {
      out.push({
        category: 'subscription',
        message: `${s.name} renews ${s.renewal_date === dateStr(today) ? 'today' : `on ${new Date(s.renewal_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} — you flagged it as one you're not sure you're still using.`,
        target_screen: 'budgeting',
        source_key: `sub-renewal-${s.id}-${s.renewal_date}`,
      });
    }
  }
  return out;
}

async function checkColdFollowups(): Promise<Candidate[]> {
  const today = dateStr(new Date());
  const { data } = await supabase
    .from('call_outcomes')
    .select('id, contact_id, outcome, callback_date, logged_at, contacts(name)')
    .eq('outcome', 'call_back_later')
    .not('callback_date', 'is', null)
    .lt('callback_date', today)
    .order('logged_at', { ascending: false });
  const out: Candidate[] = [];
  const seenContacts = new Set<string>();
  for (const row of (data ?? []) as unknown as { id: string; contact_id: string; callback_date: string; contacts: { name: string } | null }[]) {
    if (seenContacts.has(row.contact_id)) continue; // only the most recent overdue callback per contact
    seenContacts.add(row.contact_id);
    const name = row.contacts?.name ?? 'a contact';
    out.push({
      category: 'cold_followup',
      message: `${name} was due for a callback on ${new Date(row.callback_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — still hasn't gone out.`,
      target_screen: 'contacts',
      source_key: `cold-followup-${row.contact_id}-${row.callback_date}`,
    });
  }
  return out;
}

export function useNudges() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [settings, setSettings] = useState<NudgeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadActive = useCallback(async () => {
    const { data } = await supabase.from('nudges').select('id, category, message, target_screen, created_at').is('dismissed_at', null).order('created_at', { ascending: false });
    setNudges((data ?? []) as Nudge[]);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('nudge_settings').select('*').maybeSingle();
    if (data) {
      setSettings({
        missed_checkin_enabled: data.missed_checkin_enabled, budget_enabled: data.budget_enabled,
        activity_dropoff_enabled: data.activity_dropoff_enabled, goal_pace_enabled: data.goal_pace_enabled,
        subscription_enabled: data.subscription_enabled, cold_followup_enabled: data.cold_followup_enabled,
        daily_cap: data.daily_cap, quiet_hours_start: data.quiet_hours_start, quiet_hours_end: data.quiet_hours_end,
      });
      return data as NudgeSettings;
    }
    return DEFAULT_SETTINGS;
  }, []);

  const evaluate = useCallback(async (currentSettings: NudgeSettings) => {
    if (inQuietHours(currentSettings)) return;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase.from('nudges').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString());
    let remaining = currentSettings.daily_cap - (count ?? 0);
    if (remaining <= 0) return;

    const checks: [boolean, () => Promise<Candidate[]>][] = [
      [currentSettings.missed_checkin_enabled, checkMissedCheckin],
      [currentSettings.budget_enabled, checkBudget],
      [currentSettings.activity_dropoff_enabled, checkActivityDropoff],
      [currentSettings.goal_pace_enabled, checkGoalPace],
      [currentSettings.subscription_enabled, checkSubscriptions],
      [currentSettings.cold_followup_enabled, checkColdFollowups],
    ];

    const results = await Promise.all(checks.map(([enabled, fn]) => (enabled ? fn() : Promise.resolve([]))));
    const candidates = results.flat();

    for (const c of candidates) {
      if (remaining <= 0) break;
      const { error } = await supabase.from('nudges').insert({
        category: c.category, message: c.message, target_screen: c.target_screen, source_key: c.source_key,
      });
      // A unique-violation on (user_id, source_key) means this exact nudge
      // already exists (dismissed or not) — expected and silently skipped,
      // not an error; anything else surfaces via the console for visibility.
      if (error && error.code !== '23505') console.error('nudge insert failed', error);
      if (!error) remaining -= 1;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await loadSettings();
      await evaluate(s);
      await loadActive();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = async (id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    await supabase.from('nudges').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
  };

  const saveSettings = async (patch: Partial<NudgeSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from('nudge_settings').upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  return { nudges, settings, loading, dismiss, saveSettings };
}
