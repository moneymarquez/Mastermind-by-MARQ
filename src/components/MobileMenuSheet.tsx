import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { NavRow } from '../navRows';
import Icon from '../Icon';
import { LIVE_PLAN } from '../billing/plans';
import type { Skin, Theme } from '../data/useTheme';
import InboxWidget from './InboxWidget';
import type { InboxItem } from '../data/useOwnerInbox';
import LeadsWidget from './LeadsWidget';
import type { LeadItem } from '../data/useLeads';
import { SAFE_BOTTOM } from './MobileTabBar';
import { useAvatar } from '../data/useAvatar';

interface Props {
  open: boolean;
  rows: NavRow[];
  ownerName: string | null;
  isOwner: boolean;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  skin: Skin;
  onSkinChange: (next: Skin) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenTour: () => void;
  leads: LeadItem[];
  leadsNewCount: number;
  leadsLoading: boolean;
  onOpenLead: (lead?: LeadItem) => void;
  inboxItems: InboxItem[];
  inboxLoading: boolean;
  onOpenInbox: (item?: InboxItem) => void;
}

// A dismiss past this fraction of the sheet's own height always commits to
// closing, regardless of how slowly it was dragged there.
const DISMISS_HEIGHT_FRACTION = 0.25;
// A downward release faster than this (px/ms) commits to closing even if
// the drag never reached the height threshold — a quick flick reads as
// "get rid of it," not "peek at what's underneath."
const DISMISS_VELOCITY = 0.5;
// Not a real spring simulation (no physics lib in this codebase) — a
// back-out cubic-bezier reads as "springy" (slight overshoot then
// settle) for the cancelled-drag snap-back, which is what "spring, not
// linear ease" is actually asking for here. The commit-to-close case
// uses a plain deceleration curve instead: it's leaving the screen, an
// overshoot bounce on the way out would just look like a stutter.
const SPRING_BACK_TRANSITION = 'transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)';
const DISMISS_TRANSITION = 'transform 0.22s cubic-bezier(0.32, 0, 0.67, 0)';
const DISMISS_DURATION_MS = 220;

/** Mobile's nav surface — the "02 — Menu sheet" artboard: a scrim, a
 *  bottom sheet with a drag handle, a Menu header with an inline theme
 *  toggle, the same real NavRow[] Sidebar.tsx renders on desktop, and an
 *  account footer. Replaces the old top-right dropdown NavDrawer/floating
 *  Logo, both deleted — Sidebar.tsx covers desktop, this covers mobile,
 *  and nothing else referenced either component.
 *
 *  The row list is the one thing in this sheet with unbounded height (the
 *  real nav has 25+ items across every category, versus the artboard's
 *  illustrative dozen) — `flex: 1, minHeight: 0` on it plus `overflow:
 *  hidden` on the sheet itself is what makes it the ONLY thing that
 *  scrolls, with the handle/header above and the account footer below
 *  always staying on screen. Without minHeight: 0 a flex child ignores
 *  its parent's maxHeight and just grows past it — which is what was
 *  clipping the footer and the last few rows off the bottom of the
 *  screen before this fix.
 *
 *  Drag-to-dismiss lives entirely in this component's own transform, not
 *  in the `open` prop — dragging translates the sheet, and only a real
 *  commit (past the height/velocity threshold) calls onClose. A cancelled
 *  drag never touches the parent at all, it just springs back to 0. */
