import { useState } from 'react';
import type { ReactNode } from 'react';
import Card from './Card';
import Stat from './Stat';
import type { PillKind } from './Stat';
import Chip from './Chip';
import type { ChipKind } from './Chip';
import Row from './Row';
import Pace from './Pace';
import { Empty } from './States';
import { Bars, Donut, Line, Ring, Heatmap } from './charts';
import type { HeatCell } from './charts';

/** The module dashboard (design handoff: MM Wide). One data-driven layout
 *  for every module: hero + stats, a chart grid, an optional table, an
 *  optional split view. Specs are built from real data by the hooks in
 *  src/data/moduleDash — nothing here invents numbers. */

export type DashDevice = 'phone' | 'ipad' | 'desktop';
export type DashAction = { t: string; kind?: 'primary' | 'client' | 'client-outline'; onClick: () => void };
export type DashStat = { l: string; v: string; p?: string; k?: PillKind; onClick?: () => void };
export type PaceSpec = { label: string; val: string; max: string; fill: number; mark: number; chip?: string; k?: ChipKind; note?: string };
export type DashHero = {
  label: string; value: string; cents?: string; chip?: string; k?: ChipKind; note?: string; color?: 'accent' | 'client' | 'good';
  line?: { vals: number[]; today?: number; labels?: string[]; pre?: string };
  pace?: PaceSpec;
};
export type RowSpec = { n: string; m?: string; c?: string; k?: ChipKind; a?: string; s?: string; dim?: boolean; onClick?: () => void };
type ChartBase = { title: string; meta?: string; span?: 1 | 2 | 3; actions?: DashAction[] };
export type DashChart = ChartBase & (
  | { type: 'bars'; vals: number[]; labels: string[]; pre?: string; suf?: string; cur?: number; max?: number; top?: string; color?: 'accent' | 'client' }
  | { type: 'line'; vals: number[]; alt?: number[]; today?: number; labels?: string[]; pts?: string[]; pre?: string; suf?: string; dec?: number; min?: number; max?: number; color?: 'accent' | 'client' | 'good' }
  | { type: 'donut'; rows: { name: string; value: number }[]; pre?: string; center?: string; total?: string; client?: boolean }
  | { type: 'pace'; paces: PaceSpec[] }
  | { type: 'ring'; pcts: number[]; center: string; sub?: string; legend: { n: string; v: string; c: string }[]; color?: 'accent' | 'good' | 'warn' | 'client' }
  | { type: 'heat'; cells: HeatCell[]; flow?: 'column' | 'row'; lo?: string; hi?: string; slip?: string; caption?: string }
  | { type: 'meters'; meters: { n: string; v: number; max: number; label?: string; c?: string }[] }
  | { type: 'rows'; rows: RowSpec[]; empty?: string }
  | { type: 'timeline'; steps: { n: string; d?: string; chip?: string; k?: ChipKind }[]; cur: number }
  | { type: 'tiles'; tiles: { l: string; v: string; d?: string; good?: boolean }[]; n?: number }
  | { type: 'text'; paras: string[]; nova?: boolean }
  | { type: 'node'; node: ReactNode }
);
export type TableCell = string | { chip: string; k?: ChipKind };
export type DashTable = { title: string; meta?: string; head: string[]; cols: string; rows: { cells: TableCell[]; onClick?: () => void }[]; phoneCols?: number[] };
export type SplitRow = {
  id: string; n: string; ini: string; m?: string; c?: string; k?: ChipKind; a?: string;
  big?: string; fields: [string, string][]; body?: string[]; note?: string; logTitle?: string; log?: [string, string][]; actions?: DashAction[];
};
export type DashSplit = { search: string; add?: DashAction; rows: SplitRow[]; empty?: string };
export type DashSpec = {
  hero?: DashHero; stats?: DashStat[]; statsAfter?: boolean;
  charts?: DashChart[]; table?: DashTable; split?: DashSplit;
  empty?: { text: string; cta?: string; onCta?: () => void };
};

