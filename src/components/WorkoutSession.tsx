import { useEffect, useRef, useState } from 'react';
import type { WorkoutLibraryItem } from '../data/types';
import Icon from '../Icon';

interface Props {
  workout: WorkoutLibraryItem;
  onFinish: (durationMin: number) => Promise<void>;
  onExit: () => void;
}

const TIMER_PREFS_KEY = 'mastermind-workout-timer-prefs';
const DEFAULT_REST_SECONDS = 60;
// 0 = off — a set is completed by tapping "Complete set", the original
// behavior. Any value >0 turns the set itself into a countdown (for
// timed holds/planks/intervals) that auto-completes at zero; tapping
// "Complete set" early still works regardless.
const DEFAULT_SET_SECONDS = 0;

function loadTimerPrefs(): { restSeconds: number; setSeconds: number } {
  try {
    const raw = localStorage.getItem(TIMER_PREFS_KEY);
    if (!raw) return { restSeconds: DEFAULT_REST_SECONDS, setSeconds: DEFAULT_SET_SECONDS };
    const parsed = JSON.parse(raw) as { restSeconds?: unknown; setSeconds?: unknown };
    const rest = Number(parsed.restSeconds);
    const set = Number(parsed.setSeconds);
    return {
      restSeconds: Number.isFinite(rest) && rest >= 0 ? rest : DEFAULT_REST_SECONDS,
      setSeconds: Number.isFinite(set) && set >= 0 ? set : DEFAULT_SET_SECONDS,
    };
  } catch {
    return { restSeconds: DEFAULT_REST_SECONDS, setSeconds: DEFAULT_SET_SECONDS };
  }
}

const numberInput: React.CSSProperties = {
  width: 64, textAlign: 'center', background: 'var(--surface-4)', border: '1px solid var(--border-2)',
  borderRadius: 'var(--radius-sm)', padding: '8px 6px', color: 'var(--text)', fontSize: 16, outline: 'none', fontFamily: 'inherit',
};

// Steps through the selected workout's exercises in sequence, tracking sets
// completed per exercise and running a rest timer between them — live
// session mode, not just a static list to reference. Session state is
// intentionally not persisted to the DB; if the app closes mid-workout the
// session is lost, same tradeoff as not building a resumable-session table
// for what's meant to be a single continuous gym visit. Rest/set timer
// LENGTHS are persisted (localStorage, not the DB — a per-device timing
// preference, not data worth syncing) so they carry over to the next workout.
export default function WorkoutSession({ workout, onFinish, onExit }: Props) {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setsDone, setSetsDone] = useState(0);
  const [resting, setResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(() => loadTimerPrefs().restSeconds);
  const [setSeconds, setSetSeconds] = useState(() => loadTimerPrefs().setSeconds);
  const [restLeft, setRestLeft] = useState(restSeconds);
  const [setLeft, setSetLeft] = useState(setSeconds);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify({ restSeconds, setSeconds }));
  }, [restSeconds, setSeconds]);

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
      setRestLeft(restSeconds);
      setResting(true);
    }
  };

  // A new set starts (page loads on a fresh exercise, or rest just ended) —
  // reset the work countdown so it's always full at the start of a set.
  useEffect(() => {
    if (!resting) setSetLeft(setSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting, exerciseIdx, setSeconds]);

  // The set-timer countdown itself — only runs when a timed set is turned
  // on (setSeconds > 0), there's no rest in progress, and sets remain.
  // Hits zero -> completes the set exactly like tapping the button.
  useEffect(() => {
    if (resting || setSeconds <= 0 || allSetsDone) return;
    if (setLeft <= 0) {
      completeSet();
      return;
    }
    const t = setTimeout(() => setSetLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting, setSeconds, setLeft, allSetsDone]);

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

  const timedSetActive = setSeconds > 0 && !resting && !allSetsDone;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 220, display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>{workout.name}</div>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 2 }}>Exercise {exerciseIdx + 1} of {workout.exercises.length}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ cursor: 'pointer', padding: 6 }} onClick={() => setShowTimerSettings((v) => !v)} title="Set/rest timer lengths">
            <Icon name="gear-six" size={18} color={showTimerSettings ? 'var(--text)' : 'var(--text-secondary)'} />
          </span>
          <span style={{ cursor: 'pointer', padding: 6 }} onClick={onExit}>
            <Icon name="x" color="var(--text-secondary)" />
          </span>
        </div>
      </div>

      {showTimerSettings && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginTop: 14, padding: 14, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginBottom: 6 }}>Set timer (sec, 0 = off)</div>
            <input
              type="number" inputMode="numeric" min={0} style={numberInput} value={setSeconds}
              onChange={(e) => setSetSeconds(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginBottom: 6 }}>Rest between sets (sec)</div>
            <input
              type="number" inputMode="numeric" min={0} style={numberInput} value={restSeconds}
              onChange={(e) => setRestSeconds(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {resting ? (
          <>
            <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 10 }}>Rest</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 600, color: 'var(--text)' }}>{restLeft}s</div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 14 }}>Next: set {setsDone + 1} of {exercise.sets}, {exercise.name}</div>
            <div
              style={{ marginTop: 20, padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }}
              onClick={() => setResting(false)}
            >
              Skip rest
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 'var(--text-stat)', fontWeight: 600, color: 'var(--text)', maxWidth: 320 }}>{exercise.name}</div>
            <div style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', marginTop: 10 }}>{exercise.reps || '—'} reps</div>
            {timedSetActive ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 56, fontWeight: 600, color: 'var(--text)', marginTop: 20 }}>{setLeft}s</div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 600, color: 'var(--text)', marginTop: 24 }}>
                {setsDone} / {exercise.sets}
              </div>
            )}
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {timedSetActive ? `set ${setsDone + 1} of ${exercise.sets}` : 'sets completed'}
            </div>

            {!allSetsDone && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-label)', fontWeight: 600, cursor: 'pointer' }}
                onClick={completeSet}
              >
                Complete set
              </div>
            )}
            {allSetsDone && !isLastExercise && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-label)', fontWeight: 600, cursor: 'pointer' }}
                onClick={nextExercise}
              >
                Next exercise →
              </div>
            )}
            {allSetsDone && isLastExercise && (
              <div
                style={{ marginTop: 28, padding: '14px 32px', borderRadius: 'var(--radius-pill)', background: finishing ? 'var(--border)' : 'var(--text)', color: finishing ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-label)', fontWeight: 600, cursor: finishing ? 'default' : 'pointer' }}
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
