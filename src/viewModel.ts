import type { CSSProperties } from 'react';
import { computeGeometry } from './geometry';
import { buildNavRows } from './navRows';
import { PHONE_HEADER_H, PHONE_TAB_H, TOP_BAR_H } from './components/shell/Shell';
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

  // Positioning only; Stage sets the shell's left/right/padding.
  const contentStyle: CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflowY: 'auto', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch',
  };

  // The handoff's page title and subtitle.
  const homeHeadStyle: CSSProperties = { fontSize: isMobile ? 24 : 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.035em', lineHeight: 1.2 };
  const homeSubStyle: CSSProperties = { fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4 };

  return {
    isMobile, geo,
    navRows,
    contentStyle,
    homeHeadStyle, homeSubStyle,
    stageWidth, stageHeight, circleSize,
    cx, cy,
    headerHeight: TOP_BAR_H,
    mobileHeaderHeight: PHONE_HEADER_H, tabBarHeight: PHONE_TAB_H,
  };
}