function Actions({ list }: { list?: DashAction[] }) {
  if (!list?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {list.map((a) => {
        const st = a.kind === 'primary' ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)', fontWeight: 600 }
          : a.kind === 'client' ? { background: 'var(--client-accent)', color: 'var(--bg)', borderColor: 'var(--client-accent)', fontWeight: 600 }
          : a.kind === 'client-outline' ? { color: 'var(--client-accent)', borderColor: 'color-mix(in srgb, var(--client-accent) 50%, var(--border))', fontWeight: 600 }
          : { fontWeight: 500 };
        return <button key={a.t} className="mm-btn" onClick={a.onClick} style={{ height: 38, fontSize: 13.5, ...st }}>{a.t}</button>;
      })}
    </div>
  );
}

function NovaMark() {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" /></svg>Nova</div>;
}

function ChartBody({ c }: { c: DashChart }) {
  switch (c.type) {
    case 'bars': return <Bars vals={c.vals} labels={c.labels} pre={c.pre ?? '$'} suf={c.suf} cur={c.cur} max={c.max} top={c.top} color={c.color} h={140} />;
    case 'line': return <Line vals={c.vals} alt={c.alt} today={c.today} labels={c.labels} pts={c.pts} pre={c.pre} suf={c.suf} dec={c.dec} min={c.min} max={c.max} color={c.color} h={150} />;
    case 'donut': return <Donut rows={c.rows} pre={c.pre ?? '$'} center={c.center} total={c.total} client={c.client} />;
    case 'pace': return <>{c.paces.map((p) => <div key={p.label} style={{ paddingBottom: 4 }}><Pace label={p.label} val={p.val} max={p.max} fill={p.fill} mark={p.mark} chip={p.chip} k={p.k} note={p.note} /></div>)}</>;
    case 'ring': return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring pcts={c.pcts} center={c.center} sub={c.sub} size={120} color={c.color} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {c.legend.map((l) => <div key={l.n} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: l.c }} />{l.n}</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{l.v}</span></div>)}
        </div>
      </div>
    );
    case 'heat': return <Heatmap cells={c.cells} flow={c.flow} lo={c.lo} hi={c.hi} slip={c.slip} caption={c.caption} />;
    case 'meters': return <>{c.meters.map((m) => (
      <div key={m.n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 120, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.n}</span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, m.max ? (m.v / m.max) * 100 : 0).toFixed(1)}%`, height: '100%', borderRadius: 999, background: m.c ?? 'var(--accent)' }} /></div>
        <span style={{ width: 44, textAlign: 'right', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{m.label ?? String(m.v)}</span>
      </div>
    ))}</>;
    case 'rows': return c.rows.length
      ? <div>{c.rows.map((r, i) => <Row key={`${r.n}-${i}`} first={i === 0} name={r.n} meta={r.m} chip={r.c} k={r.k} amt={r.a} sub={r.s} dim={r.dim} onClick={r.onClick} />)}</div>
      : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>{c.empty ?? 'Nothing here yet.'}</div>;
    case 'timeline': return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {c.steps.map((s, i, arr) => {
          const done = i < c.cur, cur = i === c.cur;
          return (
            <div key={`${s.n}-${i}`} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 22, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', background: done ? 'var(--accent)' : 'transparent', border: done ? 'none' : cur ? '2px solid var(--accent)' : '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: 11, fontWeight: 700 }}>{done ? '✓' : ''}</div>
                <div style={{ flex: 1, width: 2, minHeight: 12, background: i === arr.length - 1 ? 'transparent' : done ? 'var(--accent)' : 'var(--grid)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, padding: '1px 0 14px', minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ color: i > c.cur ? 'var(--text-secondary)' : 'var(--text)', fontSize: 14.5, fontWeight: 500 }}>{s.n}</span>
                  {s.d && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{s.d}</span>}
                </div>
                {s.chip && <Chip k={s.k}>{s.chip}</Chip>}
              </div>
            </div>
          );
        })}
      </div>
    );
    case 'tiles': return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.n ?? 2}, minmax(0,1fr))`, gap: 8 }}>
        {c.tiles.map((t) => (
          <div key={t.l} style={{ padding: 12, borderRadius: 10, background: t.good ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface-3)', border: t.good ? '1.5px solid var(--accent)' : '1.5px solid transparent', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.l}</span>
            <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{t.v}</span>
            {t.d && <span style={{ fontSize: 12, fontWeight: 500, color: t.good ? 'var(--success)' : 'var(--text-tertiary)' }}>{t.d}</span>}
          </div>
        ))}
      </div>
    );
    case 'text': return <>{c.nova && <NovaMark />}{c.paras.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', textWrap: 'pretty' } as React.CSSProperties}>{p}</p>)}</>;
    case 'node': return <>{c.node}</>;
  }
}

