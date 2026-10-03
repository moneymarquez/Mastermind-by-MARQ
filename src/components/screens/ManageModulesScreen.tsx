import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useModuleAccess } from '../../data/useModuleAccess';
import { MODULE_REGISTRY } from '../../modules.config';
import type { ModuleDef } from '../../modules.config';
import { MAX_PINS, readPins, writePins } from '../../data/homePins';
import { Page, field, useModule } from '../mm/Page';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  currentUserId: string;
  isOwner: boolean;
  /** Real access, the same function Stage.tsx gates screens with. */
  canAccess: (moduleKey: string) => boolean;
  hiddenModules: Set<string>;
  order: Record<string, number>;
  onToggleHidden: (moduleKey: string, hide: boolean) => void;
  onReorderCategory: (orderedModuleKeys: string[]) => void;
}

const CATEGORIES = ['Personal', 'Cold Calling', 'Clients', 'Scaling', 'Side Hustles'] as const;
const screenOf = (m: ModuleDef) => m.routes[0] as string;

/** Manage modules (design handoff: MM 1 System). Pinned to Home (max 4)
 *  on top, then every category as a list with a drag handle and an on/off
 *  switch. "On" means it shows in your menu: for the owner that's the
 *  cosmetic hidden flag (nav_module_prefs); for everyone else it's the
 *  real module selection (user_modules). Neither touches a module's data. */
export default function ManageModulesScreen({ currentUserId, isOwner, canAccess, hiddenModules, order, onToggleHidden, onReorderCategory }: Props) {
  const { device } = useModule();
  const phone = device === 'phone';
  const access = useModuleAccess(currentUserId, isOwner);
  const [busy, setBusy] = useState<string | null>(null);
  const [pins, setPins] = useState<string[]>(readPins);

  // Owner-only modules a non-owner wasn't granted never show here at all.
  const eligible = MODULE_REGISTRY.filter((m) => m.category && (isOwner || !m.ownerOnly || canAccess(m.key)));
  const isOn = (m: ModuleDef) => !hiddenModules.has(m.key) && (isOwner || access.enabledKeys.has(m.key) || (!!m.ownerOnly && canAccess(m.key)));

  const toggle = async (m: ModuleDef, on: boolean) => {
    if (isOwner || m.ownerOnly) { onToggleHidden(m.key, !on); return; }
    setBusy(m.key);
    const next = new Set(access.enabledKeys);
    if (on) next.add(m.key); else next.delete(m.key);
    await access.saveModuleSelections([...next]);
    if (on && hiddenModules.has(m.key)) onToggleHidden(m.key, false);
    setBusy(null);
  };

  const savePins = (next: string[]) => { setPins(next); writePins(next); };
  const byScreen = (id: string) => MODULE_REGISTRY.find((m) => screenOf(m) === id);
  const pinned = pins.map(byScreen).filter((m): m is ModuleDef => !!m && isOn(m));
  const pinnable = eligible.filter((m) => isOn(m) && !pins.includes(screenOf(m)));

  const pinCard = (
    <Group title="Pinned to Home" meta={`${pinned.length} of ${MAX_PINS}`}>
      {pinned.length ? (
        <DragList keys={pinned.map(screenOf)} onReorder={(keys) => savePins([...keys, ...pins.filter((p) => !keys.includes(p))])}
          row={(id) => { const m = byScreen(id)!; return <><Name n={m.label} d={m.category ?? ''} /><Switch label={`Pin ${m.label} to Home`} on onChange={() => savePins(pins.filter((p) => p !== id))} /></>; }} />
      ) : <div style={{ padding: '14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing pinned. Home skips the Pinned row.</div>}
      {pinned.length < MAX_PINS && pinnable.length > 0 && (
        <div style={{ padding: '10px 14px 14px', borderTop: pinned.length ? '1px solid var(--grid)' : 'none' }}>
          <select aria-label="Pin a module" value="" onChange={(e) => e.target.value && savePins([...pinned.map(screenOf), e.target.value])} style={{ ...field, height: 40 }}>
            <option value="">Pin a module…</option>
            {pinnable.map((m) => <option key={m.key} value={screenOf(m)}>{m.label}</option>)}
          </select>
        </div>
      )}
    </Group>
  );

  const categoryCards = CATEGORIES.map((cat) => {
    const items = eligible.filter((m) => m.category === cat)
      .map((m, i) => ({ m, natural: i }))
      .sort((a, b) => (order[a.m.key] ?? a.natural) - (order[b.m.key] ?? b.natural))
      .map(({ m }) => m);
    if (!items.length) return null;
    return (
      <Group key={cat} title={cat} meta={`${items.filter(isOn).length} of ${items.length} on`}>
        <DragList keys={items.map((m) => m.key)} onReorder={onReorderCategory}
          row={(key) => { const m = items.find((x) => x.key === key)!; const on = isOn(m); return <><Name n={m.label} d={m.requiresAI ? 'Uses Nova' : m.ownerOnly ? 'Owner only' : ''} dim={!on} /><Switch label={`Show ${m.label}`} on={on} disabled={busy === m.key || access.loading} onChange={(v) => void toggle(m, v)} /></>; }} />
      </Group>
    );
  }).filter(Boolean);

  const note = <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5, padding: '0 2px' }}>Turning a module off only takes it out of your menu. Its data stays, and switching it back on brings everything back.</div>;

  return (
    <Page title="Manage modules" sub="Drag to reorder. Pinned ones show on Home" back="Settings" backTo="account-settings">
      {phone ? <>{pinCard}{categoryCards}{note}</> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{pinCard}{categoryCards.slice(0, 1)}{note}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{categoryCards.slice(1)}</div>
        </div>
      )}
    </Page>
  );
}

