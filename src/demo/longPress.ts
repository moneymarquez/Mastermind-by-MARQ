import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { startDemo, isDemo } from './state';

// One timer for the whole app: only one logo can be held at a time, and a
// re-render mid-hold must still be able to cancel it.
let timer: ReturnType<typeof setTimeout> | null = null;
const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

/** Spec §1: hold the logo for 3 seconds to start the demo — the quiet way
 *  in when showing the app to someone on your own phone. */
export const demoLongPress = {
  onPointerDown: (e: ReactPointerEvent) => {
    if (e.button !== 0 || isDemo()) return;
    cancel();
    timer = setTimeout(() => { timer = null; try { navigator.vibrate?.(15); } catch { /* unsupported */ } startDemo(); }, 3000);
  },
  onPointerUp: cancel,
  onPointerLeave: cancel,
  onPointerCancel: cancel,
  onContextMenu: (e: ReactMouseEvent) => { if (timer) e.preventDefault(); },
};
