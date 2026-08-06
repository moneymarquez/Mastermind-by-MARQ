import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useGoals } from '../../data/useGoals';
import type { Goal } from '../../data/types';
import { askClaude, AiError } from '../../lib/ai';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
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

async function checkinOnGoal(goal: Goal): Promise<string> {
  const recentCheckins = goal.checkins.slice(0, 3).map((c) => `- ${c.checkin_text}`).join('\n') || '(no prior check-ins)';
  return askClaude({
    system:
      "You are Nova, checking in on Cristopher's progress toward this goal. Look at where things stand and the " +
      'recent check-in history, then give a short, honest read on his progress and ONE specific thing to do next. ' +
      'Plain text, 2-4 sentences, direct — not generic cheerleading.',
    messages: [{ role: 'user', content: `${goalContext(goal)}\n\nRecent check-ins:\n${recentCheckins}` }],
    maxTokens: 300,
  });
}

function GoalCard({ goal, onAddStep, onToggleStep, onRemoveStep, onSaveProgress, onDelete, onSaveCritique, onAddCheckin }: {
  goal: Goal;
  onAddStep: (goalId: string, description: string) => void;
  onToggleStep: (stepId: string, done: boolean) => void;
  onRemoveStep: (stepId: string) => void;
  onSaveProgress: (goalId: string, value: number) => void;
  onDelete: (goalId: string) => void;
  onSaveCritique: (goalId: string, critique: string) => Promise<void>;
  onAddCheckin: (goalId: string, text: string) => Promise<void>;
}) {
  const [stepText, setStepText] = useState('');
  const [savedInput, setSavedInput] = useState(String(goal.current_saved));
  const [busy, setBusy] = useState<'critique' | 'checkin' | null>(null);
  const [aiError, setAiError] = useState('');
  const pct = goal.target_cost ? Math.min(100, (goal.current_saved / goal.target_cost) * 100) : 0;

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
      const text = await checkinOnGoal(goal);
      await onAddCheckin(goal.id, text);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not run a check-in — try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#F5F6F7' }}>{goal.title}</div>
          {goal.why && <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 4 }}>{goal.why}</div>}
        </div>
        <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onDelete(goal.id)}>Delete</span>
      </div>

      {goal.target_cost != null && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F5F6F7' }}>
            <span>${goal.current_saved.toLocaleString()}</span>
            <span style={{ color: '#565b64' }}>${goal.target_cost.toLocaleString()}</span>
          </div>
          <div style={{ height: 8, background: '#22262B', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#F5F6F7', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input style={{ ...inputStyle, width: 120 }} value={savedInput} onChange={(e) => setSavedInput(e.target.value)} />
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, border: '1px solid #22262B', color: '#8A8F98', fontSize: 12.5, cursor: 'pointer' }}
              onClick={() => onSaveProgress(goal.id, Number(savedInput) || 0)}
            >
              Update saved
            </div>
          </div>
        </>
      )}

      {goal.url && (
        <a href={goal.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, color: '#8A8F98' }}>
          {goal.url}
        </a>
      )}

      <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 16, marginBottom: 8 }}>Steps</div>
      {goal.steps.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <input type="checkbox" checked={s.done} onChange={(e) => onToggleStep(s.id, e.target.checked)} />
          <span style={{ fontSize: 13, color: s.done ? '#565b64' : '#C7CAD1', textDecoration: s.done ? 'line-through' : 'none', flex: 1 }}>{s.description}</span>
          <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => onRemoveStep(s.id)}>×</span>
        </div>
      ))}
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

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, background: busy ? '#22262B' : '#F5F6F7', color: busy ? '#8A8F98' : '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
          onClick={() => !busy && runCritique()}
        >
          {busy === 'critique' ? 'Thinking…' : '✨ AI critique'}
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderRadius: 999, border: '1px solid #22262B', color: busy ? '#565b64' : '#8A8F98', fontSize: 12.5, cursor: busy ? 'default' : 'pointer' }}
          onClick={() => !busy && runCheckin()}
        >
          {busy === 'checkin' ? 'Checking in…' : '✨ AI check-in'}
        </div>
      </div>
      {aiError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}

      {goal.ai_critique && (
        <div style={{ marginTop: 14, background: '#101114', border: '1px solid #22262B', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#8A8F98', marginBottom: 6 }}>Nova's critique</div>
          <div style={{ fontSize: 12.5, color: '#C7CAD1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{goal.ai_critique}</div>
        </div>
      )}

      {goal.checkins.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goal.checkins.slice(0, 3).map((c) => (
            <div key={c.id} style={{ background: '#101114', border: '1px solid #1c1e23', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, color: '#565b64', marginBottom: 4 }}>{new Date(c.created_at).toLocaleDateString()} check-in</div>
              <div style={{ fontSize: 12.5, color: '#C7CAD1', lineHeight: 1.6 }}>{c.checkin_text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GoalsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { goals, loading, addGoal, updateGoal, deleteGoal, addStep, toggleStep, removeStep, saveCritique, addCheckin } = useGoals();
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
          <div style={homeSubStyle}>What you're working toward, and the steps to get there.</div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, marginTop: 20, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="What's the goal?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input style={inputStyle} placeholder="Why does it matter?" value={why} onChange={(e) => setWhy(e.target.value)} />
          <input style={inputStyle} placeholder="Category (e.g. savings, business)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input style={inputStyle} placeholder="Target cost ($, optional)" value={targetCost} onChange={(e) => setTargetCost(e.target.value)} />
          <input style={inputStyle} placeholder="Reference URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div
            style={{ alignSelf: 'flex-start', padding: '9px 16px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onClick={submit}
          >
            Save goal
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onAddStep={addStep}
            onToggleStep={toggleStep}
            onRemoveStep={removeStep}
            onSaveProgress={(id, v) => updateGoal(id, { current_saved: v })}
            onDelete={deleteGoal}
            onSaveCritique={saveCritique}
            onAddCheckin={addCheckin}
          />
        ))}
      </div>
      {!loading && goals.length === 0 && (
        <div style={{ fontSize: 13, color: '#565b64', marginTop: 24 }}>No goals yet — add one to get started.</div>
      )}
    </div>
  );
}
