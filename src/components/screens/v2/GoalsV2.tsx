import { useMemo, useState } from 'react';
import { useGoals } from '../../../data/useGoals';
import { useCallsToday } from '../../../data/useCallsToday';
import type { Goal, GoalTargetUnit } from '../../../data/types';
import Card from '../../mm/Card';
import Pace from '../../mm/Pace';
import Stat from '../../mm/Stat';
import type { ChipKind } from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, area, useModule, useAi, AiOffCard, NovaMark } from '../../mm/Page';
import { GoalCard } from '../GoalsScreen';
import { parseYmd, shortDate, usd, num, WD3 } from './util';

export type GoalPace = {
  val: string; max: string; fill: number; mark?: number;
  chip: string; k: ChipKind; note?: string; onPace: boolean | null; done: boolean;
};

const DAY = 86400000;

/** Where a goal stands against where it should be today. Time pace runs
 *  from the day it was written to its deadline; without a deadline there's
 *  no pace to judge, only progress. Pure. */
export function goalPace(g: Goal, todayCalls: number, now = new Date()): GoalPace | null {
  const unit: GoalTargetUnit = g.target_unit ?? 'dollars';
  const doneSteps = g.steps.filter((s) => s.done).length;
  const auto = g.steps.some((s) => s.auto_tracked_source === 'dialing_calls');
  const target = g.target_cost;
  const cur = unit === 'total' ? doneSteps : unit === 'per_day' && auto ? todayCalls : g.current_saved;
  const fmt = (n: number) => (unit === 'dollars' ? usd(n) : num(n));
  if (target == null || target <= 0) {
    if (!g.steps.length) return null;
    const fill = (doneSteps / g.steps.length) * 100;
    return { val: `${doneSteps}`, max: `${g.steps.length} steps`, fill, chip: fill >= 100 ? 'Done' : `${g.steps.length - doneSteps} steps left`, k: fill >= 100 ? 'good' : 'neutral', onPace: null, done: fill >= 100 };
  }
  const fill = Math.min(100, (cur / target) * 100);
  const val = fmt(cur), max = unit === 'per_day' ? `${fmt(target)} today` : fmt(target);
  if (unit === 'per_day') {
    const left = Math.max(0, target - cur);
    return { val, max, fill, chip: left ? `${fmt(left)} to go today` : 'Done for today', k: left ? 'neutral' : 'good', note: auto ? 'Counted live from Dialing' : undefined, onPace: !left, done: false };
  }
  if (cur >= target) return { val, max, fill: 100, chip: 'Done', k: 'good', onPace: true, done: true };
  if (!g.deadline) return { val, max, fill, chip: `${fmt(target - cur)} to go`, k: 'neutral', note: 'No deadline set', onPace: null, done: false };
  const start = new Date(g.created_at).getTime(), end = parseYmd(g.deadline).getTime() + DAY - 1;
  const mark = Math.max(0, Math.min(100, ((now.getTime() - start) / Math.max(DAY, end - start)) * 100));
  const expected = (target * mark) / 100;
  const gap = expected - cur;
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / DAY));
  const note = daysLeft ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : 'Due today';
  // Within 2% of the target counts as on pace — a rounding hair isn't "behind".
  if (gap > target * 0.02) return { val, max, fill, mark, chip: `Behind pace by ${fmt(Math.ceil(gap))}`, k: now.getTime() > end ? 'bad' : 'warn', note, onPace: false, done: false };
  return { val, max, fill, mark, chip: 'On pace', k: 'good', note, onPace: true, done: false };
}

/** The next unfinished step a person can act on (auto-tracked ones count themselves). */
const nextStep = (g: Goal) => g.steps.find((s) => !s.done && !s.auto_tracked_source)?.description ?? null;
/** The contract's terms: the committed path, else why it matters. */
const terms = (g: Goal) => g.committed_path?.description || g.why || null;

const CADENCE_DAYS = { daily: 1, weekly: 7, monthly: 30 } as const;

