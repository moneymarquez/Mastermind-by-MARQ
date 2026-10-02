import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import '../shell/shell.css';
import type { Device } from '../shell/Shell';
import { GChevronLeft, GClose, GNova, GPlus } from '../shell/glyphs';
import { api } from '../../lib/api';

/** Shared frame for every module screen (design handoff: MM Phone / MM Wide).
 *  Stage provides the context; module screens read device, Nova and AI state
 *  from it instead of threading props. */

export type ModuleCtxValue = {
  device: Device;
  novaOpen: boolean;
  isOwner: boolean;
  nav: (screen: string) => void;
  askNova: (prompt?: string) => void;
};
const Ctx = createContext<ModuleCtxValue>({ device: 'phone', novaOpen: false, isOwner: false, nav: () => {}, askNova: () => {} });
export const ModuleProvider = Ctx.Provider;
export const useModule = () => useContext(Ctx);

// One status read per session. null = unknown (worker unreachable).
let aiCache: boolean | null | undefined;
const aiWaiters = new Set<(v: boolean | null) => void>();
/** Is an AI provider funded on the worker? Drives every "AI not connected" state. */
export function useAi(): boolean | null {
  const [v, setV] = useState<boolean | null>(aiCache ?? null);
  useEffect(() => {
    if (aiCache !== undefined) return;
    aiWaiters.add(setV);
    if (aiWaiters.size === 1) {
      api<{ anthropic?: boolean }>('/api/engine/status').then((r) => {
        aiCache = r.error ? null : !!r.anthropic;
        for (const w of aiWaiters) w(aiCache);
        aiWaiters.clear();
      });
    }
    return () => { aiWaiters.delete(setV); };
  }, []);
  return v;
}

export type PageAction = { t: string; onClick: () => void; danger?: boolean };

