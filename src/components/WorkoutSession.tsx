import { useEffect, useRef, useState } from 'react';
import type { WorkoutLibraryItem } from '../data/types';
import Icon from '../Icon';

interface Props {
  workout: WorkoutLibraryItem;
  onFinish: (durationMin: number) => Promise<void>;
  onExit: () => void;
}

const REST_SECONDS = 60;

// Steps through the selected workout's exercises in sequence, tracking sets
// completed per exercise and running a rest timer between them — live
// session mode, not just a static list to reference. Session state is
// intentionally not persisted to the DB; if the app closes mid-workout the
// session is lost, same tradeoff as not building a resumable-session table
// for what's meant to be a single continuous gym visit.
export default function WorkoutSession({ workout, onFinish, onExit }: Props) {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setsDone, setSetsDone] = useState(0);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(REST_SECONDS);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!resting) return;
    if (restLeft <= 0) {
      setResting(false);
      return;
    }
    const t = setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resting, restLeft]);

  const exercise = workout.exercises[exerciseIdx];
  const isLastExercise = exerciseIdx === workout.exercises.length - 1;
  const allSetsDone = setsDone >= exercise.sets;

  const completeSet = () => {
    const next = setsDone + 1;
    setSetsDone(next);
    if (next < exercise.sets) {
      setRestLeft(REST_SECONDS);
      setResting(true);
    }
  };

  const nextExercise = () => {
    setExerciseIdx((i) => i + 1);
    setSetsDone(0);
    setResting(false);
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const durationMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
      await onFinish(durationMin);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 220, display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{workout.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Exercise {exerciseIdx + 1} of {workout.exercises.length}</div>
        </div>
        <span style={{ cursor: 'pointer', padding: 6 }} onClick={onExit}>
          <Icon name="x" color="var(--text-secondary)" />
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {resting ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Rest</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 64, fontWeight: 600, color: 'var(--text)' }}>{restLeft}s</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 14 }}>Next: set {setsDone + 1} of {exercise.sets}, {exercise.name}</div>
            <div
              style={{ marginTop: 20, padding: '9px 18px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer' }}
              onClick={() => setResting(false)}
            >
              Skip rest
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', maxWidth: 320 }}>{exercise.name}</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 10 }}>{exercise.reps || '—'} reps</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 600, color: 'var(--text)', marginTop: 24 }}>
              {setsDone} / {exercise.sets}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>sets completed</div>

            {!allSetsDone && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 999, background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onClick={completeSet}
              >
                Complete set
              </div>
            )}
            {allSetsDone && !isLastExercise && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 999, background: 'var(--text)', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onClick={nextExercise}
              >
                Next exercise →
              </div>
            )}
            {allSetsDone && isLastExercise && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 999, background: finishing ? 'var(--border)' : 'var(--text)', color: finishing ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: finishing ? 'default' : 'pointer' }}
                onClick={() => !finishing && finish()}
              >
                {finishing ? 'Saving…' : 'Finish workout'}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {workout.exercises.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < exerciseIdx || (i === exerciseIdx && allSetsDone) ? 'var(--text)' : i === exerciseIdx ? 'var(--text-tertiary)' : 'var(--border)' }} />
        ))}
      </div>
    </div>
  );
}
