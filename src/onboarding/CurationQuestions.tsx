import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { OnboardingAnswers } from '../data/useOnboardingProgress';

interface Props {
  initial: OnboardingAnswers;
  onComplete: (answers: OnboardingAnswers) => Promise<void>;
}

const GOAL_OPTIONS = ['Staying disciplined', 'Tracking my business', 'Managing my finances', 'Accountability', 'All of it'];
const STYLE_OPTIONS = [
  'I plan everything in advance',
  'I move fast and figure it out as I go',
  "I'm disciplined but scattered across too many tools",
  'I need accountability to actually follow through',
];

const chipStyle = (active: boolean): CSSProperties => ({
  padding: '10px 16px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
  border: `1px solid ${active ? '#F5F6F7' : '#22262B'}`, background: active ? '#F5F6F71a' : '#14161A',
  color: active ? '#F5F6F7' : '#8A8F98',
});
const inputStyle: CSSProperties = {
  width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
  padding: '11px 14px', color: '#F5F6F7', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

export default function CurationQuestions({ initial, onComplete }: Props) {
  const [goal, setGoal] = useState(initial.goal ?? '');
  const [style, setStyle] = useState(initial.style ?? '');
  const [why, setWhy] = useState(initial.why ?? '');
  const [submitting, setSubmitting] = useState(false);

  const canContinue = goal && style && why.trim();

  const submit = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    await onComplete({ goal, style, why: why.trim() });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0B0D', padding: '48px 24px 60px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F6F7', letterSpacing: '-0.01em', marginBottom: 2 }}>Masterminds by MARQ</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#F5F6F7', marginTop: 24, marginBottom: 6 }}>A few quick questions</div>
        <div style={{ fontSize: 13.5, color: '#8A8F98', marginBottom: 32, lineHeight: 1.6 }}>
          Not a survey — just enough for this to feel like yours from the start.
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>What are you hoping to get out of Mastermind?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {GOAL_OPTIONS.map((o) => <div key={o} style={chipStyle(goal === o)} onClick={() => setGoal(o)}>{o}</div>)}
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>How would you describe how you operate?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLE_OPTIONS.map((o) => <div key={o} style={chipStyle(style === o)} onClick={() => setStyle(o)}>{o}</div>)}
          </div>
        </div>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Why are you looking for something like this right now?</div>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="A sentence or two is plenty" />
        </div>

        <button
          onClick={submit}
          disabled={!canContinue || submitting}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 999, border: 'none', background: '#F5F6F7', color: '#0A0B0D',
            fontSize: 13.5, fontWeight: 600, cursor: !canContinue || submitting ? 'default' : 'pointer', opacity: !canContinue || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