export default function MobileMenuSheet({
  open, rows, ownerName, isOwner, theme, onThemeChange, skin, onSkinChange, onClose, onOpenSettings, onOpenTour,
  leads, leadsNewCount, leadsLoading, onOpenLead,
  inboxItems, inboxLoading, onOpenInbox,
}: Props) {
  const { avatarUrl } = useAvatar();
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number; active: boolean; pointerId: number } | null>(null);
  // Set the moment a drag actually moves the sheet, and consumed by the
  // capture-phase click handler below: a finger that dragged the sheet
  // down over a nav row must not also "tap" that row on release.
  const moved = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [listAtTop, setListAtTop] = useState(true);

  // This component stays mounted with open=false (it renders null, it
  // doesn't unmount), so drag state SURVIVES a close. Before this reset,
  // a swipe-dismiss left dismissing=true and dragY=sheetHeight behind —
  // and the next open rendered the sheet already translated off the
  // bottom of the screen: scrim up, nothing under it, and the only way
  // out was tapping the dimmed page. That is the "sometimes it bugs out"
  // bug. Every open now starts from zero, and a pending close timer from
  // a dismiss that got cut short is cancelled rather than firing into the
  // reopened sheet.
  useEffect(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    drag.current = null;
    moved.current = false;
    setDragY(0);
    setDragging(false);
    setDismissing(false);
    setListAtTop(true);
  }, [open]);

  if (!open) return null;

  /** Where a pointer can start a dismiss.
   *
   *  Anywhere on the sheet — not just the handle — with one rule borrowed
   *  from native iOS sheets: inside the scrolling nav list, a downward drag
   *  only dismisses when the list is already at its top. Otherwise the list
   *  scrolls, exactly as before. The handle-only zone this replaces was a
   *  ~60px strip, which is why the sheet was "hard to slide down". */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dismissing) return;
    const list = listRef.current;
    if (list && list.contains(e.target as Node) && list.scrollTop > 0) return;
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0, active: false, pointerId: e.pointerId };
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      // Upward from the top of the list is a scroll, not a dismiss — hand
      // it back to the browser (the list's touch-action lets it pan up).
      if (dy < -4) { drag.current = null; return; }
      if (dy < 4) return; // finger jitter, not a decision yet
      d.active = true;
      moved.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture?.(d.pointerId);
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    setDragY(Math.max(0, dy));
  };

  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    setDragging(false);
    const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
    const pastThreshold = sheetHeight > 0 && dragY > sheetHeight * DISMISS_HEIGHT_FRACTION;
    if (pastThreshold || d.velocity > DISMISS_VELOCITY) {
      setDismissing(true);
      setDragY(sheetHeight || window.innerHeight);
      closeTimer.current = window.setTimeout(() => { closeTimer.current = null; onClose(); }, DISMISS_DURATION_MS);
    } else {
      setDragY(0);
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!moved.current) return;
    moved.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 48, background: 'var(--scrim-sheet)', touchAction: 'none' }} onClick={onClose} />
      <div
        ref={sheetRef}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 49, maxHeight: '94%', overflow: 'hidden',
          borderRadius: '28px 28px 0 0', background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(var(--shadow-ink),0.4)',
          padding: `8px 18px calc(18px + ${SAFE_BOTTOM})`,
          display: 'flex', flexDirection: 'column',
          transform: `translateY(${dragY}px)`,
          // Always transitioned except mid-drag (where it must follow the
          // finger with zero lag) — on a cancelled drag this is what
          // animates dragY's snap back to 0, and a transition on an
          // already-settled transform (initial mount, dragY already 0) is
          // simply a no-op, so there's no need to special-case it away.
          transition: dragging ? 'none' : dismissing ? DISMISS_TRANSITION : SPRING_BACK_TRANSITION,
          // Constant, so it plays exactly once when the sheet mounts. It
          // used to toggle to 'none' during a drag and back afterwards,
          // which re-ran the entrance animation on every cancelled drag —
          // a visible flicker each time the sheet snapped back.
          animation: 'drawerIn 0.16s ease',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {/* Draggable header zone — handle + Menu title row. Grabbing
            anywhere here (not just the pill) starts a drag; the nav list
            and status cards below are excluded so normal taps/scrolling
            inside them isn't hijacked. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, cursor: 'grab', touchAction: 'none', paddingTop: 6 }}>
          <div style={{ width: 44, height: 5, borderRadius: 4, background: 'var(--mm-line2)', alignSelf: 'center' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>Menu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div
                title="Toggle theme"
                onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 999, border: '1px solid var(--mm-line2)', fontSize: 12.5, color: 'var(--mm-dim)', cursor: 'pointer' }}
              >
                <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} />
                {theme === 'dark' ? 'Dark' : 'Light'}
              </div>
              <div
                title={skin === 'cyberpunk' ? 'Switch to the Simple theme' : 'Switch to the Cyberpunk theme'}
                onClick={() => onSkinChange(skin === 'cyberpunk' ? 'simple' : 'cyberpunk')}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--mm-line2)', color: skin === 'cyberpunk' ? 'var(--neon-blue)' : 'var(--mm-dim)', cursor: 'pointer', flexShrink: 0 }}
              >
                <Icon name="lightning" size={15} />
              </div>
              <div
                title="Take the product tour"
                onClick={() => { onOpenTour(); onClose(); }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--mm-line2)', fontSize: 13, fontWeight: 700, color: 'var(--mm-dim)', cursor: 'pointer', flexShrink: 0 }}
              >
                ?
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, flexShrink: 0, touchAction: 'none' }}>
          {isOwner && <LeadsWidget leads={leads} newCount={leadsNewCount} loading={leadsLoading} onOpen={(lead) => { onOpenLead(lead); onClose(); }} compact />}
          {isOwner && <InboxWidget items={inboxItems} loading={inboxLoading} onOpen={(item) => { onOpenInbox(item); onClose(); }} compact />}
        </div>

        {/* touch-action is the whole trick here. At the top of the list,
            pan-up tells the browser it may scroll the list natively for
            an upward finger but must NOT claim a downward one — so the
            downward drag reaches onPointerMove and moves the sheet instead
            of rubber-banding an already-topped-out list. Once scrolled,
            pan-y gives both directions back to native scrolling and
            onPointerDown declines to start a drag. overscroll-behavior
            contain stops a scroll from chaining into anything outside. */}
        <div
          ref={listRef}
          onScroll={(e) => setListAtTop(e.currentTarget.scrollTop <= 0)}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: listAtTop ? 'pan-up' : 'pan-y', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}
        >
          {rows.map((row, i) => {
            if (row.kind === 'header') {
              return (
                <div key={row.key} style={{ padding: i === 0 ? '10px 6px 8px' : '22px 6px 8px', fontSize: 9.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === 'sub') {
              return (
                <div key={row.key} style={{ padding: '11px 6px 11px 49px', fontSize: 14, color: 'var(--mm-dim)', cursor: row.onClick ? 'pointer' : 'default' }} onClick={() => { row.onClick?.(); onClose(); }}>
                  {row.label}
                </div>
              );
            }
            return (
              <div
                key={row.key}
                onClick={() => { row.onClick?.(); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, minHeight: 48, padding: '0 10px', borderRadius: 14, cursor: 'pointer',
                  background: row.active ? 'var(--mm-tile)' : 'transparent', fontSize: 15, fontWeight: row.active ? 500 : 400,
                  color: row.active ? 'var(--mm-text)' : 'var(--mm-dim)',
                }}
              >
                <span style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={row.icon!} size={19} />
                </span>
                {row.label}
                {row.collapsible && (
                  <Icon name="caret-down" size={12} color="var(--mm-faint)" style={{ marginLeft: 'auto', transform: row.expanded ? 'rotate(180deg)' : 'none' }} />
                )}
              </div>
            );
          })}
        </div>

        <div
          onClick={() => { onOpenSettings(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '14px 12px 12px', marginTop: 8, cursor: 'pointer', flexShrink: 0,
            borderTop: '1px solid var(--mm-line)', touchAction: 'none',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--mm-track)', flexShrink: 0 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerName ?? 'Account'}</div>
            <div style={{ fontSize: 11, color: 'var(--mm-faint)' }}>{isOwner ? 'Owner' : `${LIVE_PLAN.name} plan`}</div>
          </div>
          <Icon name="gear-six" size={18} color="var(--mm-faint)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
    </>
  );
}
