import Icon from '../Icon';

export const MOBILE_HEADER_HEIGHT = 68;

interface Props {
  onOpenMenu: () => void;
}

/** Mobile's sticky top bar (03 — App Overview, mobile): a hamburger circle
 *  that opens MobileMenuSheet, and the brand mark. Replaces the old
 *  floating Logo (top-left) + hamburger (top-right) pair, which floated
 *  independently over content rather than sitting in flow. */
export default function MobileHeader({ onOpenMenu }: Props) {
  return (
    <div
      style={{
        // Height grows by the safe-area inset rather than padding within a
        // fixed height — otherwise a large inset (Dynamic Island devices)
        // would squeeze the 44px hamburger circle into whatever's left.
        position: 'absolute', top: 0, left: 0, right: 0, height: `calc(${MOBILE_HEADER_HEIGHT}px + env(safe-area-inset-top))`, zIndex: 29,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: `0 18px ${(MOBILE_HEADER_HEIGHT - 44) / 2}px`,
        background: 'var(--mm-bg-blur)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--mm-line)',
      }}
    >
      <div onClick={onOpenMenu} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', cursor: 'pointer' }}>
        <Icon name="list" size={20} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Masterminds</div>
          <div style={{ fontSize: 7, letterSpacing: '0.32em', color: 'var(--mm-faint)', textTransform: 'uppercase' }}>by marq</div>
        </div>
        <img src="/marq-wordmark.png" alt="MARQ" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'var(--mm-logo-filter)', mixBlendMode: 'var(--mm-logo-blend)' as React.CSSProperties['mixBlendMode'] }} />
      </div>
    </div>
  );
}
