import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFitness } from '../../data/useFitness';
import { LOCK_IN_QUESTIONS, generateLockInRoutes } from '../../lib/fitnessLockIn';
import { AiError } from '../../lib/ai';
import type { CustomFitnessPlan, FitnessRoute } from '../../data/types';

interface Props {
  fitness: ReturnType<typeof useFitness>;
  onPlanConfirmed: (route: FitnessRoute) => Promise<void>;
}

const inputStyle: CSSProperties = {
  width: '100%', background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '11px 14px',
  color: '#F5F6F7', fontSize: 14, outline: 'none',
};

function RouteCard({ route, recommended, onChoose, choosing }: { route: FitnessRoute; recommended: boolean; onChoose: () => void; choosing: boolean }) {
  return (
    <div style={{ background: '#101114', border: `1px solid ${recommended ? '#F5F6F7' : '#22262B'}`, borderRadius: 14, padding: 20, flex: '1 1 280px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{route.label}</div>
        {recommended && <span style={{ fontSize: 10, fontWeight: 700, color: '#0A0B0D', background: '#F5F6F7', borderRadius: 999, padding: '2px 8px' }}>RECOMMENDED</span>}
      </div>
      <div style={{ fontSize: 11.5, color: '#8A8F98', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{route.intensity}</div>
      <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 10, lineHeight: 1.6 }}>{route.summary}</div>

      <div style={{ display: 'flex', gap: 12, marginTop: 14, fontSize: 11.5, color: '#8A8F98', flexWrap: 'wrap' }}>
        <span>💧 {route.water_target_oz}oz/day</span>
        <span>🛏️ {route.sleep_target_hours}h sleep</span>
        <span>🏋️ {route.workout_time} daily</span>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer' }}>Workout plan</summary>
        <div style={{ fontSize: 12.5, color: '#C7CAD1', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{route.workout_plan}</div>
      </details>
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer' }}>Meal plan</summary>
        <div style={{ fontSize: 12.5, color: '#C7CAD1', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{route.meal_plan}</div>
      </details>
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer' }}>Daily schedule</summary>
        <div style={{ fontSize: 12.5, color: '#C7CAD1', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{route.schedule_notes}</div>
      </details>

      <div
        style={{ marginTop: 16, textAlign: 'center', padding: '10px 16px', borderRadius: 999, background: choosing ? '#22262B' : '#F5F6F7', color: choosing ? '#8A8F98' : '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: choosing ? 'default' : 'pointer' }}
        onClick={() => !choosing && onChoose()}
      >
        {choosing ? 'Confirming…' : 'Choose this route'}
      </div>
    </div>
  );
}

export default function LockInView({ fitness, onPlanConfirmed }: Props) {
  const { activeCustomPlan, saveCustomFitnessPlan, confirmCustomFitnessPlan } = fitness;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qIdx, setQIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [draftPlan, setDraftPlan] = useState<CustomFitnessPlan | null>(null);
  const [choosingRoute, setChoosingRoute] = useState<'a' | 'b' | null>(null);
  const [restarting, setRestarting] = useState(false);

  const q = LOCK_IN_QUESTIONS[qIdx];
  const isLastQ = qIdx === LOCK_IN_QUESTIONS.length - 1;

  const submitAnswer = () => {
    if (isLastQ) {
      runGeneration();
    } else {
      setQIdx((i) => i + 1);
    }
  };

  const runGeneration = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const { route_a, route_b } = await generateLockInRoutes(answers);
      const saved = await saveCustomFitnessPlan({ questionnaire_answers: answers, route_a, route_b });
      setDraftPlan(saved);
    } catch (err) {
      setGenError(err instanceof AiError ? err.message : 'Could not generate your plan — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const chooseRoute = async (route: 'a' | 'b') => {
    if (!draftPlan) return;
    setChoosingRoute(route);
    try {
      await confirmCustomFitnessPlan(draftPlan.id, route);
      await onPlanConfirmed(route === 'a' ? draftPlan.route_a : draftPlan.route_b);
      setDraftPlan(null);
      setAnswers({});
      setQIdx(0);
    } finally {
      setChoosingRoute(null);
    }
  };

  if (activeCustomPlan && !restarting) {
    const route = activeCustomPlan.chosen_route === 'a' ? activeCustomPlan.route_a : activeCustomPlan.route_b;
    return (
      <div style={{ marginTop: 20, maxWidth: 480 }}>
        <div style={{ fontSize: 13, color: '#8A8F98' }}>Active plan</div>
        <RouteCard route={route} recommended={false} onChoose={() => {}} choosing={false} />
        <div style={{ marginTop: 14, fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => setRestarting(true)}>
          Start a new Lock In session (replaces this plan)
        </div>
      </div>
    );
  }

  if (draftPlan) {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: '#8A8F98', marginBottom: 14, maxWidth: 620 }}>
          Two routes to get there — neither is the slow path, just different intensity. Pick one to make it your active plan.
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 900 }}>
          <RouteCard route={draftPlan.route_a} recommended={draftPlan.route_a.intensity === 'aggressive'} onChoose={() => chooseRoute('a')} choosing={choosingRoute === 'a'} />
          <RouteCard route={draftPlan.route_b} recommended={false} onChoose={() => chooseRoute('b')} choosing={choosingRoute === 'b'} />
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{ marginTop: 40, textAlign: 'center', color: '#8A8F98', fontSize: 13 }}>
        Nova is building your plan — reverse-engineering the numbers, writing two full routes…
      </div>
    );
  }

  return (
    <div style={{ marginTop: 30, maxWidth: 480 }}>
      <div style={{ fontSize: 11.5, color: '#565b64' }}>Question {qIdx + 1} of {LOCK_IN_QUESTIONS.length}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#F5F6F7', marginTop: 8, lineHeight: 1.4 }}>{q.prompt}</div>
      <input
        autoFocus
        style={{ ...inputStyle, marginTop: 16 }}
        placeholder={q.placeholder}
        value={answers[q.key] ?? ''}
        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
      />
      {genError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 10 }}>{genError}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {qIdx > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 999, color: '#8A8F98', fontSize: 13, cursor: 'pointer' }} onClick={() => setQIdx((i) => i - 1)}>
            Back
          </div>
        )}
        <div style={{ padding: '10px 24px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={submitAnswer}>
          {isLastQ ? 'Generate my plan' : 'Next'}
        </div>
      </div>
    </div>
  );
}
