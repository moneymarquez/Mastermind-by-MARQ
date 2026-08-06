import type { CSSProperties } from 'react';
import { computeGeometry } from './geometry';
import { buildNavRows } from './navRows';
import type { AppState } from './state';

export function buildViewModel(state: AppState, navigateTo: (id: string) => void, onSignOut: () => void) {
  const s = state;
  const dir = s.direction;
  const isMobile = s.device === 'mobile';
  const geo = computeGeometry(s, isMobile);
  const { circleSize, stageWidth, stageHeight, cx, cy } = geo;

  const navRows = buildNavRows(s.screen, s.settingsExpanded, navigateTo, onSignOut);

  const contentStyle: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflowY: 'auto',
    padding: isMobile ? `${circleSize + 36}px 20px 140px` : `100px 40px 60px ${circleSize + 64}px`,
  };

  const homeHeadStyle: CSSProperties = { fontSize: isMobile ? 24 : 32, fontWeight: 600, color: '#F5F6F7', letterSpacing: '-0.01em' };
  const homeSubStyle: CSSProperties = { fontSize: 14, color: '#8A8F98', marginTop: 6 };

  const statDefs = [
    { icon: 'ph-phone-call', value: `${s.dialCount} / ${s.dialGoal}`, caption: "Today's call goal" },
    { icon: 'ph-heart', value: '128 days', caption: 'Sobriety streak' },
    { icon: 'ph-fork-knife', value: '1,840 kcal', caption: "Today's macros" },
    { icon: 'ph-calendar-blank', value: '2:30 PM', caption: 'Next on schedule' },
  ];
  const statCards = statDefs.map((d) => ({
    icon: d.icon,
    value: d.value,
    caption: d.caption,
    valueStyle: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: d.value.length > 10 ? 20 : 26,
      fontWeight: 600,
      color: '#F5F6F7',
      marginTop: 8,
    } as CSSProperties,
  }));
  const statGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginTop: 28,
  };

  return {
    isMobile, dir, geo,
    navRows,
    contentStyle,
    homeHeadStyle, homeSubStyle,
    statCards, statGridStyle,
    stageWidth, stageHeight, circleSize,
    cx, cy,
  };
}
