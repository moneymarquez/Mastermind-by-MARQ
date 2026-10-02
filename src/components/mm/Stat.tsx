/** Stat tile (design handoff: MM Stat): label, 26px value, optional pill. */
export type PillKind = 'good' | 'bad' | 'warn' | 'neutral';
const COL: Record<string, string> = { good: 'var(--success)', bad: 'var(--danger)', warn: 'var(--warning)' };
export function Pill({ k = 'neutral', children }: { k?: PillKind; children: React.ReactNode }) {
  const col = COL[k];
  return <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: col ? 600 : 500, color: col ?? 'var(--text-secondary)', background: col ? `color-mix(in srgb, ${col} 14%, transparent)` : 'var(--surface-3)', whiteSpace: 'nowrap' }}>{children}</span>;
}
export default function Stat({ label, value, pill, k, onClick }: { label: string; value: React.ReactNode; pill?: React.ReactNode; k?: PillKind; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, boxSizing: 'border-box', height: '100%', cursor: onClick ? 'pointer' : undefined }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      {pill != null && pill !== '' && <Pill k={k}>{pill}</Pill>}
    </div>
  );
}
