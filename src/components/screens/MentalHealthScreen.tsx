import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMentalHealth } from '../../data/useMentalHealth';
import type { Mood } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const MOODS: { key: Mood; label: string }[] = [
  { key: 'great', label: 'Great' },
  { key: 'good', label: 'Good' },
  { key: 'okay', label: 'Okay' },
  { key: 'rough', label: 'Rough' },
  { key: 'bad', label: 'Bad' },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function MentalHealthScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { checkins, loading, addCheckin } = useMentalHealth();
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!mood) return;
    await addCheckin(mood, note);
    setMood(null);
    setNote('');
  };

  return (
    <div>
      <div style={homeHeadStyle}>Mental Health</div>
      <div style={homeSubStyle}>Check in whenever — it's just for you.</div>

      <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 24, marginTop: 24, maxWidth: 520 }}>
        <div style={{ fontSize: 12.5, color: '#8A8F98', marginBottom: 10 }}>How are you feeling right now?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MOODS.map((m) => (
            <div
              key={m.key}
              onClick={() => setMood(m.key)}
              style={{
                padding: '9px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                border: `1px solid ${mood === m.key ? '#F5F6F7' : '#22262B'}`,
                background: mood === m.key ? '#F5F6F7' : 'transparent',
                color: mood === m.key ? '#0A0B0D' : '#C7CAD1',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's going on? (optional)"
          style={{ width: '100%', marginTop: 14, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '10px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none' }}
        />
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', marginTop: 14, padding: '10px 18px', borderRadius: 999,
            border: '1px solid #F5F6F7', color: mood ? '#F5F6F7' : '#565b64', fontSize: 13, cursor: mood ? 'pointer' : 'default',
            opacity: mood ? 1 : 0.5,
          }}
          onClick={submit}
        >
          Log check-in
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 520 }}>
        {checkins.map((c) => (
          <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7', textTransform: 'capitalize' }}>{c.mood}</span>
              <span style={{ fontSize: 12, color: '#565b64' }}>{timeAgo(c.created_at)}</span>
            </div>
            {c.note && <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 4 }}>{c.note}</div>}
          </div>
        ))}
        {!loading && checkins.length === 0 && (
          <div style={{ padding: '18px', fontSize: 13, color: '#565b64', background: '#101114' }}>No check-ins yet.</div>
        )}
      </div>
    </div>
  );
}
