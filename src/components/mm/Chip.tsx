import type { ReactNode } from 'react';

/** Status chip (design handoff: MM Chip). Always icon + word, never
 *  colour alone. Tinted background = the colour at 14%. */
export type ChipKind = 'good' | 'warn' | 'bad' | 'neutral' | 'accent' | 'client' | 'live' | 'lock' | 'hot' | 'warm' | 'cold';
const COL: Partial<Record<ChipKind, string>> = { good: 'var(--success)', warn: 'var(--warning)', bad: 'var(--danger)', accent: 'var(--accent)', client: 'var(--client-accent)', live: 'var(--success)', hot: 'var(--warning)', warm: 'var(--accent)' };
const I = (d: ReactNode, w = 2.4, size = 12) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

export default function Chip({ k = 'neutral', children, title }: { k?: ChipKind; children: ReactNode; title?: string }) {
  const col = COL[k];
  const icon =
    k === 'good' ? I(<path d="M5 12.5l4.5 4.5L19 7.5" />, 2.6)
    : k === 'warn' ? I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
    : k === 'bad' ? I(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.5h.01" /></>)
    : k === 'hot' ? I(<path d="M12 21c-4 0-7-2.7-7-6.5 0-3.2 2.3-5.2 3.6-7.6.4 1.6 1.3 2.7 2.4 3.3C11 7 12.5 4.6 15 3c-.3 3 1.2 4.6 2.4 6.3 1 1.4 1.6 3 1.6 5.2C19 18.3 16 21 12 21z" />, 2.3)
    : k === 'warm' ? I(<><path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z" /><path d="M12 15v-4" /></>, 2.3)
    : k === 'cold' ? I(<><path d="M12 3v18" /><path d="M4.2 7.5l15.6 9" /><path d="M19.8 7.5l-15.6 9" /><path d="M9.5 4.5 12 6l2.5-1.5" /><path d="M9.5 19.5 12 18l2.5 1.5" /></>, 2.2)
    : k === 'lock' ? I(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, 2.4, 11)
    : <span style={{ width: 6, height: 6, borderRadius: '50%', background: k === 'neutral' ? 'transparent' : col, border: `1.5px solid ${k === 'neutral' ? 'var(--text-tertiary)' : col}`, boxSizing: 'border-box', margin: '0 1px' }} />;
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 6px', borderRadius: 999, fontSize: 12, fontWeight: 500, lineHeight: '18px', whiteSpace: 'nowrap', color: col ?? 'var(--text-secondary)', background: col ? `color-mix(in srgb, ${col} 14%, transparent)` : 'var(--surface-3)' }}>
      {icon}{children}
    </span>
  );
}
