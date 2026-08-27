import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFitness } from '../../data/useFitness';
import { WORKOUT_LIBRARY_SEED } from '../../data/workoutLibrarySeed';
import type { WorkoutCategory, WorkoutLibraryItem } from '../../data/types';
import WorkoutSession from '../WorkoutSession';

const CATEGORY_LABELS: Record<WorkoutCategory, string> = {
  running: 'Running / Walking',
  bro_split: 'Bro Split',
  back_biceps: 'Back & Biceps',
  chest_triceps: 'Chest & Triceps',
  legs: 'Legs',
  core: 'Core',
};
const CATEGORIES: WorkoutCategory[] = ['running', 'bro_split', 'back_biceps', 'chest_triceps', 'legs', 'core'];

interface Props {
  fitness: ReturnType<typeof useFitness>;
}

export default function WorkoutLibraryView({ fitness }: Props) {
  const { library, loading, loadWorkoutLibrarySeed, libraryByCategory, addWorkout } = fitness;
  const [category, setCategory] = useState<WorkoutCategory>('bro_split');
  const [selected, setSelected] = useState<WorkoutLibraryItem | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [session, setSession] = useState<WorkoutLibraryItem | null>(null);

  const chipStyle = (active: boolean): CSSProperties => ({
    padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600, whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
    background: active ? '#F5F6F71a' : 'transparent',
  });

  const loadSeed = async () => {
    setSeeding(true);
    try {
      await loadWorkoutLibrarySeed(WORKOUT_LIBRARY_SEED);
    } finally {
      setSeeding(false);
    }
  };

  const items = libraryByCategory(category);

  if (session) {
    return (
      <WorkoutSession
        workout={session}
        onFinish={async (durationMin) => {
          await addWorkout({ workout_type: session.name, duration_min: durationMin, distance_mi: null, notes: `From library: ${CATEGORY_LABELS[session.category]}` });
          setSession(null);
        }}
        onExit={() => setSession(null)}
      />
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      {!loading && library.length === 0 && (
        <div
          style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: seeding ? 'var(--border)' : 'var(--text)', color: seeding ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: seeding ? 'default' : 'pointer', marginBottom: 16 }}
          onClick={() => !seeding && loadSeed()}
        >
          {seeding ? 'Loading library…' : 'Load workout library (40 workouts)'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map((c) => (
          <div key={c} style={chipStyle(category === c)} onClick={() => { setCategory(c); setSelected(null); }}>
            {CATEGORY_LABELS[c]}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 16, maxWidth: 720 }}>
        {items.map((w) => (
          <div
            key={w.id}
            onClick={() => setSelected(w)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{w.name}</div>
            {w.day_label && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 2 }}>{w.day_label}</div>}
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6 }}>{w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}</div>
          </div>
        ))}
        {!loading && items.length > 0 === false && library.length > 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing in this category.</div>
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.85)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', padding: 22, width: '100%', maxWidth: 420, maxHeight: '75vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 600, color: 'var(--text)' }}>{selected.name}</div>
            {selected.day_label && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 2 }}>{selected.day_label}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {selected.exercises.map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--surface-3)' }}>
                  <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary)' }}>{e.name}</span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 10 }}>{e.sets} × {e.reps || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <div
                style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { setSession(selected); setSelected(null); }}
              >
                Start workout
              </div>
              <div style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', cursor: 'pointer' }} onClick={() => setSelected(null)}>Close</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
