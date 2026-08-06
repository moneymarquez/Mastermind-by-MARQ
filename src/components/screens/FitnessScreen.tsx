import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useFitness } from '../../data/useFitness';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};

export default function FitnessScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { workouts, loading, addWorkout, removeWorkout, weekCount } = useFitness();
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');

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

  return (
    <div>
      <div style={homeHeadStyle}>Fitness</div>
      <div style={homeSubStyle}>Workouts and running log.</div>

      <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, marginTop: 24, maxWidth: 480 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, color: '#F5F6F7' }}>{loading ? '—' : weekCount}</div>
        <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 4 }}>Workouts this week</div>
      </div>

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
  );
}
