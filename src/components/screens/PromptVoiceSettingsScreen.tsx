import type { CSSProperties } from 'react';
import { useNovaPreferences } from '../../data/useNovaPreferences';
import type { NovaTone } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, maxWidth: 480 };

const TONE_OPTIONS: { value: NovaTone; label: string; desc: string }[] = [
  { value: 'direct', label: 'Direct', desc: 'Blunt and to the point — no cushioning.' },
  { value: 'encouraging', label: 'Encouraging', desc: 'Warm, leads with what\'s working, softer on hard truths.' },
  { value: 'neutral', label: 'Neutral', desc: 'Plain and matter-of-fact, no flourish.' },
];

export default function PromptVoiceSettingsScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { tone, loading, save } = useNovaPreferences();

  return (
    <div>
      <div style={homeHeadStyle}>Prompt & Voice</div>
      <div style={homeSubStyle}>How Nova talks to you.</div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 4 }}>Tone</div>
          <div style={{ fontSize: 12, color: '#565b64', marginBottom: 14 }}>Changes how Nova writes every reply — chat, check-ins, daily plan notes, all of it.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TONE_OPTIONS.map((opt) => {
              const active = tone === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => !loading && save(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: loading ? 'default' : 'pointer',
                    border: `1px solid ${active ? '#F5F6F7' : '#22262B'}`, background: active ? '#F5F6F71a' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `1px solid ${active ? '#F5F6F7' : '#3a3d43'}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5F6F7' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 6 }}>Voice</div>
          <div style={{ fontSize: 12.5, color: '#565b64' }}>Voice input/output — coming soon.</div>
        </div>
      </div>
    </div>
  );
}
