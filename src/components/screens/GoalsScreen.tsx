import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useGoals } from '../../data/useGoals';
import { useContacts } from '../../data/useContacts';
import { useCallOutcomes } from '../../data/useCallOutcomes';
import type { Goal, GoalPath } from '../../data/types';
import { askClaude, AiError } from '../../lib/ai';
import { generateGoalPlan, recalculateGoalPace } from '../../lib/goalLockIn';
import type { GoalIntake } from '../../lib/goalLockIn';
import { useNovaPreferences } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};

function goalContext(goal: Goal): string {
  const stepsText = goal.steps.length
    ? goal.steps.map((s) => `- [${s.done ? 'x' : ' '}] ${s.description}`).join('\n')
    : '(no steps added yet)';
  return [
    `Title: ${goal.title}`,
    goal.why ? `Why it matters: ${goal.why}` : null,
    goal.category ? `Category: ${goal.category}` : null,
    goal.target_cost != null ? `Target: $${goal.target_cost.toLocaleString()} (saved so far: $${goal.current_saved.toLocaleString()})` : null,
    goal.deadline ? `Deadline: ${goal.deadline}` : null,
    `Steps:\n${stepsText}`,
  ].filter(Boolean).join('\n');
}

async function critiqueGoal(goal: Goal): Promise<string> {
  return askClaude({
    system:
      "You are Nova, Cristopher's direct, honest accountability coach inside his personal tracker. " +
      "Critique the goal below — call out anything vague, unrealistic, or missing a real plan. Then give " +
      'concrete, specific next steps that would actually move him toward it (not generic advice). Plain text, ' +
      'no markdown headers, a few short paragraphs, direct tone.',
    messages: [{ role: 'user', content: goalContext(goal) }],
    maxTokens: 700,
  });
}

// ── Lock-in intake (collects the numbers Nova needs to reverse-engineer) ──
function LockInIntake({ goal, otherGoals, onLocked }: { goal: Goal; otherGoals: Goal[]; onLocked: (plan: Awaited<ReturnType<typeof generateGoalPlan>>) => Promise<void> }) {
  const [targetDescription, setTargetDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [constraints, setConstraints] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setGenerating(true);
    setError('');
    try {
      const intake: GoalIntake = { title: goal.title, why: goal.why ?? '', category: goal.category ?? '', targetDescription, deadline, constraints };
      const plan = await generateGoalPlan(intake, otherGoals.filter((g) => g.id !== goal.id));
      await onLocked(plan);
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Could not generate a plan — try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ marginTop: 14, background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>Lock this in — turn it into hard numbers and real paths.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input style={inputStyle} placeholder="What's the target? (cost, count, weight, etc.)" value={targetDescription} onChange={(e) => setTargetDescription(e.target.value)} />
        <input style={inputStyle} placeholder="Deadline (e.g. 3 months, Dec 1)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <input style={inputStyle} placeholder="Any constraints? (optional)" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
      </div>
      {error && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginTop: 8 }}>{error}</div>}
      <div
        style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: generating ? 'var(--border)' : 'var(--text)', color: generating ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: generating ? 'default' : 'pointer' }}
        onClick={() => !generating && run()}
      >
        {generating ? 'Reverse-engineering…' : 'Lock it in'}
      </div>
    </div>
  );
}

