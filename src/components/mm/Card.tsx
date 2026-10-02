import type { CSSProperties, ReactNode } from 'react';

/** Card (design handoff: MM Card). Title + meta header; `flush` for row
 *  lists that run to the edges. 16px radius, 18px padding (20 wide). */
export default function Card({ title, meta, flush, wide, hero, children, style, action }: { title?: ReactNode; meta?: ReactNode; flush?: boolean; wide?: boolean; hero?: boolean; children?: ReactNode; style?: CSSProperties; action?: ReactNode }) {
  const pad = wide ? 20 : 18;
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: flush ? `${pad}px ${pad}px 4px` : pad, boxShadow: hero ? 'var(--card-shadow)' : undefined, display: 'flex', flexDirection: 'column', gap: flush ? 4 : 14, minWidth: 0, boxSizing: 'border-box', ...style }}>
      {(title || meta || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{title}</span>
          {action ?? <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, textAlign: 'right' }}>{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
