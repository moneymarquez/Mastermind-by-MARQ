import type { CSSProperties, ReactNode } from 'react';

/** The redesign's line icons (design handoff: inline SVG, 1.8px stroke,
 *  round caps — taken from the shell's own artboards so they match
 *  exactly). */
type P = { size?: number; color?: string; style?: CSSProperties; fill?: boolean };
const svg = (children: ReactNode, { size = 18, color = 'currentColor', style }: P, opts: { stroke?: number; filled?: boolean } = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={opts.filled ? color : 'none'} stroke={opts.filled ? 'none' : color} strokeWidth={opts.stroke ?? 1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', display: 'block', ...style }} aria-hidden="true">{children}</svg>
);

export const GHome = (p: P) => svg(<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />, p);
export const GInbox = (p: P) => svg(<><path d="M3 13h5l1.5 3h5l1.5-3h5" /><path d="M5.5 5h13L21 13v6H3v-6z" /></>, p);
export const GNova = (p: P) => svg(<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" />, p, { filled: p.fill });
export const GGrid = (p: P) => svg(<><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>, p);
export const GSun = (p: P) => svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>, p);
export const GMoon = (p: P) => svg(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, p);
export const GSearch = (p: P) => svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, p);
export const GBell = (p: P) => svg(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>, p);
export const GBolt = (p: P) => svg(<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />, p);
export const GChevron = (p: P) => svg(<path d="m9 6 6 6-6 6" />, p, { stroke: 2.2 });
export const GChevronLeft = (p: P) => svg(<path d="m15 6-6 6 6 6" />, p, { stroke: 2.2 });
export const GUpDown = (p: P) => svg(<><path d="m7 9 5-5 5 5" /><path d="m7 15 5 5 5-5" /></>, p, { stroke: 2 });
export const GSliders = (p: P) => svg(<><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>, p);
export const GPlus = (p: P) => svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>, p, { stroke: 2.4 });
export const GClose = (p: P) => svg(<path d="M6 6l12 12M18 6 6 18" />, p, { stroke: 2 });
export const GArrowUp = (p: P) => svg(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>, p, { stroke: 2.2 });
export const GLock = (p: P) => svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, p);
export const GCheck = (p: P) => svg(<path d="m5 12.5 4.5 4.5L19 7.5" />, p, { stroke: 2.2 });
export const GMic = (p: P) => svg(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>, p);
export const GMenu = (p: P) => svg(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" /></>, p);
