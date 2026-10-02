import type { ReactNode } from 'react';
import Chip from './Chip';
import type { ChipKind } from './Chip';

/** Ledger row (design handoff: MM Row): name + meta, chip, right-aligned
 *  amount + sub. */
export default function Row({ name, meta, chip, k = 'neutral', note, amt, sub, av, square, dim, first, onClick }: { name: ReactNode; meta?: ReactNode; chip?: ReactNode; k?: ChipKind; note?: ReactNode; amt?: ReactNode; sub?: ReactNode; av?: string; square?: boolean; dim?: boolean; first?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--grid)', minWidth: 0, cursor: onClick ? 'pointer' : undefined }}>
      {av && <div style={{ width: 34, height: 34, flex: 'none', borderRadius: square ? 10 : '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{av}</div>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {meta && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>}
        </div>
        {chip && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Chip k={k}>{chip}</Chip>{note && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{note}</span>}</div>}
      </div>
      {(amt != null || sub) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
          <span style={{ color: dim ? 'var(--text-secondary)' : 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{amt}</span>
          {sub && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}
