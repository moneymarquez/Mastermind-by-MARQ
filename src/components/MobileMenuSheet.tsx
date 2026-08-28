import type { NavRow } from '../navRows';
import Icon from '../Icon';
import { LIVE_PLAN } from '../billing/plans';
import type { Theme } from '../data/useTheme';

interface Props {
  open: boolean;
  rows: NavRow[];
  ownerName: string | null;
  isOwner: boolean;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenTour: () => void;
}

/** Mobile's nav surface — the "02 — Menu sheet" artboard: a scrim, a
 *  bottom sheet with a drag handle, a Menu/theme-toggle header, the same
 *  real NavRow[] Sidebar.tsx renders on desktop, and an account footer.
 *  Replaces the old top-right dropdown NavDrawer/floating Logo, both
 *  deleted — Sidebar.tsx covers desktop, this covers mobile, and nothing
 *  else referenced either component. */
export default function MobileMenuSheet({ open, rows, ownerName, isOwner, theme, onThemeChange, onClose, onOpenSettings, onOpenTour }: Props) {
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 48, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 49, maxHeight: '82%',
          borderRadius: '28px 28px 0 0', background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.4)', padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 14, animation: 'drawerIn 0.16s ease',
        }}
      >
        <div style={{ width: 44, height: 4, borderRadius: 4, background: 'var(--border-2)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>Menu</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div title="Take the product tour" onClick={() => { onOpenTour(); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-2)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>?</div>
            <div
              onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', fontSize: 12.5, color: 'var(--text-secondary)' }}
            >
              <Icon name={theme === 'light' ? 'sun' : 'moon'} size={15} />{theme === 'light' ? 'Light' : 'Dark'}
            </div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((row) => {
            if (row.kind === 'header') {
              return (
                <div key={row.key} style={{ padding: '8px 4px 6px', fontSize: 9.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === 'sub') {
              return (
                <div key={row.key} style={{ padding: '10px 4px 10px 38px', fontSize: 14, color: 'var(--text-secondary)', cursor: row.onClick ? 'pointer' : 'default' }} onClick={() => { row.onClick?.(); onClose(); }}>
                  {row.label}
                </div>
              );
            }
            return (
              <div
                key={row.key}
                onClick={() => { row.onClick?.(); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, height: 46, padding: '0 12px', borderRadius: 14, cursor: 'pointer',
                  background: row.active ? 'var(--surface-3)' : 'transparent', fontSize: 15, fontWeight: row.active ? 500 : 400,
                  color: row.active ? 'var(--text)' : 'var(--text-secondary)',
                }}
              >
                <Icon name={row.icon!} size={19} />
                {row.label}
                {row.collapsible && (
                  <Icon name="caret-down" size={12} color="var(--text-tertiary)" style={{ marginLeft: 'auto', transform: row.expanded ? 'rotate(180deg)' : 'none' }} />
                )}
              </div>
            );
          })}
        </div>

        <div
          onClick={() => { onOpenSettings(); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 16, background: 'var(--surface-3)', cursor: 'pointer' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-4)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName ?? 'Account'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{isOwner ? 'Owner' : `${LIVE_PLAN.name} plan`}</div>
          </div>
          <Icon name="gear-six" size={18} color="var(--text-tertiary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
    </>
  );
}
