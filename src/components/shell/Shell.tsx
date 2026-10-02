import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './shell.css';
import { GHome, GInbox, GNova, GGrid, GSun, GMoon, GSearch, GBell, GBolt, GChevron, GUpDown, GSliders, GLock } from './glyphs';
import type { ShellGroup } from './nav';
import Chip from '../mm/Chip';
import type { Notif, NotifGroup } from '../../data/useNotifications';
import { fmtAgo } from '../../data/useLeadFeed';
import { useAvatar } from '../../data/useAvatar';
import { demoLongPress } from '../../demo/longPress';

// ── Sizes (design handoff: App shell) ─────────────────────────────────
export type Device = 'phone' | 'ipad' | 'desktop';
export const deviceFor = (w: number): Device => (w < 768 ? 'phone' : w < 1280 ? 'ipad' : 'desktop');
export const PHONE_HEADER_H = 60;
export const PHONE_TAB_H = 84;
export const TOP_BAR_H = 56;
export const sidebarW = (d: Device) => (d === 'desktop' ? 248 : 232);
export const NOVA_DOCK_W = 360;
const SAFE_BOTTOM = 'max(env(safe-area-inset-bottom), 20px)';

export interface Badges { inbox: number; leads: number; urgent: boolean }

// ── Phone ─────────────────────────────────────────────────────────────
export function PhoneHeader({ dark, onToggleTheme, onSearch, onBell, bellDot, bellOpen }: { dark: boolean; onToggleTheme: () => void; onSearch: () => void; onBell: () => void; bellDot: boolean; bellOpen: boolean }) {
  return (
    <header style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 29, height: `calc(${PHONE_HEADER_H}px + env(safe-area-inset-top))`, padding: '0 16px 10px', paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <div {...demoLongPress} style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', WebkitTouchCallout: 'none' }}>
        <Logo size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>Masterminds</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5, fontWeight: 500 }}>by MARQ</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="mm-icon-btn" style={{ width: 40, height: 40 }} onClick={onToggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <GSun /> : <GMoon />}</button>
        <button className="mm-icon-btn" style={{ width: 40, height: 40 }} onClick={onSearch} aria-label="Search"><GSearch /></button>
        <button className="mm-icon-btn" data-on={bellOpen || undefined} style={{ width: 40, height: 40 }} onClick={onBell} aria-label="Notifications"><GBell />{bellDot && <Dot top={9} right={10} />}</button>
      </div>
    </header>
  );
}

