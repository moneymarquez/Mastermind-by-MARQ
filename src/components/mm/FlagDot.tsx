import type { FlagRow } from '../../data/useFlags';

/** The status dot every list row carries (brief §2c): red or amber with the
 *  reason on hover; nothing when the row is fine. */
export default function FlagDot({ flag, size = 9 }: { flag: Pick<FlagRow, 'severity' | 'message'> | null | undefined; size?: number }) {
  if (!flag) return null;
  const c = flag.severity === 'red' ? 'var(--danger)' : 'var(--warning)';
  return <span role="img" aria-label={`${flag.severity}: ${flag.message}`} title={flag.message} style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c, boxShadow: `0 0 0 3px color-mix(in srgb, ${c} 22%, transparent)`, flexShrink: 0 }} />;
}

/** "3 red" pill for a portal's top bar. */
export function RedCount({ n, onClick }: { n: number; onClick?: () => void }) {
  if (!n) return null;
  return (
    <button onClick={onClick} aria-label={`${n} red flag${n === 1 ? '' : 's'} — open`} className="mm-icon-btn" style={{ height: 32, padding: '0 10px', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 35%, var(--border))', background: 'color-mix(in srgb, var(--danger) 8%, var(--surface))', borderRadius: 999 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />{n} red
    </button>
  );
}
