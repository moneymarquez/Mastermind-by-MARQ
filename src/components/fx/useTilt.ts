import { useCallback } from 'react';
import type { PointerEvent } from 'react';
import { getSkin } from '../../data/useTheme';
import { prefersReducedMotion } from '../../lib/motion';

/** Cards tilt slightly toward the touch point (Cyberpunk only).
 *
 *  Returns handlers to spread onto the card; the element also needs the
 *  fx-tilt class, which paints --tilt-x/--tilt-y. ±4° max — enough to feel
 *  physical, not enough to move text out from under a thumb. */
export function useTilt(maxDeg = 4) {
  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (getSkin() !== 'cyberpunk' || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--tilt-y', `${(px * maxDeg * 2).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--tilt-x', `${(-py * maxDeg * 2).toFixed(2)}deg`);
  }, [maxDeg]);
  const onPointerLeave = useCallback((e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty('--tilt-x', '0deg');
    e.currentTarget.style.setProperty('--tilt-y', '0deg');
  }, []);
  return { className: 'fx-tilt', onPointerMove, onPointerLeave, onPointerUp: onPointerLeave, onPointerCancel: onPointerLeave };
}