export function PhoneTabBar({ screen, novaOpen, badges, onNav, onNova }: { screen: string; novaOpen: boolean; badges: Badges; onNav: (s: string) => void; onNova: () => void }) {
  const inboxCount = badges.inbox + badges.leads;
  const onModules = screen === 'modules' || (!['home', 'inbox', 'leads'].includes(screen) && !novaOpen);
  const tabs = [
    { key: 'home', label: 'Home', icon: <GHome size={22} />, active: screen === 'home' && !novaOpen, tap: () => onNav('home') },
    { key: 'inbox', label: 'Inbox', icon: <GInbox size={22} />, active: (screen === 'inbox' || screen === 'leads') && !novaOpen, tap: () => onNav('inbox'), badge: inboxCount },
    { key: 'nova', label: 'Nova', icon: <GNova size={22} />, active: novaOpen, tap: onNova },
    { key: 'modules', label: 'Modules', icon: <GGrid size={22} />, active: onModules && screen !== 'home', tap: () => onNav('modules') },
  ];
  return (
    <nav aria-label="Main" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 61, height: `calc(${PHONE_TAB_H - 20}px + ${SAFE_BOTTOM})`, background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', display: 'flex', padding: '8px 8px 0', boxSizing: 'border-box' }}>
      {tabs.map((t) => (
        <button key={t.key} className="mm-tab" onClick={t.tap} aria-current={t.active ? 'page' : undefined} aria-label={t.badge ? `${t.label}, ${t.badge} new` : t.label}>
          <span style={{ color: t.active ? 'var(--accent)' : 'var(--text-tertiary)', height: 22, display: 'flex', alignItems: 'center', position: 'relative' }}>
            {!!t.badge && <span style={{ position: 'absolute', top: -5, left: 13, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: badges.urgent ? 'var(--danger)' : 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>{t.badge > 99 ? '99+' : t.badge}</span>}
            {t.icon}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: t.active ? 'var(--text)' : 'var(--text-tertiary)' }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** The Modules tab: Settings row, then a 3-column grid per category.
 *  Owner-only modules show locked with an "Owner only" chip. */
export function ModulesGrid({ groups, onOpen }: { groups: ShellGroup[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}>Modules</h1>
      <button onClick={() => onOpen('account-settings')} className="mm-tile" style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, padding: '0 14px', gap: 10 }}>
        <span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>Settings</span>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Appearance, modules, billing</span>
        <GChevron size={16} color="var(--text-tertiary)" />
      </button>
      {groups.map((g) => (
        <section key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{g.title}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{g.items.length}{g.owner ? ' · owner' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {g.items.map((m) => (
              <button key={m.id} className="mm-tile" onClick={() => !m.locked && onOpen(m.id)} aria-disabled={m.locked || undefined} style={m.locked ? { cursor: 'default', opacity: 0.7 } : undefined}>
                <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>{m.locked ? <GLock size={14} /> : m.glyph}</span>
                <span style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.25 }}>{m.label}</span>
                {m.locked && <Chip k="lock">Owner only</Chip>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── iPad / desktop ────────────────────────────────────────────────────
export function AppSidebar({ device, screen, novaOpen, groups, badges, ownerName, isOwner, onNav, onNova, onSearch }: { device: Device; screen: string; novaOpen: boolean; groups: ShellGroup[]; badges: Badges; ownerName: string; isOwner: boolean; onNav: (s: string) => void; onNova: () => void; onSearch: () => void }) {
  const rowH = device === 'desktop' ? 34 : 40;
  const { avatarUrl } = useAvatar();
  const currentGroup = groups.find((g) => g.items.some((i) => i.id === screen))?.title;
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { const s = JSON.parse(localStorage.getItem('mm-sidebar-open') ?? 'null') as Record<string, boolean> | null; if (s) return s; } catch { /* default */ }
    return { Personal: true };
  });
  // The group holding the current module always opens.
  useEffect(() => { if (currentGroup && !open[currentGroup]) setOpen((o) => ({ ...o, [currentGroup]: true })); }, [currentGroup]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (t: string) => setOpen((o) => { const n = { ...o, [t]: !o[t] }; try { localStorage.setItem('mm-sidebar-open', JSON.stringify(n)); } catch { /* private mode */ } return n; });
  const top = [
    { id: 'home', l: 'Home', icon: <GHome size={17} />, active: screen === 'home' },
    { id: 'nova', l: 'Nova', icon: <GNova size={17} fill color="var(--accent)" />, active: novaOpen },
    { id: 'inbox', l: 'Inbox', icon: <GInbox size={17} />, active: screen === 'inbox', badge: badges.inbox, urgent: false },
    ...(isOwner ? [{ id: 'leads', l: 'Leads', icon: <GBolt size={17} />, active: screen === 'leads', badge: badges.leads, urgent: badges.urgent }] : []),
  ];
  return (
    <aside style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: sidebarW(device), zIndex: 30, background: 'var(--surface-2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 10px', boxSizing: 'border-box' }}>
      <div {...demoLongPress} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px', userSelect: 'none' }}>
        <Logo size={28} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em' }}>Masterminds</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11.5, fontWeight: 500 }}>by MARQ</span>
        </div>
        <GUpDown size={14} color="var(--text-tertiary)" />
      </div>
      <button onClick={onSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, height: rowH, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-tertiary)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
        <GSearch size={15} /><span style={{ flex: 1, textAlign: 'left' }}>Search</span>
        {device === 'desktop' && <Kbd>⌘K</Kbd>}
      </button>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, margin: '0 -4px', padding: '0 4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {top.map((n) => (
            <button key={n.id} className="mm-nav-row" data-active={n.active || undefined} aria-current={n.active ? 'page' : undefined} style={{ height: rowH }} onClick={() => (n.id === 'nova' ? onNova() : onNav(n.id))}>
              {n.icon}<span style={{ flex: 1 }}>{n.l}</span>
              {!!n.badge && <Badge n={n.badge} urgent={!!n.urgent} />}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groups.map((g) => (
            <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button className="mm-group-head" onClick={() => toggle(g.title)} aria-expanded={!!open[g.title]}>
                <GChevron size={12} style={{ transform: open[g.title] ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{g.title}</span>
                <span style={{ fontSize: 11.5 }}>{g.items.length}{g.owner ? ' · owner' : ''}</span>
              </button>
              {open[g.title] && g.items.map((m) => {
                const active = screen === m.id;
                return (
                  <button key={m.id} className="mm-nav-row" data-active={active || undefined} aria-current={active ? 'page' : undefined} style={{ height: rowH }} onClick={() => onNav(m.id)}>
                    <span style={{ width: 20, height: 20, flex: 'none', borderRadius: 6, background: active ? 'var(--accent)' : 'var(--surface-3)', color: active ? 'var(--bg)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, letterSpacing: '-0.02em' }}>{m.glyph}</span>
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, borderTop: '1px solid var(--grid)' }}>
        <button className="mm-nav-row" data-active={screen === 'account-settings' || undefined} style={{ height: rowH }} onClick={() => onNav('account-settings')}><GSliders size={17} />Settings</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 10px' }}>
          {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{initials(ownerName)}</span>}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
            <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{isOwner ? 'Owner' : 'Member'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppTopBar({ device, left, right, crumb, dark, novaOpen, bellDot, bellOpen, onToggleTheme, onSearch, onBell, onNova }: { device: Device; left: number; right: number; crumb: { group: string | null; label: string }; dark: boolean; novaOpen: boolean; bellDot: boolean; bellOpen: boolean; onToggleTheme: () => void; onSearch: () => void; onBell: () => void; onNova: () => void }) {
  const btn = device === 'desktop' ? 36 : 40;
  return (
    <header style={{ position: 'absolute', top: 0, left, right, height: TOP_BAR_H, zIndex: 29, display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 0 32px', boxSizing: 'border-box', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <nav aria-label="Breadcrumb" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, minWidth: 0 }}>
        {crumb.group && <><span style={{ color: 'var(--text-tertiary)' }}>{crumb.group}</span><GChevron size={12} color="var(--text-tertiary)" /></>}
        <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb.label}</span>
      </nav>
      {device === 'desktop' && (
        <button onClick={onSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-tertiary)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          <GSearch size={15} /><span style={{ flex: 1, textAlign: 'left' }}>Search everything</span><Kbd>⌘K</Kbd>
        </button>
      )}
      {device !== 'desktop' && <button className="mm-icon-btn" style={{ width: btn, height: btn }} onClick={onSearch} aria-label="Search"><GSearch size={17} /></button>}
      <button className="mm-icon-btn" style={{ width: btn, height: btn }} onClick={onToggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <GSun size={17} /> : <GMoon size={17} />}</button>
      <button className="mm-icon-btn" data-on={bellOpen || undefined} style={{ width: btn, height: btn }} onClick={onBell} aria-label="Notifications"><GBell size={17} />{bellDot && <Dot top={8} right={9} />}</button>
      <button className="mm-icon-btn" data-on={novaOpen || undefined} style={{ height: btn, padding: '0 12px', gap: 6, color: 'var(--text)', fontSize: 13.5, fontWeight: 500 }} onClick={onNova}><GNova size={15} fill color="var(--accent)" />Ask Nova</button>
    </header>
  );
}

// ── Notifications (bell) ──────────────────────────────────────────────
const NOTIF_GROUPS: NotifGroup[] = ['New leads', 'Inbox', 'Bills and deadlines', 'Clients'];
export function NotificationsPanel({ device, items, isRead, onOpen, onMarkAll, onClose, now }: { device: Device; items: Notif[]; isRead: (id: string) => boolean; onOpen: (n: Notif) => void; onMarkAll: () => void; onClose: () => void; now: number }) {
  const phone = device === 'phone';
  const panel: CSSProperties = phone
    ? { position: 'fixed', left: 8, right: 8, top: `calc(${PHONE_HEADER_H + 6}px + env(safe-area-inset-top))`, maxHeight: '70vh' }
    : { position: 'absolute', right: 16, top: TOP_BAR_H + 6, width: 384, maxHeight: 'min(640px, 80vh)' };
  return (
    <>
      <div onClick={onClose} style={{ position: phone ? 'fixed' : 'absolute', inset: 0, zIndex: 70, background: phone ? 'var(--mm-scrim)' : 'transparent' }} />
      <div role="dialog" aria-label="Notifications" className="mm-anim" style={{ ...panel, zIndex: 71, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px -18px rgba(0,0,0,.55)', animation: 'mmPanelIn .15s ease', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 14px 10px' }}>
          <span style={{ flex: 1, color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Notifications</span>
          {items.some((i) => !isRead(i.id)) && <button onClick={onMarkAll} style={{ border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>}
        </div>
        <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0, paddingBottom: 8 }}>
          {items.length === 0 && <div style={{ padding: '24px 14px', color: 'var(--text-tertiary)', fontSize: 14 }}>You're caught up. New leads, mail, bills due and client tickets show up here.</div>}
          {NOTIF_GROUPS.map((g) => {
            const list = items.filter((i) => i.group === g);
            if (!list.length) return null;
            return (
              <div key={g} style={{ paddingTop: 6 }}>
                <div style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{g}</div>
                {list.map((n) => (
                  <button key={n.id} className="mm-notif-item" onClick={() => onOpen(n)}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 7, flex: 'none', background: isRead(n.id) ? 'transparent' : 'var(--accent)' }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</span>
                      {n.chip && <span><Chip k={n.chip.kind}>{n.chip.text}</Chip></span>}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 'none' }}>{fmtAgo(n.at, now).replace(' ago', '')}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Search (⌘K) ───────────────────────────────────────────────────────
export function SearchPalette({ groups, onOpen, onClose }: { groups: ShellGroup[]; onOpen: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const all = useMemo(() => [
    { id: 'home', label: 'Home', group: '' }, { id: 'inbox', label: 'Inbox', group: '' }, { id: 'leads', label: 'Leads', group: '' }, { id: 'account-settings', label: 'Settings', group: '' },
    ...groups.flatMap((g) => g.items.filter((i) => !i.locked).map((i) => ({ id: i.id, label: i.label, group: g.title }))),
  ], [groups]);
  const hits = all.filter((x) => !q.trim() || `${x.label} ${x.group}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12);
  const go = (i: number) => { const h = hits[i]; if (h) { onOpen(h.id); onClose(); } };
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--mm-scrim)' }} />
      <div role="dialog" aria-label="Search" className="mm-anim" style={{ position: 'fixed', zIndex: 81, left: '50%', top: 'max(12vh, calc(env(safe-area-inset-top) + 16px))', transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 32px))', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px -18px rgba(0,0,0,.6)', animation: 'mmPanelIn .15s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
          <GSearch size={17} color="var(--text-tertiary)" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Search modules"
            onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === 'Enter') go(sel); else if (e.key === 'Escape') onClose(); }}
            style={{ flex: 1, height: 52, border: 0, outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 16, fontFamily: 'inherit' }} />
          <Kbd>Esc</Kbd>
        </div>
        <div className="mm-scroll-y" style={{ maxHeight: '50vh', padding: 6 }}>
          {hits.map((h, i) => (
            <button key={h.id} className="mm-search-row" data-sel={i === sel || undefined} onMouseEnter={() => setSel(i)} onClick={() => go(i)}>
              <span style={{ flex: 1 }}>{h.label}</span>{h.group && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{h.group}</span>}
            </button>
          ))}
          {hits.length === 0 && <div style={{ padding: 14, fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing matches “{q}”.</div>}
        </div>
      </div>
    </>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────
export function Logo({ size = 30 }: { size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, flex: 'none', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: size * 0.42, fontWeight: 700, boxSizing: 'border-box' }}>M</span>;
}
function Kbd({ children }: { children: string }) { return <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>{children}</span>; }
function Dot({ top, right }: { top: number; right: number }) { return <span style={{ position: 'absolute', top, right, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid var(--bg)' }} />; }
export function Badge({ n, urgent }: { n: number; urgent: boolean }) {
  return <span style={{ minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, background: urgent ? 'var(--danger)' : 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n > 99 ? '99+' : n}</span>;
}
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'MM';
