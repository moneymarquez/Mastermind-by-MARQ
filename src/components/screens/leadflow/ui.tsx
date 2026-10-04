import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Signal } from './format';

// LeadFlow primitives (design handoff). Every color is a --lf-* token; the
// class names live in leadflow.css.

export function Dot({ s }: { s: Signal }) {
  return <span className="lf-dot" style={{ background: `var(--lf-${s}-dot)` }} />;
}

/** Status tag: 4px, 20px tall, dot + word. Neutral tags without meaning can drop the dot. */
export function Tag({ s, children, dot = true, title }: { s: Signal; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span className="lf-tag" title={title} style={{ background: `var(--lf-${s}-fill)`, color: `var(--lf-${s}-text)` }}>
      {dot && <Dot s={s} />}<span className="lf-trunc">{children}</span>
    </span>
  );
}

export function TierMark({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span className="lf-tier" style={{ background: 'var(--lf-surface-2)', color: 'var(--lf-text-tertiary)' }}>–</span>;
  const s: Signal = tier === 'A' ? 'go' : tier === 'B' ? 'wait' : 'neu';
  return <span className="lf-tier" style={{ background: `var(--lf-${s}-fill)`, color: `var(--lf-${s}-text)` }} aria-label={`Tier ${tier}`}>{tier}</span>;
}

/** Lucide "phone", 16px, 1.5 stroke: the only icon LeadFlow uses. */
export function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** One bordered strip of equal cells with vertical hairlines. */
export function KpiStrip({ items, compact }: { items: { label: string; value: ReactNode; s?: Signal }[]; compact?: boolean }) {
  // On a phone, four numbers wrap into a 2×2 grid instead of clipping.
  const cols = compact && items.length > 3 ? 2 : items.length;
  return (
    <div className="lf-panel" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, overflow: 'hidden' }}>
      {items.map((k, i) => (
        <div key={k.label} style={{ minWidth: 0, padding: compact ? '10px 12px' : '14px 16px', borderLeft: i % cols ? '1px solid var(--lf-border)' : 0, borderTop: i >= cols ? '1px solid var(--lf-border)' : 0 }}>
          <div className="lf-label lf-trunc" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{k.s && <Dot s={k.s} />}{k.label}</div>
          <div className="lf-mono" style={{ fontSize: compact ? 22 : 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 4, lineHeight: 1.15, color: 'var(--lf-text)' }}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Bordered strip with a signal dot, a bold title and one line. */
export function Banner({ s, title, children, style }: { s: Signal; title?: string; children?: ReactNode; style?: CSSProperties }) {
  const fill = s === 'stop' || s === 'wait';
  return (
    <div role={s === 'stop' ? 'alert' : 'status'} className="lf-panel" style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '10px 14px', fontSize: 14, background: fill ? `var(--lf-${s}-fill)` : undefined, color: fill ? `var(--lf-${s}-text)` : 'var(--lf-text)', ...style }}>
      <span style={{ alignSelf: 'center', display: 'flex' }}><Dot s={s} /></span>
      <span style={{ minWidth: 0 }}>{title && <span style={{ fontWeight: 500 }}>{title}{children ? '. ' : ''}</span>}{children}</span>
    </div>
  );
}

export function NotConnected() {
  return <Banner s="wait" title="LeadFlow isn't connected yet">Set the SUPABASE_SERVICE_ROLE_KEY secret on the Worker and this screen goes live.</Banner>;
}

export function Callout({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="lf-callout">
      <div className="lf-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>{label}{action}</div>
      <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, color: 'var(--lf-text-secondary)' }}>{children}</div>
    </div>
  );
}

export function Progress({ value, total, label = true }: { value: number; total: number; label?: boolean }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--lf-surface-2)', borderRadius: 2 }} role="progressbar" aria-valuenow={value} aria-valuemax={total}>
        <div style={{ width: `${pct}%`, height: 4, background: 'var(--lf-accent)', borderRadius: 2, transition: 'width .18s' }} />
      </div>
      {label && <span className="lf-mono" style={{ fontSize: 13 }}>{value} of {total}</span>}
    </div>
  );
}