export default function GoalsV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const G = useGoals();
  const { callsToday } = useCallsToday();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const now = new Date();

  const rows = useMemo(() => G.goals.map((g) => ({ g, p: goalPace(g, callsToday) })), [G.goals, callsToday]);
  const open = G.goals.find((g) => g.id === openId) ?? null;

  if (!G.loading && G.goals.length === 0) {
    return (
      <Page title="Goals" sub="Living contracts with paths and pace">
        <Empty text="No goals yet. Write one as a contract: what, by when, and what happens if you miss." cta="Write a goal" onCta={() => setAdding(true)} />
        {ai === false && <AiOffCard text="Without AI, goals still track pace. Nova's suggested paths and check-ins are off." />}
        {adding && <NewGoalSheet onClose={() => setAdding(false)} add={G.addGoal} onSaved={(id) => setOpenId(id)} />}
      </Page>
    );
  }

  const active = rows.filter((r) => !r.p?.done);
  const onPace = active.filter((r) => r.p?.onPace === true).length;
  const behind = active.filter((r) => r.p?.onPace === false);
  const year = String(now.getFullYear());
  const doneYear = rows.filter((r) => r.p?.done && r.g.created_at.startsWith(year)).length;
  // Next check-in: the soonest cadence due date among locked goals.
  const due = G.goals.filter((g) => g.check_in_cadence).map((g) => {
    const from = new Date(g.last_recalculated_at ?? g.created_at).getTime();
    return { g, at: from + CADENCE_DAYS[g.check_in_cadence!] * DAY };
  }).sort((a, b) => a.at - b.at)[0];
  const dueLabel = due ? (due.at <= now.getTime() ? 'Today' : due.at - now.getTime() < 6 * DAY ? WD3[new Date(due.at).getDay()] : shortDate(new Date(due.at).toISOString().slice(0, 10))) : '—';

  const card = ({ g, p }: { g: Goal; p: GoalPace | null }) => {
    const t = terms(g), step = nextStep(g);
    return (
      <section key={g.id} onClick={() => setOpenId(g.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(g.id); }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', minWidth: 0 }}>{g.title}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{g.deadline ? `By ${shortDate(g.deadline)}` : 'No deadline'}</span>
        </div>
        {t && <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-3)', color: 'var(--text)', fontSize: 14, lineHeight: 1.45 }}>{t}</div>}
        {p ? <Pace val={p.val} max={p.max} fill={p.fill} mark={p.mark} chip={p.chip} k={p.k} note={p.note} />
          : <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No target yet. Open it to set one or lock in a path.</span>}
        {step && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingTop: 10, borderTop: '1px solid var(--grid)' }}>
            <svg style={{ flex: 'none', marginTop: 3 }} width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" /></svg>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text)' }}>Next step:</span> {step}</span>
          </div>
        )}
      </section>
    );
  };

  const steps = rows.map(({ g }) => [g.title, nextStep(g)] as const).filter(([, s]) => s);
  const nextCard = steps.length > 0 && (
    <Card title="Next steps" meta={`${steps.length} ${steps.length === 1 ? 'goal' : 'goals'}`} wide={!phone}>
      <NovaMark title="From your committed paths" />
      {steps.map(([t, s]) => <p key={t} style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text)' }}>{t}:</span> {s}</p>)}
    </Card>
  );

  return (
    <Page title="Goals" sub={`${active.length} active ${active.length === 1 ? 'contract' : 'contracts'}`} fab={{ t: 'New goal', onClick: () => setAdding(true) }}>
      {!phone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Stat label="Active contracts" value={String(active.length)} pill={`${onPace} on pace`} k={onPace ? 'good' : 'neutral'} />
          <Stat label="Behind" value={String(behind.length)} pill={behind[0]?.g.title ?? 'None'} k={behind.length ? 'warn' : 'good'} />
          <Stat label="Done this year" value={String(doneYear)} pill={year} />
          <Stat label="Next check-in" value={dueLabel} pill={due ? due.g.title : 'Lock in a path first'} k={dueLabel === 'Today' ? 'warn' : 'neutral'} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: phone ? 20 : 16, alignItems: 'start' }}>
        {rows.map(card)}
        {!phone && nextCard}
      </div>
      {phone && nextCard}
      {ai === false && <AiOffCard text="Without AI, goals still track pace. Nova's suggested paths and check-ins are off." />}
      {adding && <NewGoalSheet onClose={() => setAdding(false)} add={G.addGoal} onSaved={(id) => setOpenId(id)} />}
      {open && (
        <Sheet title={open.title} onClose={() => setOpenId(null)} full>
          <GoalCard goal={open} otherGoals={G.goals} todayDialCount={callsToday}
            onAddStep={G.addStep} onToggleStep={G.toggleStep} onRemoveStep={G.removeStep}
            onSaveProgress={(id, v) => G.updateGoal(id, { current_saved: v })}
            onDelete={async (id) => { if (window.confirm('Delete this goal?')) { await G.deleteGoal(id); setOpenId(null); } }}
            onSaveCritique={G.saveCritique} onAddCheckin={G.addCheckin} onSaveGoalPlan={G.saveGoalPlan} onCommitPath={G.commitPath} />
        </Sheet>
      )}
    </Page>
  );
}

function NewGoalSheet({ onClose, add, onSaved }: { onClose: () => void; add: ReturnType<typeof useGoals>['addGoal']; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState<GoalTargetUnit>('dollars');
  const [deadline, setDeadline] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) { setErr('A goal needs a title.'); return; }
    const raw = target.replace(/[$,\s]/g, '');
    const cost = raw ? Number(raw) : null;
    if (cost !== null && !Number.isFinite(cost)) { setErr('Target has to be a single number, like 10000.'); return; }
    setBusy(true); setErr(null);
    try {
      const g = await add({ title: title.trim(), why: why.trim() || null, category: null, target_cost: cost, target_unit: unit, url: null, deadline: deadline || null });
      onClose();
      if (g) onSaved(g.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the goal.');
      setBusy(false);
    }
  };
  return (
    <Sheet title="New goal" onClose={onClose}>
      <Field l="What's the goal?"><input value={title} onChange={(e) => setTitle(e.target.value)} style={field} placeholder="Save $10,000 for taxes" /></Field>
      <Field l="The terms: what you'll do, and what happens if you miss"><textarea value={why} onChange={(e) => setWhy(e.target.value)} style={area} placeholder="I move $400 every Friday. If I miss one, I move $500 the next week." /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 8 }}>
        <Field l="Target"><input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} style={field} placeholder="Optional" /></Field>
        <Field l="Counts"><select value={unit} onChange={(e) => setUnit(e.target.value as GoalTargetUnit)} style={field}><option value="dollars">Dollars</option><option value="per_day">Per day</option><option value="total">Total</option></select></Field>
      </div>
      <Field l="By when"><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={field} /></Field>
      {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save goal'}</button>
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Next you can lock it into numbers and pick a path.</span>
    </Sheet>
  );
}