function Table({ t, device }: { t: DashTable; device: DashDevice }) {
  const keep = device === 'phone' && t.phoneCols ? t.phoneCols : t.head.map((_, i) => i);
  const cols = device === 'phone' ? keep.map((_, i) => (i === 0 ? 'minmax(0,1.4fr)' : 'auto')).join(' ') : t.cols;
  const last = t.head.length - 1;
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{t.title}</span>
        {t.meta && <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{t.meta}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '9px 20px', borderTop: '1px solid var(--grid)', background: 'var(--surface-2)', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>
        {keep.map((i) => <span key={i} style={{ textAlign: i === last ? 'right' : 'left', whiteSpace: 'nowrap' }}>{t.head[i]}</span>)}
      </div>
      {t.rows.map((r, ri) => (
        <div key={ri} onClick={r.onClick} className="mm-dash-tr" style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, alignItems: 'center', minHeight: 50, padding: '0 20px', borderTop: '1px solid var(--grid)', fontSize: 14, cursor: r.onClick ? 'pointer' : undefined }}>
          {keep.map((i) => {
            const c = r.cells[i];
            return (
              <div key={i} style={{ minWidth: 0, display: 'flex', justifyContent: i === last ? 'flex-end' : 'flex-start' }}>
                {typeof c === 'object' && c ? <Chip k={c.k}>{c.chip}</Chip>
                  : <span style={{ color: i === 0 || i === last ? 'var(--text)' : 'var(--text-secondary)', fontWeight: i === 0 || i === last ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: i === last ? '-0.02em' : 0 }}>{c ?? ''}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function Detail({ r, onBack }: { r: SplitRow; onBack?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '22px 26px', minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
      {onBack && <button className="mm-btn" onClick={onBack} style={{ alignSelf: 'flex-start', height: 34 }}>‹ Back</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>{r.n}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{r.c && <Chip k={r.k}>{r.c}</Chip>}{r.m && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{r.m}</span>}</div>
        </div>
        {(r.big || r.a) && <span style={{ color: 'var(--text)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>{r.big || r.a}</span>}
      </div>
      <Actions list={r.actions} />
      {r.fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {r.fields.map(([l, v], i) => (
            <div key={l + i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderTop: i > 1 ? '1px solid var(--grid)' : 'none', borderLeft: i % 2 ? '1px solid var(--grid)' : 'none', minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{l}</span>
              <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v || '—'}</span>
            </div>
          ))}
        </div>
      )}
      {(r.body ?? []).map((p, i) => <p key={i} style={{ margin: 0, color: 'var(--text)', fontSize: 15, lineHeight: 1.55 }}>{p}</p>)}
      {r.note && <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}><svg style={{ flex: 'none', marginTop: 3 }} width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" /></svg><span>{r.note}</span></div>}
      {!!r.log?.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{r.logTitle ?? 'Activity'}</span>
          {r.log.map(([d, t], i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 10, fontSize: 14 }}><span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>{d}</span><span style={{ color: 'var(--text)', lineHeight: 1.4 }}>{t}</span></div>)}
        </div>
      )}
    </div>
  );
}

function Split({ s, device }: { s: DashSplit; device: DashDevice }) {
  const [sel, setSel] = useState<string | null>(device === 'phone' ? null : s.rows[0]?.id ?? null);
  const [q, setQ] = useState('');
  const rows = q ? s.rows.filter((r) => `${r.n} ${r.m ?? ''} ${r.c ?? ''}`.toLowerCase().includes(q.toLowerCase())) : s.rows;
  const cur = s.rows.find((r) => r.id === sel) ?? (device === 'phone' ? undefined : rows[0]);
  const phone = device === 'phone';
  if (phone && cur) return <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}><Detail r={cur} onBack={() => setSel(null)} /></section>;
  return (
    <section style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : device === 'desktop' ? '380px minmax(0,1fr)' : '320px minmax(0,1fr)', height: phone ? undefined : device === 'desktop' ? 640 : 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', flex: 'none' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} aria-label={s.search} style={{ flex: 1, minWidth: 0, height: 34, padding: '0 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
          {s.add && <button className="mm-btn mm-btn--primary" onClick={s.add.onClick} style={{ height: 34, fontSize: 13, padding: '0 12px' }}>{s.add.t}</button>}
        </div>
        <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
          {rows.length === 0 && <div style={{ padding: '18px 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>{q ? 'No matches.' : s.empty ?? 'Nothing here yet.'}</div>}
          {rows.map((r) => (
            <button key={r.id} onClick={() => setSel(r.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--grid)', background: cur?.id === r.id && !phone ? 'var(--surface-3)' : 'transparent', cursor: 'pointer', width: '100%', textAlign: 'left', border: 0, borderTopStyle: 'solid', borderTopWidth: 1, borderTopColor: 'var(--grid)', fontFamily: 'inherit', minHeight: 56 }}>
              <div style={{ width: 32, height: 32, flex: 'none', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11.5, fontWeight: 600 }}>{r.ini}</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.n}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{r.a}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>{r.c && <Chip k={r.k}>{r.c}</Chip>}<span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.m}</span></div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {!phone && (cur ? <Detail r={cur} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Pick one on the left.</div>)}
    </section>
  );
}

/** Renders a module's dashboard. `three` = 3 chart columns (desktop with Nova closed). */
export default function ModuleDash({ spec, device, novaOpen }: { spec: DashSpec | null; device: DashDevice; novaOpen?: boolean }) {
  if (!spec) return null;
  const phone = device === 'phone', desk = device === 'desktop', three = desk && !novaOpen;
  const gap = phone ? 12 : 16;
  if (spec.empty) return <Empty text={spec.empty.text} cta={spec.empty.cta} onCta={spec.empty.onCta} />;
  const stats = spec.stats ?? [];
  const h = spec.hero;
  const top = (h || stats.length > 0) && (
    <div style={{ display: 'grid', gridTemplateColumns: phone || !h ? 'minmax(0,1fr)' : desk ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1.2fr) minmax(0,1fr)', gap }}>
      {h && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{h.label}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: 'var(--text)', fontSize: phone ? 40 : 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{h.value}{h.cents && <span style={{ fontSize: 22, color: 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>{h.cents}</span>}</div>
          {(h.chip || h.note) && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{h.chip && <Chip k={h.k}>{h.chip}</Chip>}{h.note && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>{h.note}</span>}</div>}
          {h.line && <div style={{ marginTop: 'auto' }}><Line vals={h.line.vals} today={h.line.today} labels={h.line.labels} pre={h.line.pre} color={h.color} h={120} /></div>}
          {h.pace && <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--grid)' }}><Pace {...h.pace} client={h.color === 'client'} /></div>}
        </section>
      )}
      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: phone || h ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))', gap: phone ? 10 : gap, minWidth: 0 }}>
          {stats.map((s) => <Stat key={s.l} label={s.l} value={s.v} pill={s.p} k={s.k} onClick={s.onClick} />)}
        </div>
      )}
    </div>
  );
  const charts = spec.charts ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
      {!spec.statsAfter && top}
      {spec.split && <Split s={spec.split} device={device} />}
      {spec.statsAfter && top}
      {charts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap, alignItems: 'start' }}>
          {charts.map((c, i) => (
            <div key={`${c.title}-${i}`} style={{ gridColumn: phone || !c.span || c.span === 1 ? 'auto' : three ? `span ${c.span}` : '1 / -1', minWidth: 0 }}>
              <Card title={c.title} meta={c.meta} flush={c.type === 'rows'} wide={!phone}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, paddingBottom: c.type === 'rows' && c.actions ? 14 : 0 }}>
                  <ChartBody c={c} />
                  <Actions list={c.actions} />
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
      {spec.table && <Table t={spec.table} device={device} />}
    </div>
  );
}