/** One line and one secondary button. No illustration. */
export function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)' }}>{text}</div>
      {action && onAction && <button className="lf-btn lf-btn--secondary" onClick={onAction}>{action}</button>}
    </div>
  );
}

/** Skeleton rows in place of "Loading…". */
export function SkeletonRows({ rows = 6, cols }: { rows?: number; cols: string }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', height: 44, padding: '0 12px', gap: 12, borderBottom: '1px solid var(--lf-border)' }}>
          {cols.split(/\s+(?![^(]*\))/).map((_, j) => <div key={j} className="lf-skel" style={{ width: j === 1 ? '70%' : '50%' }} />)}
        </div>
      ))}
    </div>
  );
}

/** Label → value row (record panel, War Room facts). */
export function FieldRow({ label, children, mono, muted }: { label: string; children: ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <div className="lf-field">
      <div>{label}</div>
      <div className={mono ? 'lf-mono' : undefined} style={{ color: muted ? 'var(--lf-text-tertiary)' : 'var(--lf-text)' }}>{children}</div>
    </div>
  );
}

/** Bordered box of field rows separated by hairlines. */
export function FieldBox({ rows, labelW = 130 }: { rows: { label: string; value: ReactNode; mono?: boolean; muted?: boolean }[]; labelW?: number }) {
  return (
    <div style={{ border: '1px solid var(--lf-border)', borderRadius: 'var(--lf-r-panel)', background: 'var(--lf-surface)' }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'flex', padding: '10px 14px', borderTop: i ? '1px solid var(--lf-border)' : 0, fontSize: 14, gap: 8 }}>
          <div className="lf-label" style={{ width: labelW, flex: 'none', paddingTop: 2 }}>{r.label}</div>
          <div className={r.mono ? 'lf-mono' : undefined} style={{ minWidth: 0, overflowWrap: 'anywhere', color: r.muted ? 'var(--lf-text-tertiary)' : 'var(--lf-text)' }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Secondary-looking button with a native select doing the picking, so it
 *  works with a keyboard and opens the OS picker on a phone. */
export function FilterButton<T extends string>({ label, value, allValue, options, onChange, allLabel }: {
  label: string; value: T; allValue: T; options: { value: T; label?: string; count?: number }[]; onChange: (v: T) => void; allLabel?: string;
}) {
  const on = value !== allValue;
  const shown = on ? (options.find((o) => o.value === value)?.label ?? value) : '';
  return (
    <label className="lf-filter" data-on={on || undefined}>
      {on ? `${label}: ${shown}` : label} <span aria-hidden="true" style={{ marginLeft: 6, fontSize: 11 }}>▾</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        <option value={allValue}>{allLabel ?? `All ${label.toLowerCase()}`}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label ?? o.value}{o.count != null ? ` (${o.count})` : ''}</option>)}
      </select>
    </label>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, style }: {
  options: { value: T; label: ReactNode }[]; value: T | null; onChange: (v: T) => void; label: string; style?: CSSProperties;
}) {
  return (
    <div className="lf-seg" role="radiogroup" aria-label={label} style={style}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} style={{ flex: style?.display === 'flex' ? 1 : undefined }}>{o.label}</button>
      ))}
    </div>
  );
}

/** "···" menu. Closes on outside click and Escape. */
export function MoreMenu({ items, label = 'More', align = 'right', buttonClass = 'lf-btn lf-btn--ghost', up }: {
  items: { label: string; onClick?: () => void; href?: string; danger?: boolean }[]; label?: string; align?: 'left' | 'right'; buttonClass?: string; up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={buttonClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>···</button>
      {open && (
        <div className="lf-menu" role="menu" style={{ [align]: 0, ...(up ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}>
          {items.map((it) => it.href
            ? <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{it.label}</a>
            : <button key={it.label} role="menuitem" className={it.danger ? 'lf-menu-danger' : undefined} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>)}
        </div>
      )}
    </div>
  );
}

/** Page sub-header line inside a tab. */
export function Lede({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)' }}>{children}</div>;
}

export function PanelHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--lf-border)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
        {sub && <div className="lf-label" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}