function Menu({ items, onClose }: { items: PageAction[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', h));
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className="mm-anim" style={{ position: 'absolute', right: 0, top: 46, zIndex: 40, minWidth: 200, padding: 6, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,.35)', animation: 'mmPanelIn .14s ease' }}>
      {items.map((it) => (
        <button key={it.t} role="menuitem" className="mm-search-row" style={{ height: 40, color: it.danger ? 'var(--danger)' : 'var(--text)' }} onClick={() => { onClose(); it.onClick(); }}>{it.t}</button>
      ))}
    </div>
  );
}

const iconBtn: CSSProperties = { width: 40, height: 40 };

/** Module page: phone gets the back row (All modules · Ask Nova · ⋯), then
 *  the 24px title; wide gets the 28px title with actions on the right.
 *  `fab` is the module's primary action: a floating button on phone, the
 *  primary header button on wide. `more` is a full view opened from ⋯. */
export function Page({ title, sub, back = 'All modules', backTo = 'modules', right, fab, menu = [], more, children, client }: {
  title: ReactNode; sub?: ReactNode; back?: string; backTo?: string;
  right?: { t: string; onClick: () => void }; fab?: { t: string; onClick: () => void };
  menu?: PageAction[]; more?: { label: string; render: () => ReactNode }; children: ReactNode; client?: boolean;
}) {
  const { device, nav, askNova } = useModule();
  const phone = device === 'phone';
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const items = [...menu, ...(more ? [{ t: more.label, onClick: () => setMoreOpen(true) }] : [])];
  const dots = items.length > 0 && (
    <div style={{ position: 'relative' }}>
      <button aria-label="More" aria-haspopup="menu" aria-expanded={menuOpen} className="mm-icon-btn" style={iconBtn} onClick={() => setMenuOpen((v) => !v)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </button>
      {menuOpen && <Menu items={items} onClose={() => setMenuOpen(false)} />}
    </div>
  );
  const accentBtn = client ? { background: 'var(--client-accent)', borderColor: 'var(--client-accent)' } : {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 0 : 20, minWidth: 0 }}>
      {phone && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 14px' }}>
          <button onClick={() => nav(backTo)} style={{ display: 'flex', alignItems: 'center', gap: 2, height: 40, marginLeft: -6, padding: 0, border: 0, background: 'transparent', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
            <GChevronLeft size={22} />{back}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn" onClick={() => askNova()} style={{ height: 40, padding: '0 12px', fontSize: 13, fontWeight: 500 }}><GNova size={15} color="var(--accent)" fill />Ask Nova</button>
            {dots}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: phone ? 20 : 0, flexWrap: phone ? 'nowrap' : 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h1 style={{ margin: 0, color: 'var(--text)', fontSize: phone ? 24 : 28, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.15, textWrap: 'balance' } as CSSProperties}>{title}</h1>
          {sub && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>{sub}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
          {right && <button className="mm-btn" onClick={right.onClick} style={{ height: 34, borderRadius: 999, padding: '0 12px', fontSize: 13, fontWeight: 500 }}>{right.t}</button>}
          {!phone && fab && <button className="mm-btn mm-btn--primary" onClick={fab.onClick} style={accentBtn}><GPlus size={14} />{fab.t}</button>}
          {!phone && dots}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 20 : 16, minWidth: 0 }}>{children}</div>
      {phone && fab && (
        <button className="mm-btn mm-btn--primary" onClick={fab.onClick} style={{ position: 'fixed', right: 16, bottom: 'calc(84px + 16px + max(env(safe-area-inset-bottom), 0px))', zIndex: 50, height: 48, padding: '0 18px', fontSize: 15, boxShadow: '0 0 40px rgba(0,0,0,.25)', ...accentBtn }}>
          <GPlus size={16} />{fab.t}
        </button>
      )}
      {phone && fab && <div style={{ height: 64 }} />}
      {moreOpen && more && (
        <Sheet title={more.label} onClose={() => setMoreOpen(false)} full>
          {more.render()}
        </Sheet>
      )}
    </div>
  );
}

/** Bottom sheet on phone, centered dialog on wide. `full` = tall panel for whole views. */
export function Sheet({ title, onClose, children, full, width = 440 }: { title: string; onClose: () => void; children: ReactNode; full?: boolean; width?: number }) {
  const { device } = useModule();
  const phone = device === 'phone';
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const box: CSSProperties = phone
    ? { left: 0, right: 0, bottom: 0, top: full ? 'calc(24px + env(safe-area-inset-top))' : undefined, maxHeight: full ? undefined : '86vh', borderRadius: '16px 16px 0 0', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }
    : full
      ? { left: '50%', top: 40, bottom: 40, transform: 'translateX(-50%)', width: 'min(1100px, calc(100vw - 80px))', borderRadius: 16 }
      : { left: '50%', top: '14vh', transform: 'translateX(-50%)', width, maxHeight: '76vh', borderRadius: 16 };
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--mm-scrim, rgba(0,0,0,.5))' }} />
      <div role="dialog" aria-label={title} style={{ position: 'fixed', zIndex: 91, ...box, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--grid)', flex: 'none' }}>
          <span style={{ flex: 1, color: 'var(--text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{title}</span>
          <button aria-label="Close" className="mm-icon-btn" onClick={onClose} style={{ width: 34, height: 34 }}><GClose size={16} /></button>
        </div>
        <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </div>
    </>
  );
}

export const field: CSSProperties = { height: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minWidth: 0 };
export const area: CSSProperties = { ...field, height: 96, padding: '10px 12px', resize: 'vertical', lineHeight: 1.45 };
export const label: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' };

/** A labelled field row. */
export function Field({ l, children }: { l: string; children: ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={label}>{l}</span>{children}</label>;
}

export function NovaMark({ title = 'Nova' }: { title?: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" /></svg>{title}</div>;
}

/** "Not connected" chip used by the AI-off card. */
export function NotConnected() {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 6px', borderRadius: 999, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-3)', flex: 'none' }}><span style={{ width: 6, height: 6, borderRadius: '50%', border: '1.5px solid var(--text-tertiary)', boxSizing: 'border-box' }} />Not connected</span>;
}

/** MM States "AI not connected yet": Nova + chip, one sentence, Connect AI. */
export function AiOffCard({ text }: { text: string }) {
  const { nav, isOwner } = useModule();
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Nova</span><NotConnected /></div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{text}</p>
      {isOwner && <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => nav('setup')}>Connect AI</button>}
    </section>
  );
}

/** A Nova insight card. When AI is off it becomes the AI-off card instead;
 *  when there's nothing to say yet it renders nothing (never invents text). */
export function NovaCard({ title = 'Nova', paras, aiOff, actions }: { title?: string; paras: string[]; aiOff: string; actions?: ReactNode }) {
  const ai = useAi();
  if (ai === false) return <AiOffCard text={aiOff} />;
  if (!paras.length) return null;
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <NovaMark title={title} />
      {paras.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{p}</p>)}
      {actions}
    </section>
  );
}

/** Full-width row of equal buttons (check-in answers, quick picks). */
export function ChoiceRow({ options, onPick, value }: { options: string[]; onPick: (o: string) => void; value?: string | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length},1fr)`, gap: 8 }}>
      {options.map((o) => (
        <button key={o} className="mm-btn" onClick={() => onPick(o)} style={{ height: 42, fontSize: 14, fontWeight: 500, padding: '0 6px', ...(value === o ? { background: 'var(--surface-3)', borderColor: 'var(--text-tertiary)' } : {}) }}>{o}</button>
      ))}
    </div>
  );
}

export const btnRow: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
