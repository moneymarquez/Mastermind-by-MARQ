/** Stat tile (design handoff: MM Stat): label, 26px value, optional pill. */
export type PillKind = 'good' | 'bad' | 'warn' | 'neutral';
const COL: Record<string, string> = { good: 'var(--success)', bad: 'var(--danger)', warn: 'var(--warning)' };
export function Pill({ k = 'neutral', children }: { k?: PillKind; children: React.ReactNode }) {
  const col = COL[k];
  return <span style={{ alignSelf: 'flex-start', padding: '1px 7px', borderRadius: 'var(--g-r-sm)', fontSize: 12, fontWeight: col ? 600 : 500, color: col ?? 'var(--text-secondary)', background: col ? `color-mix(in srgb, ${col} 14%, transparent)` : 'var(--surface-3)', whiteSpace: 'nowrap' }}>{children}</span>;
}
export default function Stat({ label, value, pill, k, onClick, hero }: { label: string; value: React.ReactNode; pill?: React.ReactNode; k?: PillKind; onClick?: () => void; hero?: boolean }) {
  return (
    <div onClick={onClick} className={hero ? 'mm-stat mm-stat--hero' : 'mm-stat'} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--g-r-lg)', padding: hero ? 16 : 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, boxSizing: 'border-box', height: '100%', cursor: onClick ? 'pointer' : undefined }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: hero ? 30 : 24, fontWeight: 500, fontFamily: 'var(--g-mono)', letterSpacing: '-0.035em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      {pill != null && pill !== '' && <Pill k={k}>{pill}</Pill>}
    </div>
  );
}
