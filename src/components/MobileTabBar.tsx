import Icon from '../Icon';

// Content-zone height only — the safe-area inset is added on top of this
// (not carved out of it) by the calc() in the component's own height
// below, same pattern as MobileHeader.tsx's height. Every other consumer
// of this constant (Stage.tsx's content bottom-padding, RemindersBox's
// offset) independently appends env(safe-area-inset-bottom) in its own
// calc(), so nothing double-counts it.
export const TAB_BAR_HEIGHT = 78;

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
        <div style={{ fontSize: 9.5, letterSpacing: '0.06em' }}>{item.label}</div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 22px calc(10px + env(safe-area-inset-bottom))',
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
