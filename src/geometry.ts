import type { AppState } from './state';

// Compact-core sizing (was "Direction 1" in the design tool's A/B variants
// — the one actually shipped) is now the only option, not a switchable one.
const CIRCLE_SCALE = 0.85;

export function computeGeometry(state: AppState, isMobile: boolean) {
  const circleSize = Math.round((isMobile ? 48 : 56) * CIRCLE_SCALE);
  const stageWidth = isMobile ? 390 : 1440;
  const stageHeight = isMobile ? 844 : 900;

  const margin = circleSize / 2 + 16;
  const cx = Math.min(Math.max(state.circlePos.x, margin), stageWidth - margin);
  const cy = Math.min(Math.max(state.circlePos.y, margin), stageHeight - margin);

  return {
    circleSize,
    stageWidth,
    stageHeight,
    cx,
    cy,
  };
}
