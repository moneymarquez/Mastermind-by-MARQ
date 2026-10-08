// Masterminds Import format v1 (brief §4.4). A person talks to any AI, gets
// this block at the end, drops it into Brain → Brain Dump, and Masterminds
// builds itself out from it. Every key is optional; unknown keys become
// notes instead of failing. Pure — tests/solo-october.test.ts.

export const IMPORT_START = '===MASTERMINDS IMPORT v1===';
export const IMPORT_END = '===END MASTERMINDS IMPORT===';

export const IMPORT_TEMPLATE = `${IMPORT_START}
{
  "version": 1,
  "source": "claude | chatgpt | gemini | other",
  "profile":   { "name": "", "timezone": "", "wake": "06:30", "sleep": "23:00", "work": [{ "days": ["mon"], "start": "08:00", "end": "16:00", "label": "" }] },
  "goals":     [{ "title": "", "target": 0, "unit": "dollars | clients | count | lbs | custom", "deadline": "YYYY-MM-DD", "why": "" }],
  "tasks":     [{ "title": "", "project": "", "due": "YYYY-MM-DD", "priority": "high | med | low", "goal": "", "notes": "" }],
  "habits":    [{ "title": "", "days": ["mon"], "time": "" }],
  "macros":    { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "diet_notes": "" },
  "fitness":   { "days_per_week": 0, "focus": "", "equipment": "", "runs": "" },
  "schedule":  [{ "title": "", "days": ["mon"], "start": "", "end": "", "type": "work | gym | run | study | other" }],
  "contacts":  [{ "name": "", "phone": "", "email": "", "lists": [""], "notes": "" }],
  "peptides":  [{ "name": "", "amount": "", "unit": "", "schedule": "", "notes": "" }],
  "money":     { "skills": [""], "hours_per_week": 0, "starting_budget_usd": 0, "city": "", "interests": [""] },
  "reminders": [{ "title": "", "time": "", "days": ["mon"] }],
  "documents": [{ "title": "", "category": "", "body_markdown": "" }],
  "notes":     [{ "category": "", "text": "" }]
}
${IMPORT_END}`;

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export interface ImportData {
  version: 1;
  source: 'claude' | 'chatgpt' | 'gemini' | 'other';
  profile?: { name?: string; timezone?: string; wake?: string; sleep?: string; work?: { days: Day[]; start: string; end: string; label: string }[] };
  goals: { title: string; target: number | null; unit: string; deadline: string | null; why: string }[];
  tasks: { title: string; project: string; due: string | null; priority: 'high' | 'med' | 'low'; goal: string; notes: string }[];
  habits: { title: string; days: Day[]; time: string }[];
  macros?: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; diet_notes: string };
  fitness?: { days_per_week: number | null; focus: string; equipment: string; runs: string };
  schedule: { title: string; days: Day[]; start: string; end: string; type: 'work' | 'gym' | 'run' | 'study' | 'other' }[];
  contacts: { name: string; phone: string; email: string; lists: string[]; notes: string }[];
  peptides: { name: string; amount: string; unit: string; schedule: string; notes: string }[];
  money?: { skills: string[]; hours_per_week: number | null; starting_budget_usd: number | null; city: string; interests: string[] };
  reminders: { title: string; time: string; days: Day[] }[];
  documents: { title: string; category: string; body_markdown: string }[];
  notes: { category: string; text: string }[];
}

