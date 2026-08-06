import { BLOOM_OVERRIDE, NAV_DATA, SPOKES } from './data';
import { polar } from './state';
import type { AppState } from './state';
import type { Point } from './types';

export interface GroupBloomItem {
  key: string;
  label: string;
  isGroup: boolean;
  active: boolean;
  pos: Point;
  groupName?: string;
  itemId?: string;
}

export interface ItemBloomItem {
  id: string;
  label: string;
  icon: string;
  pos: Point;
}

export function computeGeometry(state: AppState, isMobile: boolean) {
  const circleScale = state.direction === 1 ? 0.85 : state.direction === 2 ? 1.2 : 1;
  const circleSize = Math.round((isMobile ? 48 : 56) * circleScale);
  const stageWidth = isMobile ? 390 : 1440;
  const stageHeight = isMobile ? 844 : 900;

  const angleStep = 360 / SPOKES.length;
  const spokeAngle: Record<string, number> = {};
  SPOKES.forEach((sp, i) => {
    spokeAngle[sp.type === 'group' ? sp.name : sp.id] = i * angleStep;
  });
  const r1 = (isMobile ? 85 : 130) * circleScale;
  const r2 = (isMobile ? 145 : 215) * circleScale;

  const level1Pts = SPOKES.map((sp) => polar(spokeAngle[sp.type === 'group' ? sp.name : sp.id], r1));

  let level2Pts: Point[] = [];
  let activeItems: { id: string; label: string; icon: string }[] = [];
  if (state.activeGroup) {
    const g = NAV_DATA.find((x) => x.group === state.activeGroup);
    if (g) {
      const items = (BLOOM_OVERRIDE[state.activeGroup]
        ? BLOOM_OVERRIDE[state.activeGroup].map((id) => g.items.find((it) => it.id === id))
        : g.items
      ).filter(Boolean) as { id: string; label: string; icon: string }[];
      activeItems = items;
      const centerAngle = spokeAngle[state.activeGroup];
      const spread = Math.min(70, items.length * 13);
      const start = centerAngle - spread / 2;
      level2Pts = items.map((_, i) =>
        polar(items.length === 1 ? centerAngle : start + (spread * i) / (items.length - 1), r2)
      );
    }
  }

  const allPts: Point[] = [{ x: 0, y: 0 }, ...level1Pts, ...level2Pts];
  const pad = 60;
  const minX = Math.min(...allPts.map((p) => p.x)) - pad;
  const maxX = Math.max(...allPts.map((p) => p.x)) + pad;
  const minY = Math.min(...allPts.map((p) => p.y)) - pad;
  const maxY = Math.max(...allPts.map((p) => p.y)) + pad;

  const groupBloomItems: GroupBloomItem[] = SPOKES.map((sp, i) => {
    const p = level1Pts[i];
    const key = sp.type === 'group' ? sp.name : sp.id;
    const active = state.activeGroup === key;
    return {
      key,
      label: sp.type === 'group' ? sp.name : sp.label,
      isGroup: sp.type === 'group',
      active,
      pos: { x: p.x - minX, y: p.y - minY },
      groupName: sp.type === 'group' ? sp.name : undefined,
      itemId: sp.type === 'item' ? sp.id : undefined,
    };
  });

  const itemBloomItems: ItemBloomItem[] = activeItems.map((it, i) => ({
    id: it.id,
    label: it.label,
    icon: it.icon,
    pos: { x: level2Pts[i].x - minX, y: level2Pts[i].y - minY },
  }));

  const boxLeft = minX;
  const boxTop = minY;
  const boxW = maxX - minX;
  const boxH = maxY - minY;

  const margin = r2 + 40;
  const cx = Math.min(Math.max(state.circlePos.x, margin), stageWidth - margin);
  const cy = Math.min(Math.max(state.circlePos.y, margin), stageHeight - margin);

  return {
    circleScale,
    circleSize,
    stageWidth,
    stageHeight,
    r1,
    r2,
    groupBloomItems,
    itemBloomItems,
    boxLeft,
    boxTop,
    boxW,
    boxH,
    cx,
    cy,
  };
}
