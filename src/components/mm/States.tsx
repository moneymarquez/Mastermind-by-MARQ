import type { ReactNode } from 'react';

/** Empty + AI-off states (design handoff: MM States). Every module has an
 *  empty state: a gridded panel, one sentence, one primary CTA. */
export function Empty({ text, cta, onCta, children }: { text: ReactNode; cta?: string; onCta?: () => void; children?: ReactNode }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, border: '1px dashed var(--border)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', backgroundImage: 'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)', backgroundSize: '22px 22px', backgroundPosition: 'center' }}>
      <span style={{ maxWidth: 360, color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5, background: 'var(--bg)', padding: '2px 6px', borderRadius: 6 }}>{text}</span>
      {cta && onCta && <button onClick={onCta} className="mm-btn mm-btn--primary" style={{ height: 44 }}>{cta}</button>}
      {children}
    </div>
  );
}
export function AiOff({ what, onConnect }: { what: string; onConnect?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 6px', borderRadius: 999, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-3)', flex: 'none' }}><span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--text-tertiary)', boxSizing: 'border-box' }} />Not connected</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>AI isn't connected yet, so {what}. Everything else works.</span>
      {onConnect && <button className="mm-btn" style={{ height: 34, flex: 'none' }} onClick={onConnect}>Connect AI</button>}
    </div>
  );
}
