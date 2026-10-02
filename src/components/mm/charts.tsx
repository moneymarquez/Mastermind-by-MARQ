import { useState } from 'react';

/** Charts (design handoff: MM Bars, MM Donut). Same rules: current bar
 *  accent + labelled, others accent-soft, tap for a tooltip, 3 gridlines;
 *  donut max 4 slices with 3px gaps, last = Other, tap to highlight. */
const fmt = (v: number, pre: string, suf: string, dec: number) => pre + v.toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec }) + suf;
const compact = (v: number, pre: string, suf: string) => (v >= 1000 ? `${pre}${(v / 1000).toFixed(v % 1000 ? 1 : 0).replace('.0', '')}k${suf}` : `${pre}${Math.round(v * 10) / 10}${suf}`);

/** A "nice" axis max: 1.15× the data, rounded up to an even step. Pure. */
export function niceMax(vals: number[], given?: number): number {
  const raw = given || Math.max(0, ...vals) * 1.15;
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.ceil(raw / mag / 2) * mag * 2;
}

export function Bars({ vals, labels, cur, pre = '$', suf = '', h = 120, max, dec = 0, top, color = 'accent' }: { vals: number[]; labels: string[]; cur?: number; pre?: string; suf?: string; h?: number; max?: number; dec?: number; top?: string; color?: 'accent' | 'client' }) {
  const [sel, setSel] = useState<number | null>(null);
  const n = vals.length, c = cur ?? n - 1, M = niceMax(vals, max);
  const col = color === 'client' ? 'var(--client-accent)' : 'var(--accent)';
  const soft = color === 'client' ? 'color-mix(in srgb, var(--client-accent) 30%, var(--surface))' : 'var(--accent-soft)';
  const bw = Math.min(24, Math.floor(280 / Math.max(1, n)) - 8);
  return (
    <div role="img" aria-label={labels.map((l, i) => `${l} ${fmt(vals[i], pre, suf, dec)}`).join(', ')} style={{ position: 'relative', height: h + 44, display: 'flex', paddingLeft: 32 }}>
      {[0, 0.5, 1].map((f) => (
        <div key={f} style={{ position: 'absolute', left: 0, right: 0, bottom: 22 + f * h - 7, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
          <span style={{ width: 26, fontSize: 10.5, fontWeight: 500, color: 'var(--text-tertiary)', textAlign: 'right' }}>{compact(f * M, pre, suf)}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--grid)' }} />
        </div>
      ))}
      {vals.map((v, i) => {
        const bh = Math.max(2, Math.round((v / M) * h)), on = i === c, s = sel === i;
        return (
          <div key={i} onClick={() => setSel(s ? null : i)} style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22, cursor: 'pointer' }}>
            {on && !s && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{top ?? fmt(v, pre, suf, dec)}</span>}
            {s && <div style={{ position: 'absolute', bottom: 22 + bh + 6, whiteSpace: 'nowrap', padding: '6px 9px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 500, zIndex: 3 }}>{labels[i]} · {fmt(v, pre, suf, dec)}</div>}
            <div style={{ width: bw, maxWidth: '90%', height: bh, background: on || s ? col : soft, borderRadius: '4px 4px 0 0', position: 'relative', zIndex: 1 }} />
            <span style={{ position: 'absolute', bottom: 3, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap', color: on || s ? 'var(--text)' : 'var(--text-tertiary)' }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Keeps the 3 biggest and folds the rest into "Other" (max 4 slices). Pure. */
export function topFour(rows: { name: string; value: number }[]): { name: string; value: number }[] {
  const sorted = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= 4) return sorted;
  const other = sorted.slice(3).reduce((s, r) => s + r.value, 0);
  return [...sorted.slice(0, 3), { name: 'Other', value: other }];
}

export function Donut({ rows, pre = '$', suf = '', dec = 0, center = 'Total', total, client }: { rows: { name: string; value: number }[]; pre?: string; suf?: string; dec?: number; center?: string; total?: string; client?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const sl = topFour(rows);
  const sum = sl.reduce((s, r) => s + r.value, 0) || 1, C = 2 * Math.PI * 48, gap = sl.length > 1 ? 3 : 0;
  const cols = client ? ['var(--client-accent)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-other)'] : ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-other)'];
  let acc = 0;
  const slices = sl.map((r, i) => {
    const len = (r.value / sum) * C;
    const c = r.name === 'Other' || (i === 3 && sl.length === 4) ? 'var(--cat-other)' : cols[i];
    const o = { ...r, c, da: `${Math.max(0, len - gap).toFixed(2)} ${(C - len + gap).toFixed(2)}`, off: (-acc).toFixed(2), pct: `${((r.value / sum) * 100).toFixed(1)}%` };
    acc += len; return o;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 124, height: 124, flex: 'none' }}>
        <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={slices.map((s) => `${s.name} ${s.pct}`).join(', ')}>
          {slices.length === 0 && <circle cx="62" cy="62" r="48" fill="none" stroke="var(--grid)" strokeWidth="14" />}
          {slices.map((s, i) => <circle key={s.name} onClick={() => setSel(sel === i ? null : i)} cx="62" cy="62" r="48" fill="none" stroke={s.c} strokeWidth={sel === i ? 18 : 14} strokeDasharray={s.da} strokeDashoffset={s.off} opacity={sel != null && sel !== i ? 0.3 : 1} style={{ cursor: 'pointer' }} />)}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{sel != null ? slices[sel].name : center}</span>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.03em' }}>{sel != null ? fmt(slices[sel].value, pre, suf, dec) : total ?? fmt(sum === 1 && !slices.length ? 0 : sum, pre, suf, dec)}</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {slices.map((s, i) => (
          <div key={s.name} onClick={() => setSel(sel === i ? null : i)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: sel === i ? 'var(--surface-3)' : 'transparent', cursor: 'pointer' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c, flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}>{fmt(s.value, pre, suf, dec)}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{s.pct}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
