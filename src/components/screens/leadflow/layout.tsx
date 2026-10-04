import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModule } from '../../mm/Page';
import { NOVA_DOCK_W, TOP_BAR_H } from '../../shell/Shell';

/** How the record panel sits next to a table:
 *  side    — a 480px column beside the table (wide screens)
 *  overlay — floats over the table's right edge with a shadow (iPad)
 *  sheet   — full-screen sheet with Call pinned at the bottom (phone) */
export type RecordMode = 'side' | 'overlay' | 'sheet';

interface LfCtx { width: number; headerSlot: HTMLElement | null; phone: boolean }
export const LeadFlowCtx = createContext<LfCtx>({ width: 1200, headerSlot: null, phone: false });

export function useRecordMode(): RecordMode {
  const { width, phone } = useContext(LeadFlowCtx);
  if (phone || width <= 480) return 'sheet';
  // Side by side only when the table keeps its full width (about 1000px) next to the 480px panel.
  return width >= 1480 ? 'side' : 'overlay';
}
export const useLfPhone = () => useContext(LeadFlowCtx).phone;

/** The current tab's primary action, rendered in the page header. */
export function HeaderAction({ children }: { children: ReactNode }) {
  const { headerSlot } = useContext(LeadFlowCtx);
  return headerSlot ? createPortal(children, headerSlot) : null;
}

/** Table (or list) plus, when a lead is open, its record panel. */
export function WithRecord({ panel, children }: { panel: ReactNode | null; children: ReactNode }) {
  const mode = useRecordMode();
  const { device, novaOpen } = useModule();
  // A full-screen sheet shouldn't leave the page scrolled under it.
  useEffect(() => {
    if (mode !== 'sheet' || !panel) return;
    const el = document.getElementById('tour-content-panel');
    if (!el) return;
    const prev = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => { el.style.overflowY = prev; };
  }, [mode, panel]);

  if (!panel) return <>{children}</>;
  if (mode === 'side') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', margin: '-16px -24px -32px 0' }}>
        <div style={{ flex: 1, minWidth: 0, padding: '16px 24px 32px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        <aside style={{ width: 480, flex: 'none', position: 'sticky', top: 0, height: `calc(100dvh - ${TOP_BAR_H}px)`, borderLeft: '1px solid var(--lf-border)', background: 'var(--lf-surface)', display: 'flex', flexDirection: 'column' }}>{panel}</aside>
      </div>
    );
  }
  if (mode === 'overlay') {
    return (
      <>
        {children}
        <aside style={{ position: 'fixed', top: TOP_BAR_H, bottom: 0, right: device === 'desktop' && novaOpen ? NOVA_DOCK_W : 0, width: 'min(480px, 100%)', zIndex: 40, background: 'var(--lf-surface)', borderLeft: '1px solid var(--lf-border)', boxShadow: 'var(--lf-shadow)', display: 'flex', flexDirection: 'column' }}>{panel}</aside>
      </>
    );
  }
  return (
    <>
      {children}
      {createPortal(
        <div className="leadflow" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'var(--lf-surface)', paddingTop: 'env(safe-area-inset-top)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{panel}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Right-side form panel (Finder's Add lead): 420px, full screen on phone. */
export function SidePanel({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  const phone = useRecordMode() === 'sheet';
  const { device, novaOpen } = useModule();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return createPortal(
    <div className="leadflow">
      {!phone && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 119, background: 'transparent' }} />}
      <div role="dialog" aria-label={title} className="lf-record" style={{ position: 'fixed', zIndex: 120, top: phone ? 0 : TOP_BAR_H, bottom: 0, right: !phone && device === 'desktop' && novaOpen ? NOVA_DOCK_W : 0, width: phone ? '100%' : 420, background: 'var(--lf-surface)', borderLeft: '1px solid var(--lf-border)', boxShadow: 'var(--lf-shadow)', paddingTop: phone ? 'env(safe-area-inset-top)' : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--lf-border)' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
          <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onClose} aria-label="Close" style={{ fontSize: 18, color: 'var(--lf-text-tertiary)' }}>×</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--lf-border)' }}>{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Measures the LeadFlow root so layouts follow the space actually available
 *  (the Masterminds sidebar and Nova dock both eat into the viewport). */
export function useWidth(el: HTMLElement | null): number {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}
