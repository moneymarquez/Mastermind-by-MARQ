import type { CSSProperties } from 'react';
import type { SpineStation } from '../data/clientSpine';
import type { SpineState, SpineStationKey } from '../data/types';

interface Props {
  stations: SpineStation[];
  /** Operator only — shows the override chips. The client never sees these. */
  onOverride?: (key: SpineStationKey, state: SpineState | null) => void;
}

const STATE_COLOR: Record<SpineState, string> = {
  done: 'var(--success)',
  active: 'var(--text)',
  next: 'var(--text-tertiary)',
};

/** The progress spine, rendered identically for the client (portal Home)
 *  and the operator (Client Modules) — same buildSpine() output, same
 *  component, so what you see is what they see. A vertical rail reads at
 *  a glance on a phone: a filled check is done, a bold ring is happening
 *  now, a hollow dot is next. */
export default function ProgressSpine({ stations, onOverride }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stations.map((s, i) => {
        const color = STATE_COLOR[s.state];
        const last = i === stations.length - 1;
        const dot: CSSProperties = s.state === 'done'
          ? { background: color, border: `2px solid ${color}`, color: 'var(--bg)' }
          : s.state === 'active'
            ? { background: 'transparent', border: `2.5px solid ${color}`, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 14%, transparent)` }
            : { background: 'transparent', border: '2px solid var(--border-2)' };
        return (
          <div key={s.key} style={{ display: 'flex', gap: 14, minHeight: 56 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, boxSizing: 'border-box', ...dot }}>
                {s.state === 'done' ? '✓' : ''}
              </div>
              {!last && <div style={{ width: 2, flex: 1, minHeight: 18, background: s.state === 'done' ? 'var(--success)' : 'var(--border)', margin: '4px 0' }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: s.state === 'active' ? 700 : 600, color: s.state === 'next' ? 'var(--text-secondary)' : 'var(--text)' }}>{s.label}</span>
                <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color }}>
                  {s.state === 'done' ? 'Done' : s.state === 'active' ? 'Happening now' : 'Next'}
                </span>
                {s.overridden && onOverride && <span style={{ fontSize: 'var(--text-micro)', color: 'var(--warning)' }}>set by hand</span>}
              </div>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 2, overflowWrap: 'anywhere' }}>{s.detail}</div>
              {onOverride && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {(['done', 'active', 'next'] as SpineState[]).map((st) => {
                    const on = s.overridden && s.state === st;
                    return (
                      <span key={st} onClick={() => onOverride(s.key, on ? null : st)} style={{ fontSize: 'var(--text-micro)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, color: on ? 'var(--text)' : 'var(--text-tertiary)' }}>
                        {st}
                      </span>
                    );
                  })}
                  {s.overridden && <span onClick={() => onOverride(s.key, null)} style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '3px 4px' }}>let the data decide</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