function Group({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{meta}</span>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Name({ n, d, dim }: { n: string; d: string; dim?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: dim ? 'var(--text-secondary)' : 'var(--text)', fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
      {d && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{d}</span>}
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 999, flex: 'none', border: 0, padding: 0, cursor: disabled ? 'default' : 'pointer', position: 'relative', background: on ? 'var(--accent)' : 'var(--surface-3)', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: on ? '#fff' : 'var(--text-tertiary)', transition: 'left .15s ease' }} />
    </button>
  );
}

const Grip = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-tertiary)" aria-hidden><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>;

/** Pointer-driven reorder (mouse and touch alike) with arrow-key moves on
 *  the handle for keyboards. Commits once, on release. */
function DragList({ keys, onReorder, row }: { keys: string[]; onReorder: (keys: string[]) => void; row: (key: string) => ReactNode }) {
  const [preview, setPreview] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLDivElement>());
  const list = preview ?? keys;

  const move = (key: string, to: number) => {
    const next = list.filter((k) => k !== key);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, key);
    return next;
  };
  const onMove = (key: string, y: number) => {
    const others = list.filter((k) => k !== key);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = els.current.get(others[i])?.getBoundingClientRect();
      if (r && y < r.top + r.height / 2) { idx = i; break; }
    }
    const next = move(key, idx);
    if (next.join() !== list.join()) setPreview(next);
  };
  const end = () => {
    if (preview && preview.join() !== keys.join()) onReorder(preview);
    setPreview(null); setDragging(null);
  };

  return (
    <div>
      {list.map((key, i) => (
        <div key={key} ref={(el) => { if (el) els.current.set(key, el); else els.current.delete(key); }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 54, padding: '0 14px', borderTop: i ? '1px solid var(--grid)' : 'none', background: dragging === key ? 'var(--surface-2)' : 'transparent' }}>
          <button aria-label="Drag to reorder" title="Drag to reorder"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(key); }}
            onPointerMove={(e) => { if (dragging === key) onMove(key, e.clientY); }}
            onPointerUp={end} onPointerCancel={end}
            onKeyDown={(e) => { const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0; if (!d) return; e.preventDefault(); const to = i + d; if (to >= 0 && to < list.length) onReorder(move(key, to)); }}
            style={{ width: 28, height: 40, margin: '0 -6px', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: dragging === key ? 'grabbing' : 'grab', touchAction: 'none', flex: 'none' }}>
            <Grip />
          </button>
          {row(key)}
        </div>
      ))}
    </div>
  );
}
