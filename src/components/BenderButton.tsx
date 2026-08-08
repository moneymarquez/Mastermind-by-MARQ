import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BenderSession } from '../data/types';
import Icon from '../Icon';

interface Props {
  activeBender: BenderSession | null;
  onStart: (b: { expected_days: number | null; description: string | null; traveling: boolean }) => Promise<void>;
  onEnd: () => Promise<void>;
}

// Lives solely on the Sobriety screen (not global) — an inline pill in the
// page flow there, rather than pinned to a fixed corner across every
// screen. Captures context on start (not a silent toggle) so the
// journal/pattern tracker has something real to work with later.
export default function BenderButton({ activeBender, onStart, onEnd }: Props) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState('');
  const [description, setDescription] = useState('');
  const [traveling, setTraveling] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onStart({ expected_days: days ? Number(days) : null, description: description.trim() || null, traveling });
      setOpen(false);
      setDays(''); setDescription(''); setTraveling(false);
    } finally {
      setSaving(false);
    }
  };

  const pillStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    background: activeBender ? '#3a2412' : '#14161A',
    border: `1px solid ${activeBender ? '#B7690C' : '#22262B'}`,
    color: activeBender ? '#e0a35c' : '#8A8F98',
  };

  return (
    <>
      <div style={pillStyle} onClick={() => setOpen(true)}>
        <Icon name="flame" size={13} color={activeBender ? '#e0a35c' : '#8A8F98'} />
        {activeBender ? 'Bender active' : 'Bender mode'}
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.85)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 16, padding: 22, width: '100%', maxWidth: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeBender ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>Bender in progress</div>
                <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 8, lineHeight: 1.5 }}>
                  Started {new Date(activeBender.started_at).toLocaleDateString()}
                  {activeBender.expected_days ? ` · ~${activeBender.expected_days} day${activeBender.expected_days === 1 ? '' : 's'} expected` : ''}
                  {activeBender.traveling ? ' · traveling' : ''}
                  {activeBender.description ? ` — ${activeBender.description}` : ''}
                </div>
                <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 10, lineHeight: 1.5 }}>
                  While this is active, Macros and Mental Health check-ins factor it in — recovery-minded food
                  suggestions, and mood/energy read in that context instead of against a normal baseline.
                </div>
                <div
                  style={{ marginTop: 16, textAlign: 'center', padding: '10px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onClick={onEnd}
                >
                  End bender
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>Starting a bender</div>
                <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 6 }}>Quick context — helps Nova tell "cutting loose" from something worth a closer look.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  <input
                    type="number" min={1} placeholder="Expected days"
                    value={days} onChange={(e) => setDays(e.target.value)}
                    style={{ background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px', color: '#F5F6F7', fontSize: 13, outline: 'none' }}
                  />
                  <textarea
                    placeholder="What's going on?" rows={2}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    style={{ background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px', color: '#F5F6F7', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#C7CAD1', cursor: 'pointer' }} onClick={() => setTraveling((v) => !v)}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${traveling ? '#F5F6F7' : '#2b2f36'}`, background: traveling ? '#F5F6F7' : 'transparent' }} />
                    Traveling
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 999, color: '#8A8F98', fontSize: 13, cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
                  <div
                    style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 999, background: saving ? '#22262B' : '#F5F6F7', color: saving ? '#8A8F98' : '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
                    onClick={() => !saving && submit()}
                  >
                    {saving ? 'Starting…' : 'Start'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
