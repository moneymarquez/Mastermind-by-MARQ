import type { NavRow } from '../navRows';
import Icon from '../Icon';
import { LIVE_PLAN } from '../billing/plans';
import type { Theme } from '../data/useTheme';
import InboxWidget from './InboxWidget';
import type { SupportInboxEntry } from '../data/useSupportInbox';

interface Props {
  open: boolean;
  rows: NavRow[];
  ownerName: string | null;
  isOwner: boolean;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenTour: () => void;
  inboxEntries: SupportInboxEntry[];
  inboxLoading: boolean;
  onOpenInbox: () => void;
}

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
 *  screen before this fix. */
export default function MobileMenuSheet({ open, rows, ownerName, isOwner, theme, onThemeChange, onClose, onOpenSettings, onOpenTour, inboxEntries, inboxLoading, onOpenInbox }: Props) {
  if (!open) return null;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 48, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 49, maxHeight: '82%', overflow: 'hidden',
          borderRadius: '28px 28px 0 0', background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.4)', padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 14, animation: 'drawerIn 0.16s ease',
        }}
      >
        <div style={{ width: 44, height: 4, borderRadius: 4, background: 'var(--mm-line2)', alignSelf: 'center', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}>Menu</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <div
              title="Toggle theme"
              onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px', borderRadius: 999, border: '1px solid var(--mm-line2)', fontSize: 12.5, color: 'var(--mm-dim)', cursor: 'pointer' }}
            >
              <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} />
              {theme === 'dark' ? 'Dark' : 'Light'}
            </div>
            <div title="Take the product tour" onClick={() => { onOpenTour(); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--mm-line2)', fontSize: 13, fontWeight: 700, color: 'var(--mm-dim)', cursor: 'pointer', flexShrink: 0 }}>?</div>
          </div>
        </div>

        {isOwner && <InboxWidget entries={inboxEntries} loading={inboxLoading} onOpen={() => { onOpenInbox(); onClose(); }} compact />}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((row) => {
            if (row.kind === 'header') {
              return (
                <div key={row.key} style={{ padding: '8px 4px 6px', fontSize: 9.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === 'sub') {
              return (
                <div key={row.key} style={{ padding: '10px 4px 10px 38px', fontSize: 14, color: 'var(--mm-dim)', cursor: row.onClick ? 'pointer' : 'default' }} onClick={() => { row.onClick?.(); onClose(); }}>
                  {row.label}
                </div>
              );
            }
            return (
              <div
                key={row.key}
                onClick={() => { row.onClick?.(); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, height: 46, padding: '0 12px', borderRadius: 14, cursor: 'pointer',
                  background: row.active ? 'var(--mm-tile)' : 'transparent', fontSize: 15, fontWeight: row.active ? 500 : 400,
                  color: row.active ? 'var(--mm-text)' : 'var(--mm-dim)',
                }}
              >
                <Icon name={row.icon!} size={19} />
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
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 16, background: 'var(--mm-tile)', cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--mm-track)', flexShrink: 0 }} />
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
