import Icon from '../Icon';
import type { Theme } from '../data/useTheme';

export const HEADER_HEIGHT = 68;

interface Props {
  left: number;
  screenLabel: string;
  activeModuleCount: number;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  onOpenTour: () => void;
  onOpenNotifications: () => void;
}

const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** The desktop persistent header from the same "App Overview" artboard as
 *  Sidebar.tsx: breadcrumb + a real "N modules active" pill (not the
 *  reference's invented "11 streams live" — this counts whatever
 *  canAccess() actually returns) on the left, theme toggle + tour + bell +
 *  brand mark on the right. `left` matches whatever offset the sidebar
 *  currently occupies, so this never overlaps it. */
export default function TopHeader({ left, screenLabel, activeModuleCount, theme, onThemeChange, onOpenTour, onOpenNotifications }: Props) {
  return (
    <div
      style={{
        position: 'absolute', top: 0, left, right: 0, height: HEADER_HEIGHT, zIndex: 29,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px',
        background: 'color-mix(in srgb, var(--bg) 85%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{screenLabel}</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span>{dateLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', fontSize: 11.5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text)' }} />
          {activeModuleCount} module{activeModuleCount === 1 ? '' : 's'} active
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={15} />{theme === 'light' ? 'Light' : 'Dark'}
        </div>
        <div title="Take the product tour" onClick={onOpenTour} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', width: 18, textAlign: 'center' }}>?</div>
        <div onClick={onOpenNotifications} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="bell" size={18} color="var(--text-tertiary)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 14, borderLeft: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, textAlign: 'right' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.02em' }}>Masterminds</div>
            <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>by marq</div>
          </div>
          <img src="/icons/icon-192.png" alt="MARQ" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
        </div>
      </div>
    </div>
  );
}
