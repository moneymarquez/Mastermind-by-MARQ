import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BenderSession } from '../data/types';
import Icon from '../Icon';
import { useNovaPreferences } from '../data/useNovaPreferences';

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
  const { assistantName } = useNovaPreferences();
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
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 'var(--radius-pill)',
    fontSize: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer',
    background: activeBender ? '#3a2412' : 'var(--surface)',
    border: `1px solid ${activeBender ? '#B7690C' : 'var(--border)'}`,
    color: activeBender ? 'var(--warning)' : 'var(--text-secondary)',
  };

  return (
    <>
      <div style={pillStyle} onClick={() => setOpen(true)}>
        <Icon name="flame" size={13} color={activeBender ? 'var(--warning)' : 'var(--text-secondary)'} />
        {activeBender ? 'Bender active' : 'Bender mode'}
      </div>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.85)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', padding: 22, width: '100%', maxWidth: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            {activeBender ? (
              <>
                <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>Bender in progress</div>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                  Started {new Date(activeBender.started_at).toLocaleDateString()}
                  {activeBender.expected_days ? ` · ~${activeBender.expected_days} day${activeBender.expected_days === 1 ? '' : 's'} expected` : ''}
                  {activeBender.traveling ? ' · traveling' : ''}
                  {activeBender.description ? ` — ${activeBender.description}` : ''}
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
                  While this is active, Macros and Mental Health check-ins factor it in — recovery-minded food
                  suggestions, and mood/energy read in that context instead of against a normal baseline.
                </div>
                <div
                  style={{ marginTop: 16, textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--text)', color: 'var(--text)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer' }}
                  onClick={onEnd}
                >
                  End bender
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>Starting a bender</div>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 6 }}>Quick context — helps {assistantName} tell "cutting loose" from something worth a closer look.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  <input
                    type="number" min={1} placeholder="Expected days"
                    value={days} onChange={(e) => setDays(e.target.value)}
                    style={{ background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none' }}
                  />
                  <textarea
                    placeholder="What's going on?" rows={2}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    style={{ background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-body)', color: 'var(--text-quaternary)', cursor: 'pointer' }} onClick={() => setTraveling((v) => !v)}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${traveling ? 'var(--text)' : 'var(--border-2)'}`, background: traveling ? 'var(--text)' : 'transparent' }} />
                    Traveling
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
                  <div
                    style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--radius-pill)', background: saving ? 'var(--border)' : 'var(--text)', color: saving ? 'var(--text-secondary)' : 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}
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