// ── Path picker (shown once paths exist but nothing is committed yet) ────
function PathPicker({ goal, onChoose }: { goal: Goal; onChoose: (path: GoalPath) => Promise<void> }) {
  const [choosing, setChoosing] = useState<string | null>(null);

  return (
    <div style={{ marginTop: 14 }}>
      {goal.conflict_notes && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #B7690C', color: '#e0a35c', fontSize: 'var(--text-body-sm)', marginBottom: 12, lineHeight: 1.5 }}>
          ⚠ {goal.conflict_notes}
        </div>
      )}
      <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>
        Target: {goal.target_metric_value} {goal.target_metric} · check-in {goal.check_in_cadence}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {goal.paths.map((p) => (
          <div key={p.id} style={{ background: 'var(--surface-2)', border: `1px solid ${p.is_recommended ? 'var(--text)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{p.title}</span>
              {p.is_recommended && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bg)', background: 'var(--text)', borderRadius: 'var(--radius-pill)', padding: '2px 7px' }}>RECOMMENDED</span>}
            </div>
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{p.description}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {p.actions.map((a, i) => (
                <div key={i} style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>• {a.description} — {a.frequency}</div>
              ))}
            </div>
            <div
              style={{ marginTop: 10, display: 'inline-flex', padding: '7px 14px', borderRadius: 'var(--radius-pill)', background: choosing ? 'var(--border)' : 'var(--text)', color: choosing ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: choosing ? 'default' : 'pointer' }}
              onClick={async () => { if (choosing) return; setChoosing(p.id); await onChoose(p); setChoosing(null); }}
            >
              {choosing === p.id ? 'Committing…' : 'Choose this path'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalCard({
  goal, otherGoals, todayDialCount,
  onAddStep, onToggleStep, onRemoveStep, onSaveProgress, onDelete, onSaveCritique, onAddCheckin, onSaveGoalPlan, onCommitPath,
}: {
  goal: Goal;
  otherGoals: Goal[];
  todayDialCount: number;
  onAddStep: (goalId: string, description: string) => void;
  onToggleStep: (stepId: string, done: boolean) => void;
  onRemoveStep: (stepId: string) => void;
  onSaveProgress: (goalId: string, value: number) => void;
  onDelete: (goalId: string) => void;
  onSaveCritique: (goalId: string, critique: string) => Promise<void>;
  onAddCheckin: (goalId: string, text: string) => Promise<void>;
  onSaveGoalPlan: (goalId: string, plan: Awaited<ReturnType<typeof generateGoalPlan>>) => Promise<void>;
  onCommitPath: (goal: Goal, path: GoalPath) => Promise<void>;
}) {
  const { assistantName } = useNovaPreferences();
  const [stepText, setStepText] = useState('');
  const [savedInput, setSavedInput] = useState(String(goal.current_saved));
  const [busy, setBusy] = useState<'critique' | 'checkin' | 'revise' | null>(null);
  const [aiError, setAiError] = useState('');
  const [revising, setRevising] = useState(false);
  const pct = goal.target_cost ? Math.min(100, (goal.current_saved / goal.target_cost) * 100) : goal.progress_pct;

  const runCritique = async () => {
    setBusy('critique');
    setAiError('');
    try {
      const text = await critiqueGoal(goal);
      await onSaveCritique(goal.id, text);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not generate a critique — try again.');
    } finally {
      setBusy(null);
    }
  };

  const runCheckin = async () => {
    setBusy('checkin');
    setAiError('');
    try {
      const recent = goal.checkins.slice(0, 3).map((c) => `- ${c.checkin_text}`);
      const text = await recalculateGoalPace(goal, recent);
      await onAddCheckin(goal.id, text);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not run a check-in — try again.');
    } finally {
      setBusy(null);
    }
  };

  const runRevise = async () => {
    setBusy('revise');
    setAiError('');
    try {
      const intake: GoalIntake = {
        title: goal.title, why: goal.why ?? '', category: goal.category ?? '',
        targetDescription: `${goal.target_metric_value ?? ''} ${goal.target_metric ?? ''} (previous path: ${goal.committed_path?.title ?? 'none'} — this needs revising after a setback)`,
        deadline: goal.deadline ?? '', constraints: '',
      };
      const plan = await generateGoalPlan(intake, otherGoals.filter((g) => g.id !== goal.id));
      await onSaveGoalPlan(goal.id, plan);
      setRevising(false);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not revise the plan — try again.');
    } finally {
      setBusy(null);
    }
  };

  const locked = !!goal.committed_path;
  const hasPaths = goal.paths.length > 0;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>{goal.title}</div>
          {goal.why && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>{goal.why}</div>}
        </div>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onDelete(goal.id)}>Delete</span>
      </div>

      {(goal.target_cost != null || locked) && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-body)', color: 'var(--text)' }}>
            <span>{goal.target_cost != null ? `$${goal.current_saved.toLocaleString()}` : `${Math.round(pct)}%`}</span>
            {goal.target_cost != null && <span style={{ color: 'var(--text-tertiary)' }}>${goal.target_cost.toLocaleString()}</span>}
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 'var(--radius-pill)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--text)', borderRadius: 'var(--radius-pill)' }} />
          </div>
          {goal.target_cost != null && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input style={{ ...inputStyle, width: 120 }} value={savedInput} onChange={(e) => setSavedInput(e.target.value)} />
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }}
                onClick={() => onSaveProgress(goal.id, Number(savedInput) || 0)}
              >
                Update saved
              </div>
            </div>
          )}
        </>
      )}

      {goal.url && (
        <a href={goal.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
          {goal.url}
        </a>
      )}

      {!locked && !hasPaths && <LockInIntake goal={goal} otherGoals={otherGoals} onLocked={(plan) => onSaveGoalPlan(goal.id, plan)} />}
      {!locked && hasPaths && <PathPicker goal={goal} onChoose={(p) => onCommitPath(goal, p)} />}

      {locked && goal.conflict_notes && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #B7690C', color: '#e0a35c', fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
          ⚠ {goal.conflict_notes}
        </div>
      )}

      {locked && (
        <>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 16, marginBottom: 8 }}>
            Steps — {goal.committed_path!.title} · check-in {goal.check_in_cadence}
          </div>
          {goal.steps.map((s) =>
            s.auto_tracked_source === 'dialing_calls' ? (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary)', flex: 1 }}>{s.description}</span>
                <span style={{ fontSize: 'var(--text-caption)', color: '#4CAF7D', fontFamily: 'var(--font-mono)' }}>{todayDialCount} today (live)</span>
              </div>
            ) : (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <input type="checkbox" checked={s.done} onChange={(e) => onToggleStep(s.id, e.target.checked)} />
                <span style={{ fontSize: 'var(--text-body)', color: s.done ? 'var(--text-tertiary)' : 'var(--text-quaternary)', textDecoration: s.done ? 'line-through' : 'none', flex: 1 }}>{s.description}{s.frequency ? ` (${s.frequency})` : ''}</span>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => onRemoveStep(s.id)}>×</span>
              </div>
            )
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Add a step"
              value={stepText}
              onChange={(e) => setStepText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && stepText.trim()) {
                  onAddStep(goal.id, stepText.trim());
                  setStepText('');
                }
              }}
            />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: busy ? 'var(--border)' : 'var(--text)', color: busy ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
          onClick={() => !busy && runCritique()}
        >
          {busy === 'critique' ? 'Thinking…' : '✨ AI critique'}
        </div>
        {locked && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: busy ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: busy ? 'default' : 'pointer' }}
            onClick={() => !busy && runCheckin()}
          >
            {busy === 'checkin' ? 'Checking in…' : '✨ Check in now'}
          </div>
        )}
        {locked && !revising && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-pill)', color: 'var(--text-tertiary)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }}
            onClick={() => setRevising(true)}
          >
            Revise path
          </div>
        )}
        {locked && revising && (
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: busy ? 'var(--border)' : 'var(--text)', color: busy ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
            onClick={() => !busy && runRevise()}
          >
            {busy === 'revise' ? 'Revising…' : 'Confirm revise (generates new paths)'}
          </div>
        )}
      </div>
      {aiError && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}

      {goal.ai_critique && (
        <div style={{ marginTop: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-secondary)', marginBottom: 6 }}>{assistantName}'s critique</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{goal.ai_critique}</div>
        </div>
      )}

      {goal.checkins.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goal.checkins.slice(0, 3).map((c) => (
            <div key={c.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginBottom: 4 }}>{new Date(c.created_at).toLocaleDateString()} check-in</div>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{c.checkin_text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GoalsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { goals, loading, addGoal, updateGoal, deleteGoal, addStep, toggleStep, removeStep, saveCritique, addCheckin, saveGoalPlan, commitPath } = useGoals();
  const { contacts } = useContacts();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const { todayCount } = useCallOutcomes(dialingContacts);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [category, setCategory] = useState('');
  const [targetCost, setTargetCost] = useState('');
  const [url, setUrl] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    await addGoal({
      title: title.trim(),
      why: why.trim() || null,
      category: category.trim() || null,
      target_cost: targetCost ? Number(targetCost) : null,
      url: url.trim() || null,
      deadline: null,
    });
    setTitle(''); setWhy(''); setCategory(''); setTargetCost(''); setUrl('');
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Goals</div>
          <div style={homeSubStyle}>Living contracts — reverse-engineered into numbers and real paths.</div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginTop: 20, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="What's the goal?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input style={inputStyle} placeholder="Why does it matter?" value={why} onChange={(e) => setWhy(e.target.value)} />
          <input style={inputStyle} placeholder="Category (e.g. savings, business)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input style={inputStyle} placeholder="Target cost ($, optional — for savings-style goals)" value={targetCost} onChange={(e) => setTargetCost(e.target.value)} />
          <input style={inputStyle} placeholder="Reference URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div
            style={{ alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer' }}
            onClick={submit}
          >
            Save goal
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>You'll lock it into hard numbers and pick a path right after saving.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            otherGoals={goals}
            todayDialCount={todayCount}
            onAddStep={addStep}
            onToggleStep={toggleStep}
            onRemoveStep={removeStep}
            onSaveProgress={(id, v) => updateGoal(id, { current_saved: v })}
            onDelete={deleteGoal}
            onSaveCritique={saveCritique}
            onAddCheckin={addCheckin}
            onSaveGoalPlan={saveGoalPlan}
            onCommitPath={commitPath}
          />
        ))}
      </div>
      {!loading && goals.length === 0 && (
        <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', marginTop: 24 }}>No goals yet — add one to get started.</div>
      )}
    </div>
  );
}
