import { supabase } from '../lib/supabase';
import type { ImportData, PreviewItem } from './importFormat';
import { nextOn } from './importFormat';
import { dateStr } from './time';

// Applies the checked items of an import as the signed-in user (RLS does
// the scoping) and keeps an undo log on the brain_imports row: every row
// created, plus anything switched off (the old macro target) so Undo can
// put it back. Undo only removes what this import created.

export interface UndoEntry { table: string; id: string; restore?: Record<string, unknown> }
export interface ApplyResult { applied: number; failed: { label: string; error: string }[]; undo: UndoEntry[] }

const idx = (id: string) => Number(id.split(':')[1]);

export async function applyImport(d: ImportData, items: PreviewItem[], opts: { importId: string | null; source: 'brain_dump' | 'onboarding' }): Promise<ApplyResult> {
  const undo: UndoEntry[] = [];
  const failed: ApplyResult['failed'] = [];
  const today = dateStr(new Date());
  const goalIds = new Map<string, string>();
  const ins = async (table: string, row: Record<string, unknown>): Promise<string | null> => {
    const { data, error } = await supabase.from(table).insert(row).select('id').single();
    if (error) throw new Error(error.message);
    const id = (data as { id: string }).id;
    undo.push({ table, id });
    return id;
  };
  const memory = async (fact: string) => { await ins('nova_memory', { fact: fact.slice(0, 2000) }); };
  // Goals first so tasks can link to them by title.
  const order: PreviewItem['kind'][] = ['profile', 'goal', 'task', 'habit', 'macros', 'fitness', 'schedule', 'contact', 'peptide', 'money', 'reminder', 'document', 'note'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const it of sorted) {
    try {
      const i = idx(it.id);
      if (it.kind === 'profile' && d.profile) {
        const p = d.profile;
        const work = p.work ?? [];
        const { error } = await supabase.from('user_setup').upsert({ display_name: p.name ?? null, timezone: p.timezone ?? null, wake: p.wake ?? null, sleep: p.sleep ?? null, work, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      } else if (it.kind === 'goal') {
        const g = d.goals[i];
        const id = await ins('goals', { title: g.title, why: g.why || null, deadline: g.deadline, target_cost: g.target, target_metric: g.unit });
        if (id) goalIds.set(g.title.toLowerCase(), id);
      } else if (it.kind === 'task') {
        const t = d.tasks[i];
        let goalId = t.goal ? goalIds.get(t.goal.toLowerCase()) ?? null : null;
        if (t.goal && !goalId) { const { data } = await supabase.from('goals').select('id').ilike('title', t.goal).limit(1); goalId = (data?.[0] as { id: string } | undefined)?.id ?? null; }
        await ins('tasks', { title: t.title, project: t.project || null, due: t.due, priority: t.priority, goal_id: goalId, source: opts.source, source_ref: opts.importId, notes: t.notes || null });
      } else if (it.kind === 'habit') {
        const h = d.habits[i];
        await memory(`Habit: ${h.title}${h.days.length ? ` on ${h.days.join(', ')}` : ''}${h.time ? ` at ${h.time}` : ''}.`);
        if (h.time) await ins('reminders', { title: h.title, due_date: nextOn(h.days, today), due_time: h.time });
      } else if (it.kind === 'macros' && d.macros) {
        const m = d.macros;
        const { data: prev } = await supabase.from('nutrition_targets').select('id').eq('active', true);
        for (const r of (prev ?? []) as { id: string }[]) { await supabase.from('nutrition_targets').update({ active: false }).eq('id', r.id); undo.push({ table: 'nutrition_targets', id: r.id, restore: { active: true } }); }
        const cal = m.calories ?? 0, pro = m.protein_g ?? 0;
        await ins('nutrition_targets', { daily_calories: Math.round(cal), daily_protein_g: Math.round(pro), daily_carbs_g: Math.round(m.carbs_g ?? Math.max(0, (cal - pro * 4 - (m.fat_g ?? cal * 0.25 / 9) * 9) / 4)), daily_fat_g: Math.round(m.fat_g ?? (cal * 0.25) / 9), rationale: m.diet_notes || 'From your Masterminds import.' });
      } else if (it.kind === 'fitness' && d.fitness) {
        const f = d.fitness;
        await memory(`Fitness: ${[f.days_per_week && `${f.days_per_week} days/week`, f.focus && `focus ${f.focus}`, f.equipment && `equipment ${f.equipment}`, f.runs && `runs ${f.runs}`].filter(Boolean).join('; ')}.`);
      } else if (it.kind === 'schedule') {
        const x = d.schedule[i];
        if (x.type === 'work') {
          const { data } = await supabase.from('user_setup').select('work').maybeSingle();
          const work = [...(((data as { work?: unknown[] } | null)?.work ?? []) as unknown[]), { days: x.days, start: x.start, end: x.end, label: x.title }];
          const { error } = await supabase.from('user_setup').upsert({ work, updated_at: new Date().toISOString() });
          if (error) throw new Error(error.message);
        }
        await memory(`Weekly schedule: ${x.title} (${x.type}) on ${x.days.join(', ')} ${x.start}${x.end ? `–${x.end}` : ''}.`);
      } else if (it.kind === 'contact') {
        const c = d.contacts[i];
        const cid = await ins('contacts', { name: c.name, phone: c.phone || null, email: c.email || null, notes: c.notes || null, source: 'manual' });
        for (const l of c.lists) {
          let { data: list } = await supabase.from('contact_lists').select('id').eq('name', l).maybeSingle();
          if (!list) { const r = await supabase.from('contact_lists').insert({ name: l }).select('id').single(); list = r.data; if (r.data) undo.push({ table: 'contact_lists', id: (r.data as { id: string }).id }); }
          if (list && cid) await supabase.from('contact_list_members').insert({ list_id: (list as { id: string }).id, contact_id: cid });
        }
      } else if (it.kind === 'peptide') {
        const p = d.peptides[i];
        await ins('peptides', { name: p.name, amount: p.amount || null, unit: p.unit || null, schedule_note: p.schedule || null, notes: p.notes || null });
      } else if (it.kind === 'money' && d.money) {
        const m = d.money;
        const { error } = await supabase.from('user_setup').upsert({ money_skills: m.skills, money_hours_per_week: m.hours_per_week, money_budget_usd: m.starting_budget_usd, money_city: m.city || null, money_interests: m.interests, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
      } else if (it.kind === 'reminder') {
        const r = d.reminders[i];
        await ins('reminders', { title: r.title, due_date: nextOn(r.days, today), due_time: r.time || null });
      } else if (it.kind === 'document') {
        const x = d.documents[i];
        await ins('brain_documents', { title: x.title, category: x.category, body_text: x.body_markdown, mime: 'text/markdown', import_id: opts.importId });
      } else if (it.kind === 'note') {
        const x = d.notes[i];
        await memory(`${x.category}: ${x.text}`);
      }
    } catch (e) {
      failed.push({ label: it.label, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (opts.importId) await supabase.from('brain_imports').update({ applied: undo, status: 'applied', applied_at: new Date().toISOString() }).eq('id', opts.importId);
  return { applied: sorted.length - failed.length, failed, undo };
}

/** Undo: delete what the import created (newest first) and restore what it switched off. */
export async function undoImport(importId: string): Promise<number> {
  const { data } = await supabase.from('brain_imports').select('applied,status').eq('id', importId).single();
  const log = ((data as { applied?: UndoEntry[] } | null)?.applied ?? []) as UndoEntry[];
  let n = 0;
  for (const e of [...log].reverse()) {
    const q = e.restore ? supabase.from(e.table).update(e.restore).eq('id', e.id) : supabase.from(e.table).delete().eq('id', e.id);
    const { error } = await q;
    if (!error) n++;
  }
  await supabase.from('brain_imports').update({ status: 'undone', undone_at: new Date().toISOString() }).eq('id', importId);
  return n;
}
