import type { CSSProperties } from 'react';
import { computeGeometry } from './geometry';
import { buildNavRows } from './navRows';
import { SIDEBAR_WIDTH } from './components/Sidebar';
import { HEADER_HEIGHT } from './components/TopHeader';
import type { AppState } from './state';

export function buildViewModel(
  state: AppState,
  navigateTo: (id: string) => void,
  onSignOut: () => void,
  canAccess: (moduleKey: string) => boolean
) {
  const s = state;
  const isMobile = s.isMobile;
  const geo = computeGeometry(s, isMobile);
  const { circleSize, stageWidth, stageHeight, cx, cy } = geo;

  const navRows = buildNavRows(s.screen, s.settingsExpanded, navigateTo, onSignOut, canAccess);

  // Mobile keeps the old floating logo/hamburger clearance math untouched.
  // Desktop now has real, in-flow chrome (Sidebar + TopHeader, both fixed
  // to the stage rather than floating over content) — content is offset
  // by their actual width/height instead of a hand-tuned magic-number gap.
  const contentStyle: CSSProperties = {
    position: 'absolute', top: 0, left: isMobile ? 0 : SIDEBAR_WIDTH, right: 0, bottom: 0,
    overflowY: 'auto',
    padding: isMobile
      ? `calc(${circleSize + 64}px + env(safe-area-inset-top)) 20px 140px`
      : `${HEADER_HEIGHT + 32}px 32px 48px`,
  };

  const homeHeadStyle: CSSProperties = { fontSize: isMobile ? 24 : 32, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' };
  const homeSubStyle: CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 };

  const statDefs = [
    { icon: 'ph-phone-call', value: '0 / 100', caption: "Today's call goal" },
    { icon: 'ph-heart', value: '128 days', caption: 'Sobriety streak' },
    { icon: 'ph-barbell', value: '0', caption: 'Workouts this week' },
    { icon: 'ph-fork-knife', value: '1,840 kcal', caption: "Today's macros" },
    { icon: 'ph-users-three', value: '0', caption: 'Leads in pipeline' },
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
      color: 'var(--text)',
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
    isMobile, geo,
    navRows,
    contentStyle,
    homeHeadStyle, homeSubStyle,
    statCards, statGridStyle,
    stageWidth, stageHeight, circleSize,
    cx, cy,
    sidebarWidth: SIDEBAR_WIDTH, headerHeight: HEADER_HEIGHT,
  };
}