const KNOWN = new Set(['version', 'source', 'profile', 'goals', 'tasks', 'habits', 'macros', 'fitness', 'schedule', 'contacts', 'peptides', 'money', 'reminders', 'documents', 'notes']);
const s = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const n = (v: unknown): number | null => { const x = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : typeof v === 'number' ? v : NaN; return Number.isFinite(x) && x !== 0 ? x : null; };
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const date = (v: unknown): string | null => { const x = s(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) ? x : null; };
const time = (v: unknown): string => { const x = s(v, 8); const m = x.match(/^(\d{1,2}):(\d{2})/); return m && Number(m[1]) < 24 ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const days = (v: unknown): Day[] => [...new Set(arr(v).map((d) => s(d, 9).toLowerCase().slice(0, 3)).filter((d): d is Day => (DAYS as string[]).includes(d)))];
const strs = (v: unknown, max = 200): string[] => arr(v).map((x) => s(x, max)).filter(Boolean);
const one = <T extends string>(v: unknown, opts: readonly T[], dflt: T): T => { const x = s(v, 20).toLowerCase() as T; return opts.includes(x) ? x : dflt; };

/** The JSON inside the markers, or a bare JSON object with "version": 1. */
export function extractImportBlock(text: string): string | null {
  const a = text.indexOf(IMPORT_START);
  if (a >= 0) {
    const b = text.indexOf(IMPORT_END, a + IMPORT_START.length);
    const inner = text.slice(a + IMPORT_START.length, b >= 0 ? b : undefined);
    const i = inner.indexOf('{'), j = inner.lastIndexOf('}');
    // Markers but broken JSON: hand it on so the parse error is reported,
    // rather than quietly sending it to the AI path.
    return i >= 0 && j > i ? inner.slice(i, j + 1) : inner.trim() || null;
  }
  const t = text.trim();
  if (t.startsWith('{') && /"version"\s*:\s*1/.test(t)) return t;
  return null;
}

export interface ValidateResult { ok: boolean; data: ImportData | null; errors: string[]; unknownKeys: string[] }
/** Normalise whatever an AI produced into ImportData. Never throws. */
export function validateImport(raw: unknown): ValidateResult {
  const o = obj(raw);
  if (!Object.keys(o).length) return { ok: false, data: null, errors: ['Not a JSON object.'], unknownKeys: [] };
  const errors: string[] = [];
  if (o.version != null && Number(o.version) !== 1) errors.push(`Version ${String(o.version)} isn't supported; read as v1.`);
  const unknownKeys = Object.keys(o).filter((k) => !KNOWN.has(k));
  const p = obj(o.profile), m = obj(o.macros), f = obj(o.fitness), mo = obj(o.money);
  const notes = arr(o.notes).map((x) => ({ category: s(obj(x).category, 60) || 'General', text: s(obj(x).text, 4000) })).filter((x) => x.text);
  for (const k of unknownKeys) notes.push({ category: 'Imported', text: `${k}: ${JSON.stringify(o[k]).slice(0, 3000)}` });
  const data: ImportData = {
    version: 1,
    source: one(o.source, ['claude', 'chatgpt', 'gemini', 'other'] as const, 'other'),
    profile: Object.keys(p).length ? { name: s(p.name, 120) || undefined, timezone: s(p.timezone, 60) || undefined, wake: time(p.wake) || undefined, sleep: time(p.sleep) || undefined, work: arr(p.work).map((w) => ({ days: days(obj(w).days), start: time(obj(w).start), end: time(obj(w).end), label: s(obj(w).label, 80) })).filter((w) => w.days.length && w.start && w.end) } : undefined,
    goals: arr(o.goals).map((g) => ({ title: s(obj(g).title, 200), target: n(obj(g).target), unit: s(obj(g).unit, 30) || 'custom', deadline: date(obj(g).deadline), why: s(obj(g).why, 1000) })).filter((g) => g.title),
    tasks: arr(o.tasks).map((t) => ({ title: s(obj(t).title, 300), project: s(obj(t).project, 60), due: date(obj(t).due), priority: one(obj(t).priority, ['high', 'med', 'low'] as const, 'med'), goal: s(obj(t).goal, 200), notes: s(obj(t).notes, 2000) })).filter((t) => t.title),
    habits: arr(o.habits).map((h) => ({ title: s(obj(h).title, 200), days: days(obj(h).days), time: time(obj(h).time) })).filter((h) => h.title),
    macros: Object.keys(m).length ? { calories: n(m.calories), protein_g: n(m.protein_g), carbs_g: n(m.carbs_g), fat_g: n(m.fat_g), diet_notes: s(m.diet_notes, 1000) } : undefined,
    fitness: Object.keys(f).length ? { days_per_week: n(f.days_per_week), focus: s(f.focus, 300), equipment: s(f.equipment, 300), runs: s(f.runs, 300) } : undefined,
    schedule: arr(o.schedule).map((x) => ({ title: s(obj(x).title, 120), days: days(obj(x).days), start: time(obj(x).start), end: time(obj(x).end), type: one(obj(x).type, ['work', 'gym', 'run', 'study', 'other'] as const, 'other') })).filter((x) => x.title && x.days.length && x.start),
    contacts: arr(o.contacts).map((c) => ({ name: s(obj(c).name, 120), phone: s(obj(c).phone, 40), email: s(obj(c).email, 160), lists: strs(obj(c).lists, 60), notes: s(obj(c).notes, 2000) })).filter((c) => c.name),
    peptides: arr(o.peptides).map((x) => ({ name: s(obj(x).name, 120), amount: s(obj(x).amount, 40), unit: s(obj(x).unit, 20), schedule: s(obj(x).schedule, 200), notes: s(obj(x).notes, 1000) })).filter((x) => x.name),
    money: Object.keys(mo).length ? { skills: strs(mo.skills), hours_per_week: n(mo.hours_per_week), starting_budget_usd: n(mo.starting_budget_usd), city: s(mo.city, 120), interests: strs(mo.interests) } : undefined,
    reminders: arr(o.reminders).map((r) => ({ title: s(obj(r).title, 200), time: time(obj(r).time), days: days(obj(r).days) })).filter((r) => r.title),
    documents: arr(o.documents).map((d) => ({ title: s(obj(d).title, 200) || 'Untitled', category: s(obj(d).category, 60) || 'Personal', body_markdown: s(obj(d).body_markdown, 200000) })).filter((d) => d.body_markdown),
    notes,
  };
  return { ok: true, data, errors, unknownKeys };
}

/** Parse pasted text that contains a block. null = no block (use the AI path). */
export function parseImportText(text: string): ValidateResult | null {
  const block = extractImportBlock(text);
  if (!block) return null;
  try { return validateImport(JSON.parse(block)); }
  catch (e) { return { ok: false, data: null, errors: [`The block isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`], unknownKeys: [] }; }
}

export type PreviewKind = 'profile' | 'goal' | 'task' | 'habit' | 'macros' | 'fitness' | 'schedule' | 'contact' | 'peptide' | 'money' | 'reminder' | 'document' | 'note';
export interface PreviewItem { id: string; kind: PreviewKind; label: string; detail: string }
/** One checkbox per thing the import would change. Pure. */
export function previewImport(d: ImportData): PreviewItem[] {
  const out: PreviewItem[] = [];
  const add = (kind: PreviewKind, i: number, label: string, detail = '') => out.push({ id: `${kind}:${i}`, kind, label, detail });
  if (d.profile && (d.profile.name || d.profile.timezone || d.profile.wake || d.profile.work?.length)) add('profile', 0, 'Update your profile', [d.profile.name, d.profile.timezone, d.profile.wake && `wake ${d.profile.wake}`, d.profile.sleep && `sleep ${d.profile.sleep}`, d.profile.work?.length ? `${d.profile.work.length} work block${d.profile.work.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '));
  d.goals.forEach((g, i) => add('goal', i, `Add goal: ${g.title}`, [g.target != null ? `${g.target} ${g.unit}` : '', g.deadline ? `by ${g.deadline}` : ''].filter(Boolean).join(' ')));
  d.tasks.forEach((t, i) => add('task', i, `Add task: ${t.title}`, [t.project, t.due && `due ${t.due}`, t.priority !== 'med' ? t.priority : ''].filter(Boolean).join(' · ')));
  d.habits.forEach((h, i) => add('habit', i, `Add habit: ${h.title}`, [h.days.join(' '), h.time].filter(Boolean).join(' · ')));
  if (d.macros && (d.macros.calories || d.macros.protein_g)) add('macros', 0, `Update macros to ${[d.macros.calories && `${d.macros.calories.toLocaleString('en-US')} kcal`, d.macros.protein_g && `${d.macros.protein_g}g protein`].filter(Boolean).join(' / ')}`, [d.macros.carbs_g && `${d.macros.carbs_g}g carbs`, d.macros.fat_g && `${d.macros.fat_g}g fat`].filter(Boolean).join(' · '));
  if (d.fitness && (d.fitness.days_per_week || d.fitness.focus)) add('fitness', 0, 'Update fitness', [d.fitness.days_per_week && `${d.fitness.days_per_week} days/week`, d.fitness.focus, d.fitness.runs].filter(Boolean).join(' · '));
  d.schedule.forEach((x, i) => add('schedule', i, `Add to schedule: ${x.title}`, `${x.days.join(' ')} ${x.start}${x.end ? `–${x.end}` : ''}`));
  const byList = new Map<string, number>();
  d.contacts.forEach((c, i) => { add('contact', i, `Add contact: ${c.name}`, c.lists.join(', ')); for (const l of c.lists) byList.set(l, (byList.get(l) ?? 0) + 1); });
  d.peptides.forEach((p, i) => add('peptide', i, `Track: ${p.name}`, [p.amount && `${p.amount}${p.unit ? ` ${p.unit}` : ''}`, p.schedule].filter(Boolean).join(' · ')));
  if (d.money && (d.money.skills.length || d.money.city || d.money.hours_per_week)) add('money', 0, 'Save your Money Move inputs', [d.money.skills.slice(0, 3).join(', '), d.money.hours_per_week && `${d.money.hours_per_week} h/week`, d.money.city].filter(Boolean).join(' · '));
  d.reminders.forEach((r, i) => add('reminder', i, `Create reminder: ${r.title}`, [r.days.join(' '), r.time].filter(Boolean).join(' · ')));
  d.documents.forEach((x, i) => add('document', i, `Save document: ${x.title}`, x.category));
  d.notes.forEach((x, i) => add('note', i, `Save note (${x.category})`, x.text.slice(0, 80)));
  return out;
}

const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
/** "This will add 4 tasks, update macros to 2,400 kcal / 180g protein, …" */
export function previewSentence(items: PreviewItem[]): string {
  const c = (k: PreviewKind) => items.filter((i) => i.kind === k).length;
  const parts: string[] = [];
  if (c('goal')) parts.push(`add ${plural(c('goal'), 'goal')}`);
  if (c('task')) parts.push(`add ${plural(c('task'), 'task')}`);
  if (c('habit')) parts.push(`add ${plural(c('habit'), 'habit')}`);
  const mac = items.find((i) => i.kind === 'macros'); if (mac) parts.push(mac.label.replace(/^Update/, 'update'));
  if (c('fitness')) parts.push('update fitness');
  if (c('schedule')) parts.push(`add ${plural(c('schedule'), 'schedule block')}`);
  if (c('contact')) parts.push(`add ${plural(c('contact'), 'contact')}`);
  if (c('peptide')) parts.push(`track ${plural(c('peptide'), 'peptide')}`);
  if (c('reminder')) parts.push(`create ${plural(c('reminder'), 'reminder')}`);
  if (c('document')) parts.push(`save ${plural(c('document'), 'document')}`);
  if (c('note')) parts.push(`save ${plural(c('note'), 'note')}`);
  if (c('profile')) parts.push('update your profile');
  if (c('money')) parts.push('save your Money Move inputs');
  return parts.length ? `This will ${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' and ' : ''}${parts.at(-1)}.` : 'Nothing to import.';
}

/** The next date (YYYY-MM-DD) on or after `from` that falls on one of `ds`. */
export function nextOn(ds: Day[], from: string): string {
  const base = new Date(`${from}T12:00:00Z`);
  for (let k = 0; k < 7; k++) {
    const d = new Date(base.getTime() + k * 86400000);
    if (!ds.length || ds.includes(DAYS[(d.getUTCDay() + 6) % 7])) return d.toISOString().slice(0, 10);
  }
  return from;
}
