import { useEffect, useRef, useState } from 'react';

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

/** Tracks an element's width so SVG charts draw at real pixels (text stays crisp). */
function useWidth(fallback = 322) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** MM Line: solid to "today", dashed after (forecast), optional dashed
 *  what-if line (alt), tap anywhere for the nearest point. */
export function Line({ vals, alt, today = -1, labels = [], pts, pre = '', suf = '', dec = 0, min, max, h = 140, color = 'accent', end }: { vals: number[]; alt?: number[]; today?: number; labels?: string[]; pts?: string[]; pre?: string; suf?: string; dec?: number; min?: number; max?: number; h?: number; color?: 'accent' | 'client' | 'good'; end?: string }) {
  const [ref, W] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const n = vals.length;
  if (n < 2) return <div ref={ref} style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>Not enough data to draw yet.</div>;
  const all = vals.concat(alt || []);
  let lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1; if (min == null) lo -= pad; if (max == null) hi += pad;
  const top = 14, bot = h - 22, left = 34, right = W - 6;
  const X = (i: number) => left + (i / (n - 1)) * (right - left), Y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);
  const seg = (arr: number[], a: number, b: number) => arr.slice(a, b + 1).map((v, j) => (j ? 'L' : 'M') + X(a + j).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  const solidEnd = today >= 0 ? today : n - 1;
  const f = (v: number) => fmt(v, pre, suf, dec);
  const col = color === 'client' ? 'var(--client-accent)' : color === 'good' ? 'var(--success)' : 'var(--accent)';
  const wash = color === 'client' ? 'color-mix(in srgb, var(--client-accent) 10%, transparent)' : 'var(--accent-wash)';
  const solid = seg(vals, 0, solidEnd);
  const area = `${solid} L${X(solidEnd).toFixed(1)} ${bot} L${X(0).toFixed(1)} ${bot} Z`;
  const ls = labels.filter(Boolean);
  const grid = [0, 0.5, 1].map((t) => { const v = lo + (hi - lo) * (1 - t) * 0.92 + (hi - lo) * 0.04; return { y: Y(v), l: compact(v, pre, suf) }; });
  const ex = X(n - 1), ey = Y(vals[n - 1]);
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round((((e.clientX - r.left) / r.width) * W - left) / (right - left) * (n - 1))));
    setSel(sel === i ? null : i);
  };
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg onClick={tap} width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }} role="img" aria-label={`${f(vals[0])} to ${f(vals[n - 1])}`}>
        {grid.map((g, i) => <g key={i}><line x1="0" x2={W} y1={g.y} y2={g.y} stroke="var(--grid)" /><text x="0" y={g.y - 4} fontSize="10.5" fontWeight="500" fill="var(--text-tertiary)">{g.l}</text></g>)}
        <path d={area} fill={wash} />
        {alt && <path d={seg(alt, Math.max(today, 0), n - 1)} fill="none" stroke="var(--cat-3)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />}
        <path d={solid} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {today >= 0 && today < n - 1 && <>
          <path d={seg(vals, today, n - 1)} fill="none" stroke={col} strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
          <line x1={X(today)} x2={X(today)} y1="6" y2={bot} stroke="var(--text-tertiary)" strokeDasharray="2 3" />
          <text x={X(today)} y="10" fontSize="10.5" fontWeight="500" fill="var(--text-secondary)" textAnchor="middle">Today</text>
        </>}
        <circle cx={ex} cy={ey} r="4" fill="var(--surface)" stroke={col} strokeWidth="2" />
        <text x={ex - 8} y={ey - 10} fontSize="12" fontWeight="600" fill="var(--text)" textAnchor="end">{end ?? f(vals[n - 1])}</text>
        {sel != null && <><line x1={X(sel)} x2={X(sel)} y1="6" y2={bot} stroke="var(--text-tertiary)" /><circle cx={X(sel)} cy={Y(vals[sel])} r="4" fill={col} /></>}
        {ls.map((l, i) => <text key={i} x={ls.length === 1 ? left : left + (i / (ls.length - 1)) * (right - left)} y={h - 4} fontSize="10.5" fontWeight="500" fill="var(--text-tertiary)" textAnchor={i === 0 ? 'start' : i === ls.length - 1 ? 'end' : 'middle'}>{l}</text>)}
      </svg>
      {sel != null && <div style={{ position: 'absolute', top: -6, left: Math.min(Math.max(X(sel) - 50, 0), W - 120), padding: '6px 9px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{pts ? `${pts[sel]} · ` : ''}{f(vals[sel])}</div>}
    </div>
  );
}

/** MM Ring: one ring (accent/good/warn/client) or up to 3 concentric (cat colors). */
export function Ring({ pcts, center, sub, size = 132, sw = 10, color = 'accent' }: { pcts: number[]; center: string; sub?: string; size?: number; sw?: number; color?: 'accent' | 'good' | 'warn' | 'client' }) {
  const base = { accent: 'var(--accent)', good: 'var(--success)', warn: 'var(--warning)', client: 'var(--client-accent)' }[color];
  const cols = pcts.length === 1 ? [base] : ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'];
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={`${center} ${sub ?? ''}`}>
        {pcts.slice(0, 3).map((v, i) => {
          const r = size / 2 - sw / 2 - i * (sw + 4), C = 2 * Math.PI * r;
          return <g key={i}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
            {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cols[i]} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(Math.min(v, 1) * C).toFixed(1)} ${C.toFixed(1)}`} />}</g>;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <span style={{ color: 'var(--text)', fontSize: size > 110 ? 22 : 15, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{center}</span>
        {sub && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{sub}</span>}
      </div>
    </div>
  );
}

/** One heatmap cell: 0–3 intensity, 'x' slip (red outline), '.' planned (dashed), '_' blank pad. */
export type HeatCell = { v: 0 | 1 | 2 | 3 | 'x' | '.' | '_'; t?: string; n?: string };

/** MM Heatmap: column flow (weeks as columns, 7 rows) or row flow (calendar, 7 columns). */
export function Heatmap({ cells, flow = 'column', lo = 'Less', hi = 'More', slip, caption }: { cells: HeatCell[]; flow?: 'column' | 'row'; lo?: string; hi?: string; slip?: string; caption?: string }) {
  const bgs = ['var(--surface-3)', 'var(--accent-soft)', 'color-mix(in srgb, var(--accent) 65%, var(--surface))', 'var(--accent)'];
  const row = flow === 'row', n = cells.length;
  const R = row ? Math.ceil(n / 7) : 7, C = row ? 7 : Math.ceil(n / 7);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateRows: `repeat(${R}, auto)`, gridTemplateColumns: `repeat(${C}, minmax(0,${row ? '1fr' : '34px'}))`, gridAutoFlow: row ? 'row' : 'column', gap: 4, justifyContent: row ? undefined : 'space-between' }}>
        {cells.map((c, i) => {
          if (c.v === '_') return <div key={i} />;
          const lvl = c.v === 'x' ? 0 : c.v === '.' ? -1 : c.v;
          return <div key={i} title={c.t} style={{ aspectRatio: '1', borderRadius: 4, background: lvl < 0 ? 'transparent' : bgs[lvl], border: c.v === 'x' ? '1.5px solid var(--danger)' : c.v === '.' ? '1px dashed var(--border)' : 'none', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: lvl >= 2 ? 'var(--bg)' : 'var(--text-tertiary)', maxHeight: row ? 44 : undefined }}>{c.n}</div>;
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
        <span>{caption}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {lo && <span>{lo}</span>}
          {bgs.map((b) => <span key={b} style={{ width: 10, height: 10, borderRadius: 3, background: b }} />)}
          {hi && <span>{hi}</span>}
          {slip && <><span style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid var(--danger)', boxSizing: 'border-box', marginLeft: 6 }} /><span>{slip}</span></>}
        </div>
      </div>
    </div>
  );
}
