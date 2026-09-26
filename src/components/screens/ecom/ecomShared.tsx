import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { GREEN } from '../leadflow/shared';
import type { Confidence, Health } from '../../../data/ecom';
import { CONFIDENCE_COLOR, CONFIDENCE_LABEL, HEALTH_COLOR, HEALTH_LABEL, ago } from '../../../data/ecom';

/** The LeadFlow skin, named once for the whole e-commerce module — same
 *  white cards, greys and green as LeadCard/leadTheme, so the two modules
 *  read as one product. */
export const E = {
  green: GREEN,
  bg: '#fafafa',
  card: { background: '#fff', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderRadius: 'var(--radius-lg)' } as CSSProperties,
  text: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  red: '#dc2626',
  amber: '#b45309',
};

export const label: CSSProperties = { fontSize: 'var(--text-caption)', color: E.faint, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };
export const field: CSSProperties = { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${E.border}`, background: '#fff', color: E.text, fontSize: 'var(--text-body)', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
export const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost'): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 600, fontFamily: 'inherit',
  border: kind === 'ghost' ? `1px solid ${E.border}` : 'none',
  background: kind === 'primary' ? E.green : kind === 'danger' ? E.red : '#fff',
  color: kind === 'ghost' ? E.text : '#fff',
});

export function badge(bg: string, fg: string, border: string): CSSProperties {
  return { fontSize: 'var(--text-caption)', fontWeight: 700, color: fg, background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: '1px 7px', letterSpacing: 0.3, whiteSpace: 'nowrap' };
}
export function Badge({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return <span title={title} style={badge(`${color}1f`, color, `${color}66`)}>{children}</span>;
}
/** §2.4 — you should never mistake a guess for a fact. */
export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <Badge color={CONFIDENCE_COLOR[c]} title={c === 'hard' ? 'From an API or store' : c === 'estimate' ? 'A paid tool\'s model' : 'A worker\'s judgment'}>{CONFIDENCE_LABEL[c]}</Badge>;
}
export function HealthBadge({ h }: { h: Health }) {
  return <Badge color={HEALTH_COLOR[h]}>{HEALTH_LABEL[h]}</Badge>;
}

/** §2.2 — every number has a label, unit, trend arrow and as-of time. */
export function Metric({ label: l, value, unit, trend, asOf, confidence, big }: { label: string; value: string; unit?: string; trend?: string; asOf?: string | null; confidence?: Confidence; big?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: big ? 26 : 18, fontWeight: 600, color: E.text, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {value}{unit ? <span style={{ fontSize: big ? 13 : 11, color: E.faint, marginLeft: 3 }}>{unit}</span> : null}
        {trend ? <span style={{ fontSize: 13, marginLeft: 6, color: trend.startsWith('↑') ? E.green : trend.startsWith('↓') ? E.red : E.faint }}>{trend}</span> : null}
      </div>
      <div style={{ ...label, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{l}</span>
        {asOf && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {ago(asOf)}</span>}
        {confidence && <ConfidenceBadge c={confidence} />}
      </div>
    </div>
  );
}

/** §2.5 — empty states teach: what fills this, which worker, which connection. */
export function TeachingEmpty({ what, worker, connection, phase, action }: { what: string; worker?: string; connection?: string; phase?: number; action?: ReactNode }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, color: E.amber, fontSize: 'var(--text-body)' }}>{what}</div>
      <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4, lineHeight: 1.5 }}>
        {worker && <>Filled by <strong style={{ color: E.text }}>{worker}</strong>. </>}
        {connection && <>Needs <strong style={{ color: E.text }}>{connection}</strong>. </>}
        {phase && <>Arrives in <strong style={{ color: E.text }}>Phase {phase}</strong>.</>}
      </div>
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

export function ProgressRing({ done, total, size = 44 }: { done: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} of ${total} steps`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={E.green} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3} fontWeight={700} fill={E.text} style={{ fontFamily: 'var(--font-mono)' }}>{done}</text>
    </svg>
  );
}

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: active ? 'none' : `1px solid ${E.border}`, background: active ? E.green : '#fff', color: active ? '#fff' : E.text, cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}

export function useIsMobile(breakpoint = 768): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const on = () => setM(window.innerWidth < breakpoint);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [breakpoint]);
  return m;
}

/** §2.6 — detail lives in drawers: right side on desktop, full screen on
 *  mobile. One component, so no screen grows a dead-end page. */
export function Drawer({ open, onClose, title, subtitle, actions, width = 560, children }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; width?: number; children: ReactNode }) {
  const mobile = useIsMobile();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.45)' }} />
      <div style={{ position: 'relative', width: mobile ? '100%' : width, maxWidth: '100%', height: '100%', background: '#fafafa', color: '#111', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: mobile ? 'calc(14px + env(safe-area-inset-top)) 16px 12px' : '16px 20px 12px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: E.text, lineHeight: 1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 'var(--text-body)', color: E.faint, marginTop: 3 }}>{subtitle}</div>}
          </div>
          {actions}
          <button onClick={onClose} aria-label="Close" style={{ ...btn('ghost'), padding: '6px 10px' }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? '14px 16px calc(24px + env(safe-area-inset-bottom))' : '18px 20px 40px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={label}>{title}</div>{aside}
      </div>
      {children}
    </div>
  );
}
