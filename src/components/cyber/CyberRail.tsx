import type { CSSProperties } from 'react';
import type { NavRow } from '../../navRows';
import Icon from '../../Icon';

export const RAIL_WIDTH = 76;
export const RAIL_WIDTH_OPEN = 210;

interface Props {
  rows: NavRow[];
  onOpenSettings: () => void;
  settingsActive: boolean;
}

/** Desktop navigation, Cyberpunk: a left rail, 76px at rest, 210px on
 *  hover (width only, no fade). Same rule as the mobile bar — the whole
 *  cell is the target and the whole cell lights, with the 2px accent on
 *  the cell's left edge. Expansion overlays the content; nothing shifts. */
export default function CyberRail({ rows, onOpenSettings, settingsActive }: Props) {
  return (
    <div
      className="cp-rail-nav"
      style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 31, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRight: '1px solid var(--edge)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 64, padding: '0 0 0 22px', borderBottom: '1px solid var(--edge)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        <img src="/marq-wordmark.png" alt="MARQ" style={{ width: 30, height: 30, objectFit: 'contain', filter: 'var(--mm-logo-filter)', mixBlendMode: 'var(--mm-logo-blend)' as CSSProperties['mixBlendMode'], flexShrink: 0 }} />
        <span className="cp-rail-label" style={{ color: 'var(--text)' }}>Masterminds</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {rows.map((row) => {
          if (row.kind === 'header') return <div key={row.key} className="cp-rail-head">{row.label}</div>;
          if (row.kind === 'sub') {
            return (
              <div key={row.key} className="cp-rail-cell" style={{ height: 36, paddingLeft: 26 }} onClick={row.onClick}>
                <span style={{ width: 20, flexShrink: 0, textAlign: 'center', color: 'var(--edge)' }}>·</span>
                <span className="cp-rail-label" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{row.label}</span>
              </div>
            );
          }
          return (
            <div key={row.key} className="cp-rail-cell" data-active={row.active ? 'true' : 'false'} onClick={row.onClick} title={row.label}>
              <Icon name={row.icon!} size={20} />
              <span className="cp-rail-label">{row.label}</span>
              {row.collapsible && <Icon name="caret-down" size={12} style={{ marginLeft: 'auto', marginRight: 14, transform: row.expanded ? 'rotate(180deg)' : 'none', opacity: 0.6 }} />}
            </div>
          );
        })}
      </div>
      <div className="cp-rail-cell" data-active={settingsActive ? 'true' : 'false'} onClick={onOpenSettings} style={{ borderTop: '1px solid var(--edge)', flexShrink: 0 }} title="Settings">
        <Icon name="gear-six" size={20} />
        <span className="cp-rail-label">Settings</span>
      </div>
    </div>
  );
}
