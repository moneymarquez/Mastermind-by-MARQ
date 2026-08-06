import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSobriety } from '../../data/useSobriety';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const toggleStyle = (active: boolean): CSSProperties => ({
  flex: 1, textAlign: 'center', padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
  border: `1px solid ${active ? '#F5F6F7' : '#22262B'}`,
  background: active ? '#F5F6F7' : 'transparent',
  color: active ? '#0A0B0D' : '#C7CAD1',
  fontSize: 13, fontWeight: 600,
});

export default function SobrietyScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { checkins, todayCheckin, streak, loading, saveToday } = useSobriety();
  const [note, setNote] = useState(todayCheckin?.note ?? '');

  const drank = todayCheckin?.drank ?? false;
  const weed = todayCheckin?.weed ?? false;
  const nicotine = todayCheckin?.nicotine ?? false;
  const heavy = todayCheckin?.heavy ?? false;

  return (
    <div>
      <div style={homeHeadStyle}>Sobriety</div>
      <div style={homeSubStyle}>Drinking, weed, and nicotine — logged daily.</div>

      <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 24, marginTop: 24, maxWidth: 480 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 600, color: '#F5F6F7' }}>
          {loading ? '—' : streak} <span style={{ fontSize: 18, color: '#565b64' }}>day{streak === 1 ? '' : 's'} clean</span>
        </div>

        {heavy && (
          <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #B7690C', color: '#B7690C', fontSize: 12.5 }}>
            Heavy day flagged — multiple substances logged today.
          </div>
        )}

        <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 20, marginBottom: 8 }}>Today</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={toggleStyle(drank)} onClick={() => saveToday({ drank: !drank })}>Drank</div>
          <div style={toggleStyle(weed)} onClick={() => saveToday({ weed: !weed })}>Weed</div>
          <div style={toggleStyle(nicotine)} onClick={() => saveToday({ nicotine: !nicotine })}>Nicotine</div>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveToday({ note: note || null })}
          placeholder="Note (optional)"
          style={{ width: '100%', marginTop: 12, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px', color: '#F5F6F7', fontSize: 13, outline: 'none' }}
        />
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 480 }}>
        {checkins.slice(0, 14).map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <span style={{ fontSize: 13, color: '#C7CAD1' }}>{c.checkin_date}</span>
            <span style={{ fontSize: 12, color: c.drank || c.weed || c.nicotine ? '#B7690C' : '#8A8F98' }}>
              {c.drank || c.weed || c.nicotine
                ? [c.drank && 'Drank', c.weed && 'Weed', c.nicotine && 'Nicotine'].filter(Boolean).join(', ')
                : 'Clean'}
            </span>
          </div>
        ))}
        {!loading && checkins.length === 0 && (
          <div style={{ padding: '18px', fontSize: 13, color: '#565b64', background: '#101114' }}>No check-ins logged yet.</div>
        )}
      </div>
    </div>
  );
}
