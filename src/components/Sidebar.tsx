import type { NavRow } from '../navRows';
import Icon from '../Icon';
import { LIVE_PLAN } from '../billing/plans';

export const SIDEBAR_WIDTH = 250;

interface Props {
  rows: NavRow[];
  ownerName: string | null;
  isOwner: boolean;
  onOpenSettings: () => void;
}

/** The desktop persistent sidebar from the Aperture "App Overview" artboard
 *  (03 — App Overview): Menu label, search glyph, the full real nav list
 *  (same NavRow[] the old floating drawer used — buildNavRows already
 *  produces exactly this shape, nothing new to compute), and an account
 *  footer. Desktop only — mobile keeps the existing hamburger/NavDrawer
 *  overlay, since the reference's own mobile treatment is a bottom bar +
 *  sheet, a different component not built yet. */
export default function Sidebar({ rows, ownerName, isOwner, onOpenSettings }: Props) {
  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH, zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: 14, padding: '22px 14px',
        background: 'var(--surface-2)', borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500 }}>
          <Icon name="list" size={18} />Menu
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13.5 }}>
        {rows.map((row) => {
          if (row.kind === 'header') {
            return (
              <div key={row.key} style={{ padding: '14px 10px 6px', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                {row.label}
              </div>
            );
          }
          if (row.kind === 'sub') {
            return (
              <div key={row.key} style={{ padding: '7px 10px 7px 38px', cursor: row.onClick ? 'pointer' : 'default', color: 'var(--text-secondary)' }} onClick={row.onClick}>
                {row.label}
              </div>
            );
          }
          return (
            <div
              key={row.key}
              className="nav-row"
              onClick={row.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: row.active ? 'var(--surface)' : 'transparent', border: row.active ? '1px solid var(--border)' : '1px solid transparent',
                fontWeight: row.active ? 600 : 400, color: row.active ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              <Icon name={row.icon!} size={17} />
              {row.label}
              {row.collapsible && (
                <Icon name="caret-down" size={12} color="var(--text-tertiary)" style={{ marginLeft: 'auto', transform: row.expanded ? 'rotate(180deg)' : 'none' }} />
              )}
            </div>
          );
        })}
      </div>

      <div
        onClick={onOpenSettings}
        style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
      >
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-4)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName ?? 'Account'}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{isOwner ? 'Owner' : `${LIVE_PLAN.name} plan`}</div>
        </div>
        <Icon name="gear-six" size={16} color="var(--text-tertiary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
    </div>
  );
}
