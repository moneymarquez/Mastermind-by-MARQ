import Icon from '../Icon';

export const HEADER_HEIGHT = 68;

interface Props {
  left: number;
  screenLabel: string;
  activeModuleCount: number;
  onOpenTour: () => void;
  onOpenNotifications: () => void;
}

const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

/** The desktop persistent header from the same "App Overview" artboard as
 *  Sidebar.tsx: breadcrumb + a real "N modules active" pill (not the
 *  reference's invented "11 streams live" — this counts whatever
 *  canAccess() actually returns) on the left, tour + bell + brand mark on
 *  the right. `left` matches whatever offset the sidebar currently
 *  occupies, so this never overlaps it.
 *
 *  No theme toggle here — dark/light is a Settings-only control
 *  (AccountSettingsScreen), not duplicated in every surface that happens
 *  to have room for one. */
export default function TopHeader({ left, screenLabel, activeModuleCount, onOpenTour, onOpenNotifications }: Props) {
  return (
    <div
      style={{
        position: 'absolute', top: 0, left, right: 0, height: HEADER_HEIGHT, zIndex: 29,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px',
        background: 'var(--mm-bg-blur)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--mm-line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--mm-faint)' }}>
        <span style={{ color: 'var(--mm-text)', fontWeight: 500 }}>{screenLabel}</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span>{dateLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--mm-line)', fontSize: 11.5 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mm-text)' }} />
          {activeModuleCount} module{activeModuleCount === 1 ? '' : 's'} active
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div title="Take the product tour" onClick={onOpenTour} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--mm-faint)', width: 18, textAlign: 'center' }}>?</div>
        <div onClick={onOpenNotifications} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="bell" size={18} color="var(--mm-faint)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 14, borderLeft: '1px solid var(--mm-line)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, textAlign: 'right' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.02em' }}>Masterminds</div>
            <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'var(--mm-faint)', textTransform: 'uppercase' }}>by marq</div>
          </div>
          <img src="/marq-wordmark.png" alt="MARQ" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'var(--mm-logo-filter)', mixBlendMode: 'var(--mm-logo-blend)' as React.CSSProperties['mixBlendMode'] }} />
        </div>
      </div>
    </div>
  );
}
