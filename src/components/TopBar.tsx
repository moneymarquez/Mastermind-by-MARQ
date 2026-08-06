import type { CSSProperties } from 'react';
import type { Device, Screen } from '../types';

interface Props {
  direction: 1 | 2 | 3;
  device: Device;
  screen: Screen;
  onDirection: (d: 1 | 2 | 3) => void;
  onDevice: (d: Device) => void;
  onScreen: (id: Screen) => void;
  caption: string;
}

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  background: active ? '#0A0B0D' : 'transparent',
  color: active ? '#fff' : '#565b64',
});

const SCREEN_TABS: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'dialing', label: 'Dialing' },
];

export default function TopBar({ direction, device, screen, onDirection, onDevice, onScreen, caption }: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 24, padding: '12px 24px',
          background: '#ffffff', borderBottom: '1px solid #dcdee1', position: 'sticky', top: 0, zIndex: 500,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: '#14161A', letterSpacing: '0.02em' }}>
          MARQUEZ MASTERMIND — prototype
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={tabStyle(direction === n)} onClick={() => onDirection(n as 1 | 2 | 3)}>
              Direction {n}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['desktop', 'mobile'] as Device[]).map((d) => (
            <div key={d} style={tabStyle(device === d)} onClick={() => onDevice(d)}>
              {d[0].toUpperCase() + d.slice(1)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SCREEN_TABS.map((t) => (
            <div key={t.id} style={tabStyle(screen === t.id)} onClick={() => onScreen(t.id)}>
              {t.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12.5, color: '#6b7180', padding: '14px 20px 0' }}>{caption}</div>
    </>
  );
}
