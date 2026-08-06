import type { AppState } from './state';

export function computeGeometry(state: AppState, isMobile: boolean) {
  const circleScale = state.direction === 1 ? 0.85 : state.direction === 2 ? 1.2 : 1;
  const circleSize = Math.round((isMobile ? 48 : 56) * circleScale);
  const stageWidth = isMobile ? 390 : 1440;
  const stageHeight = isMobile ? 844 : 900;

  const margin = circleSize / 2 + 16;
  const cx = Math.min(Math.max(state.circlePos.x, margin), stageWidth - margin);
  const cy = Math.min(Math.max(state.circlePos.y, margin), stageHeight - margin);

  return {
    circleScale,
    circleSize,
    stageWidth,
    stageHeight,
    cx,
    cy,
  };
}
