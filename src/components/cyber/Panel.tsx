import type { CSSProperties, ReactNode } from 'react';

/** The clipped panel — this theme's primary container. Top-right and
 *  bottom-left corners cut at 45°; the cut size carries hierarchy:
 *  hero 20px, standard 14px, chip 8px. */
export default function Panel({ cut = 'standard', lift, edge, style, className, children, onClick }: {
  cut?: 'hero' | 'standard' | 'chip';
  lift?: boolean;
  edge?: 'cyan' | 'green';
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const cls = ['cp-panel', cut === 'hero' ? 'cp-panel--hero' : cut === 'chip' ? 'cp-panel--chip' : '', lift ? 'cp-panel--lift' : '', edge ? `cp-panel--edge-${edge}` : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={cls} style={style} onClick={onClick}>{children}</div>;
}

/** Full-bleed strip with a 2px accent edge on top: status and actions. */
export function Rail({ accent = 'cyan', style, children }: { accent?: 'cyan' | 'green' | 'amber' | 'magenta'; style?: CSSProperties; children: ReactNode }) {
  return <div className="cp-rail" style={{ '--cp-rail-accent': `var(--${accent})`, ...style } as CSSProperties}>{children}</div>;
}
