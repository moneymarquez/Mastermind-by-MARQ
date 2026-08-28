import type { AppState } from './state';
import { SIDEBAR_WIDTH } from './components/Sidebar';

// Compact-core sizing (was "Direction 1" in the design tool's A/B variants
// — the one actually shipped) is now the only option, not a switchable one.
const CIRCLE_SCALE = 0.85;

export function computeGeometry(state: AppState, isMobile: boolean) {
  const circleSize = Math.round((isMobile ? 48 : 56) * CIRCLE_SCALE);
  const stageWidth = state.viewportWidth;
  const stageHeight = state.viewportHeight;

  const margin = circleSize / 2 + 16;
  // Desktop's persistent sidebar (Sidebar.tsx) sits at the left edge now —
  // without this, the floating Nova circle could still be dragged under it
  // (cx's lower clamp bound didn't know the sidebar existed).
  const leftBound = isMobile ? margin : SIDEBAR_WIDTH + margin;
  const cx = Math.min(Math.max(state.circlePos.x, leftBound), stageWidth - margin);
  const cy = Math.min(Math.max(state.circlePos.y, margin), stageHeight - margin);

  return {
    circleSize,
    stageWidth,
    stageHeight,
    cx,
    cy,
  };
}
