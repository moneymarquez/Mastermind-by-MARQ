import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFitness } from '../../data/useFitness';
import { useMacros } from '../../data/useMacros';
import type { FitnessPlanKind, FitnessRoute, FitnessWorkout } from '../../data/types';
import { askClaude, AiError } from '../../lib/ai';
import WorkoutLibraryView from './WorkoutLibraryView';
import LockInView from './LockInView';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

async function generateFitnessPlan(kind: FitnessPlanKind, workouts: FitnessWorkout[]): Promise<string> {
  const recent = workouts
    .slice(0, 14)
    .map((w) => `${w.workout_date}: ${w.workout_type}${w.duration_min ? `, ${w.duration_min}min` : ''}${w.distance_mi ? `, ${w.distance_mi}mi` : ''}`)
    .join('\n') || '(no workouts logged yet)';

  const system =
    kind === 'workout'
      ? "You are Nova, Cristopher's fitness coach inside his personal tracker. Write a practical 7-day workout plan " +
        'grounded in his recent training history below — match his apparent fitness level and habits, progress him ' +
        "sensibly, and don't prescribe anything wildly out of line with what he's actually been doing. Plain text, " +
        'day-by-day, no markdown headers, concise.'
      : "You are Nova, Cristopher's nutrition coach inside his personal tracker. Write a practical daily diet plan " +
        "(meals + rough macro targets) that supports his training load below. Plain text, no markdown headers, concise.";

  return askClaude({
    system,
    messages: [{ role: 'user', content: `Recent workouts:\n${recent}\n\nGenerate the plan.` }],
    maxTokens: 900,
  });
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const tabStyle = (active: boolean): CSSProperties => ({
  padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  border: `1px solid ${active ? '#F5F6F7' : '#22262B'}`, color: active ? '#F5F6F7' : '#565b64',
  background: active ? '#F5F6F71a' : 'transparent',
});

type Tab = 'library' | 'lock-in' | 'log';

export default function FitnessScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const fitness = useFitness();
  const { workouts, plans, loading, addWorkout, removeWorkout, weekCount, savePlan } = fitness;
  const { setNutritionTarget } = useMacros();
  const [tab, setTab] = useState<Tab>('library');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState<FitnessPlanKind | null>(null);
  const [aiError, setAiError] = useState('');

  const generate = async (kind: FitnessPlanKind) => {
    setGenerating(kind);
    setAiError('');
    try {
      const text = await generateFitnessPlan(kind, workouts);
      await savePlan(kind, text);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not generate a plan — try again.');
    } finally {
      setGenerating(null);
    }
  };

  const submit = async () => {
    if (!type.trim()) return;
    await addWorkout({
      workout_type: type.trim(),
      duration_min: duration ? Number(duration) : null,
      distance_mi: distance ? Number(distance) : null,
      notes: notes.trim() || null,
    });
    setType('');
    setDuration('');
    setDistance('');
    setNotes('');
  };

  // Lock In's confirmed route feeds Macros' daily target directly — no
  // separate step to go set it manually in Macros & Meals.
  const onPlanConfirmed = async (route: FitnessRoute) => {
    await setNutritionTarget({
      goal_id: null,
      daily_calories: route.daily_calories,
      daily_protein_g: route.daily_protein_g,
      daily_carbs_g: route.daily_carbs_g,
      daily_fat_g: route.daily_fat_g,
      rationale: `From Lock In: ${route.label}`,
    });
  };

  return (
    <div>
      <div style={homeHeadStyle}>Fitness</div>
      <div style={homeSubStyle}>Library workouts, a custom Lock In plan, or log anything ad hoc.</div>

      <div style={{ display: 'flex', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: '16px 20px', minWidth: 140 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, color: '#F5F6F7' }}>{loading ? '—' : weekCount}</div>
          <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 4 }}>Workouts this week</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <div style={tabStyle(tab === 'library')} onClick={() => setTab('library')}>Library</div>
        <div style={tabStyle(tab === 'lock-in')} onClick={() => setTab('lock-in')}>Lock In</div>
        <div style={tabStyle(tab === 'log')} onClick={() => setTab('log')}>Log & History</div>
      </div>

      {tab === 'library' && <WorkoutLibraryView fitness={fitness} />}
      {tab === 'lock-in' && <LockInView fitness={fitness} onPlanConfirmed={onPlanConfirmed} />}

      {tab === 'log' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, background: generating ? '#22262B' : '#F5F6F7', color: generating ? '#8A8F98' : '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: generating ? 'default' : 'pointer' }}
              onClick={() => !generating && generate('workout')}
            >
              {generating === 'workout' ? 'Generating…' : '✨ AI workout plan'}
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: generating ? '#565b64' : '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: generating ? 'default' : 'pointer' }}
              onClick={() => !generating && generate('diet')}
            >
              {generating === 'diet' ? 'Generating…' : '✨ AI diet plan'}
            </div>
          </div>
          {aiError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}

          {plans.length > 0 && (
            <div style={{ marginTop: 18, background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 22, maxWidth: 640 }}>
              <div style={{ fontSize: 12, color: '#8A8F98', marginBottom: 8 }}>
                Latest {plans[0].kind} plan · {new Date(plans[0].created_at).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 13.5, color: '#F5F6F7', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace" }}>{plans[0].plan_text}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap', maxWidth: 640 }}>
            <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Type (e.g. Run, Lift)" value={type} onChange={(e) => setType(e.target.value)} />
            <input style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Minutes" value={duration} onChange={(e) => setDuration(e.target.value)} />
            <input style={{ ...inputStyle, flex: '1 1 100px' }} placeholder="Miles (opt.)" value={distance} onChange={(e) => setDistance(e.target.value)} />
            <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Notes (opt.)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={submit}
            >
              Log workout
            </div>
          </div>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
            {workouts.map((w) => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{w.workout_type}</div>
                  <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 2 }}>
                    {w.workout_date}
                    {w.duration_min ? ` · ${w.duration_min} min` : ''}
                    {w.distance_mi ? ` · ${w.distance_mi} mi` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#565b64', cursor: 'pointer' }} onClick={() => removeWorkout(w.id)}>Remove</span>
              </div>
            ))}
            {!loading && workouts.length === 0 && (
              <div style={{ padding: '18px', fontSize: 13, color: '#565b64', background: '#101114' }}>No workouts logged yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
