import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useGoals } from '../../data/useGoals';
import type { Goal } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};

function GoalCard({ goal, onAddStep, onToggleStep, onRemoveStep, onSaveProgress, onDelete }: {
  goal: Goal;
  onAddStep: (goalId: string, description: string) => void;
  onToggleStep: (stepId: string, done: boolean) => void;
  onRemoveStep: (stepId: string) => void;
  onSaveProgress: (goalId: string, value: number) => void;
  onDelete: (goalId: string) => void;
}) {
  const [stepText, setStepText] = useState('');
  const [savedInput, setSavedInput] = useState(String(goal.current_saved));
  const pct = goal.target_cost ? Math.min(100, (goal.current_saved / goal.target_cost) * 100) : 0;

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
    </div>
  );
}

export default function GoalsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { goals, loading, addGoal, updateGoal, deleteGoal, addStep, toggleStep, removeStep } = useGoals();
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
          />
        ))}
      </div>
      {!loading && goals.length === 0 && (
        <div style={{ fontSize: 13, color: '#565b64', marginTop: 24 }}>No goals yet — add one to get started.</div>
      )}
    </div>
  );
}
