import Chip from './Chip';
import type { ChipKind } from './Chip';

/** Pace meter (design handoff: MM Pace): fill bar + "Today" marker + chip. */
export default function Pace({ label, val, max, fill, mark, markLabel = 'Today', chip, k = 'warn', note, client }: { label?: string; val?: string; max?: string; fill: number; mark: number; markLabel?: string; chip?: string; k?: ChipKind; note?: string; client?: boolean }) {
  const col = client ? 'var(--client-accent)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</span>
          {val && <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text)' }}>{val}</span>{max && ` of ${max}`}</span>}
        </div>
      )}
      <div role="meter" aria-valuenow={Math.round(fill)} aria-valuemin={0} aria-valuemax={100} aria-label={label} style={{ position: 'relative', height: 26, paddingTop: 4 }}>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, Math.max(0, fill))}%`, height: '100%', background: col, borderRadius: 999 }} /></div>
        <div style={{ position: 'absolute', left: `${mark}%`, top: 0, width: 2, height: 16, marginLeft: -1, background: 'var(--text)', borderRadius: 1 }} />
        <span style={{ position: 'absolute', left: `${mark}%`, top: 18, transform: 'translateX(-50%)', fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{markLabel}</span>
      </div>
      {(chip || note) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
          {chip ? <Chip k={k}>{chip}</Chip> : <span />}
          {note && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'right' }}>{note}</span>}
        </div>
      )}
    </div>
  );
}
