import Icon from '../Icon';

// Content-zone height only — the safe-area inset is added on top of this
// (not carved out of it) by the calc() in the component's own height
// below, same pattern as MobileHeader.tsx's height. Every other consumer
// of this constant (Stage.tsx's content bottom-padding, RemindersBox's
// offset) independently appends env(safe-area-inset-bottom) in its own
// calc(), so nothing double-counts it.
//
// Sized explicitly for its actual content stack — 22px icon + 4px gap +
// a label whose line-height needs headroom beyond its 9.5px font-size —
// plus 12px top/bottom padding each. Bumped from 78 (14+22+4+~12+14 was
// tight enough that a label could visually clip on devices that round
// the safe-area inset up) to a value with real breathing room.
export const TAB_BAR_HEIGHT = 84;

// A bare env(safe-area-inset-bottom) is 0 on any context that doesn't
// report a real inset (most non-Safari mobile browsers, some in-app
// webviews) — on a phone with a home-indicator gesture bar, that leaves
// the tab bar's labels sitting right at the physical bottom edge with
// only the 12px base padding between them and it, which reads as cut
// off. Flooring it at 20px guarantees real clearance everywhere while
// still using the actual (larger) inset on devices that report one.
export const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 20px)';

interface Props {
  screen: string;
  novaOpen: boolean;
  onNavigate: (screen: string) => void;
  onToggleNova: () => void;
}

const items = [
  { screen: 'home', label: 'Home', icon: 'house' },
  { screen: 'macros', label: 'Macros', icon: 'fork-knife' },
] as const;
const itemsRight = [
  { screen: 'dialing', label: 'Dial', icon: 'phone-call' },
  { screen: 'budgeting', label: 'Money', icon: 'wallet' },
] as const;

/** Mobile's fixed bottom tab bar — the reference's replacement for this
 *  app's old free-floating, drag-to-reposition Nova circle: Home / Macros
 *  / Nova (raised center FAB) / Dial / Money. Nova stays a toggle (open
 *  the existing NovaPanel) rather than a navigation target — the FAB
 *  itself isn't a screen. */
export default function MobileTabBar({ screen, novaOpen, onNavigate, onToggleNova }: Props) {
  const tab = (item: { screen: string; label: string; icon: string }) => {
    const active = screen === item.screen;
    return (
      <div
        key={item.screen}
        onClick={() => onNavigate(item.screen)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 52, color: active ? 'var(--mm-text)' : 'var(--mm-faint)', cursor: 'pointer' }}
      >
        <Icon name={item.icon} size={22} />
        <div style={{ fontSize: 9.5, lineHeight: 1.3, letterSpacing: '0.06em' }}>{item.label}</div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, boxSizing: 'border-box',
        height: `calc(${TAB_BAR_HEIGHT}px + ${SAFE_BOTTOM})`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `12px 22px calc(12px + ${SAFE_BOTTOM})`,
        borderTop: '1px solid var(--mm-line)', background: 'var(--mm-bg-blur)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      {items.map(tab)}
      <div
        onClick={onToggleNova}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: '50%', marginTop: -18,
          background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', cursor: 'pointer',
          outline: novaOpen ? '2px solid var(--mm-line-strong)' : 'none', outlineOffset: 2,
        }}
      >
        <Icon name="sparkle" size={24} />
      </div>
      {itemsRight.map(tab)}
    </div>
  );
}
