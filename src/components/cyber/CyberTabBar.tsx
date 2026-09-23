import { useState } from 'react';
import Icon from '../../Icon';
import { TAB_BAR_HEIGHT, SAFE_BOTTOM } from '../MobileTabBar';

interface Props {
  screen: string;
  novaOpen: boolean;
  onNavigate: (screen: string) => void;
  onToggleNova: () => void;
}

const LEFT = [
  { screen: 'home', label: 'Home', icon: 'house' },
  { screen: 'macros', label: 'Macros', icon: 'fork-knife' },
] as const;
const RIGHT = [
  { screen: 'dialing', label: 'Dial', icon: 'phone-call' },
  { screen: 'budgeting', label: 'Money', icon: 'wallet' },
] as const;

/** Mobile bottom bar, Cyberpunk: every tab is a full-height cell. The
 *  whole cell is the target and the whole cell lights — cyan fill at 12%,
 *  a 2px cyan bar across its top edge, icon and label at full cyan. Press
 *  bumps the fill to 22% for 120ms. Nova stays the centre action. */
export default function CyberTabBar({ screen, novaOpen, onNavigate, onToggleNova }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);
  const press = (key: string) => { setPressed(key); window.setTimeout(() => setPressed((p) => (p === key ? null : p)), 120); };
  const cell = (item: { screen: string; label: string; icon: string }) => (
    <div
      key={item.screen}
      className={`cp-tab${pressed === item.screen ? ' cp-pressed' : ''}`}
      data-active={screen === item.screen ? 'true' : 'false'}
      onPointerDown={() => press(item.screen)}
      onClick={() => onNavigate(item.screen)}
    >
      <Icon name={item.icon} size={22} />
      <span className="cp-tab-label">{item.label}</span>
    </div>
  );
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30, boxSizing: 'border-box',
        height: `calc(${TAB_BAR_HEIGHT}px + ${SAFE_BOTTOM})`, paddingBottom: SAFE_BOTTOM,
        display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderTop: '1px solid var(--cyan-40)',
      }}
    >
      {LEFT.map(cell)}
      <div className="cp-tab cp-tab--fab" onClick={onToggleNova} onPointerDown={() => press('nova')}>
        <div className="cp-fab" data-open={novaOpen ? 'true' : 'false'}><Icon name="sparkle" size={22} /></div>
      </div>
      {RIGHT.map(cell)}
    </div>
  );
}
