import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Confidence, Health } from '../../../data/ecom';
import { CONFIDENCE_COLOR, CONFIDENCE_LABEL, HEALTH_COLOR, HEALTH_LABEL, ago } from '../../../data/ecom';

/** The engine screens' style handles, mapped onto the design handoff:
 *  16px cards with hairline borders, 8px buttons and fields, pill chips,
 *  sentence-case labels, Inter with tabular figures. Dark and light both
 *  come from the same tokens. */
export const E = {
  green: 'var(--success)',
  accent: 'var(--accent)',
  onAccent: 'var(--bg)',
  bg: 'var(--surface-2)',
  surface: 'var(--surface)',
  sunk: 'var(--surface-4)',
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 } as CSSProperties,
  text: 'var(--text)',
  muted: 'var(--text-secondary)',
  faint: 'var(--text-tertiary)',
  border: 'var(--border)',
  red: 'var(--danger)',
  amber: 'var(--warning)',
  blue: 'var(--accent)',
  violet: 'var(--accent-strong)',
  teal: 'var(--client-accent)',
};
/** A tinted wash of any colour (hex or token) — badges, banners, active states. */
export const tint = (color: string, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
/** Colours that arrive as hex from shared constants (LeadFlow's outcome
 *  list, which this module must not edit) mapped onto the app's tokens. */
const TONE: Record<string, string> = { '#16a34a': E.green, '#15803d': E.green, '#2563eb': E.blue, '#7c3aed': E.violet, '#ca8a04': E.amber, '#f59e0b': E.amber, '#ef4444': E.red, '#dc2626': E.red, '#6b7280': E.faint, '#9ca3af': E.faint };
export const tone = (hex: string) => TONE[hex.toLowerCase()] ?? hex;
/** The engine panel every module tab sits in. */
export const panel: CSSProperties = { color: E.text };

export const label: CSSProperties = { fontSize: 13, color: E.muted, fontWeight: 500 };
export const field: CSSProperties = { minHeight: 44, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: E.text, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', outline: 'none' };
export const btn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost'): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: kind === 'primary' ? '1px solid var(--text)' : kind === 'danger' ? `1px solid ${tint(E.red, 45)}` : '1px solid var(--border)',
  background: kind === 'primary' ? 'var(--text)' : 'transparent',
  color: kind === 'primary' ? 'var(--bg)' : kind === 'danger' ? E.red : E.text,
});

export function badge(bg: string, fg: string, border: string): CSSProperties {
  void border;
  return { fontSize: 12, fontWeight: 500, lineHeight: '18px', color: fg, background: bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', boxSizing: 'border-box' };
}
export function Badge({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return <span title={title} style={badge(tint(color, 14), color, tint(color, 40))}>{children}</span>;
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
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 600, letterSpacing: '-0.035em', color: E.text, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
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
    <div style={{ borderRadius: 16, border: '1px dashed var(--border)', padding: '18px 18px', backgroundImage: 'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ fontWeight: 600, color: E.text, fontSize: 15, lineHeight: 1.45 }}>{what}</div>
      <div style={{ fontSize: 14, color: E.muted, marginTop: 4, lineHeight: 1.5 }}>
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={E.green} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3} fontWeight={700} fill={E.text}>{done}</text>
    </svg>
  );
}

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 13px', borderRadius: 999, border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? 'var(--text)' : 'transparent', color: active ? 'var(--bg)' : E.muted, cursor: 'pointer', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} />
      <div data-demo="drawer" style={{ position: 'relative', width: mobile ? '100%' : width, maxWidth: '100%', height: '100%', background: 'var(--bg)', color: E.text, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--mm-shadow)' }}>
        <div style={{ padding: mobile ? 'calc(14px + env(safe-area-inset-top)) 16px 12px' : '16px 20px 12px', background: E.surface, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: E.text, lineHeight: 1.25 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13.5, color: E.faint, marginTop: 3 }}>{subtitle}</div>}
          </div>
          {actions}
          <button onClick={onClose} aria-label="Close" className="mm-icon-btn" style={{ width: 34, height: 34 }}>✕</button>
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
    <section style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ color: E.text, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</span>{aside}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}
