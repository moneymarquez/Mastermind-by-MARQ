import type { CSSProperties } from 'react';
import { computeGeometry } from './geometry';
import { buildNavRows } from './navRows';
import { SIDEBAR_WIDTH } from './components/Sidebar';
import { HEADER_HEIGHT } from './components/TopHeader';
import { MOBILE_HEADER_HEIGHT } from './components/MobileHeader';
import { TAB_BAR_HEIGHT } from './components/MobileTabBar';
import type { AppState } from './state';

export function buildViewModel(
  state: AppState,
  navigateTo: (id: string) => void,
  onSignOut: () => void,
  canAccess: (moduleKey: string) => boolean,
  isOwner: boolean,
  navOrder: Record<string, number> = {}
) {
  const s = state;
  const isMobile = s.isMobile;
  const geo = computeGeometry(s, isMobile);
  const { circleSize, stageWidth, stageHeight, cx, cy } = geo;

  const navRows = buildNavRows(s.screen, s.settingsExpanded, navigateTo, onSignOut, canAccess, isOwner, navOrder);

  // Both mobile and desktop now have real, in-flow chrome (MobileHeader +
  // MobileTabBar, or Sidebar + TopHeader) fixed to the stage rather than
  // floating over content — content is offset by their actual
  // width/height instead of a hand-tuned magic-number gap tied to the old
  // floating logo/hamburger/circle.
  const contentStyle: CSSProperties = {
    position: 'absolute', top: 0, left: isMobile ? 0 : SIDEBAR_WIDTH, right: 0, bottom: 0,
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    WebkitOverflowScrolling: 'touch',
    padding: isMobile
      ? `calc(${MOBILE_HEADER_HEIGHT + 16}px + env(safe-area-inset-top)) 20px calc(${TAB_BAR_HEIGHT + 24}px + env(safe-area-inset-bottom))`
      : `${HEADER_HEIGHT + 32}px 32px 48px`,
  };

  const homeHeadStyle: CSSProperties = { fontSize: isMobile ? 24 : 32, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' };
  const homeSubStyle: CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 };

  return {
    isMobile, geo,
    navRows,
    contentStyle,
    homeHeadStyle, homeSubStyle,
    stageWidth, stageHeight, circleSize,
    cx, cy,
    sidebarWidth: SIDEBAR_WIDTH, headerHeight: HEADER_HEIGHT,
    mobileHeaderHeight: MOBILE_HEADER_HEIGHT, tabBarHeight: TAB_BAR_HEIGHT,
  };
}
