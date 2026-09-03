import { forwardRef, useState } from 'react';
import Icon from '../Icon';
import { useReminders } from '../data/useReminders';
import { dateStr } from '../data/time';

interface Props {
  isMobile: boolean;
  /** Clears the fixed mobile tab bar (MobileTabBar.tsx) on mobile — a full
   *  CSS value (usually a calc() with env(safe-area-inset-bottom)) rather
   *  than a bare number, since the tab bar's own height grows by that same
   *  safe-area inset on notched devices; a plain px number here would sit
   *  the box too low, overlapping the tab bar. '20px' (the plain corner
   *  margin) everywhere else, including desktop. */
  bottomOffset?: string;
}

function dueLabel(dueDate: string): string {
  const today = dateStr(new Date());
  const tomorrow = dateStr(new Date(Date.now() + 86400000));
  if (dueDate === today) return 'due today';
  if (dueDate === tomorrow) return 'due tomorrow';
  const diffDays = Math.round((new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  if (diffDays > 0 && diffDays < 7) return `due ${new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}`;
  return `due ${new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const RemindersBox = forwardRef<HTMLDivElement, Props>(function RemindersBox({ isMobile, bottomOffset = '20px' }, ref) {
  const { reminders, loading } = useReminders();
  const visible = reminders.slice(0, 4);
  // Mobile only: collapsed by default. RemindersBox is position:absolute
  // pinned to the whole Stage, not the scrollable content panel beneath
  // it — so on a phone it permanently parks on top of whatever's in that
  // corner of the current screen, not just the very bottom of a long
  // scroll (that's what the content panel's extra bottom padding already
  // handles). A screen whose actions happen to land there — e.g. an
  // invoice's Send/Duplicate row — gets covered outright. Desktop has the
  // room to leave it open; only mobile needs the collapse.
  const [expanded, setExpanded] = useState(false);
  const collapsed = isMobile && !expanded;

  // ONE outer element for both states. Stage.tsx measures this box with a
  // ResizeObserver attached once (on mount / isMobile change) and sizes
  // the content panel's bottom padding — and Nova's stacking offset —
  // from it. When collapsed and expanded were two different DOM nodes,
  // tapping the bell swapped the node out from under the observer, so
  // the padding stayed sized for the 44px bell while the open panel was
  // ~180px tall: the bottom of every long screen (Brand Lab's New Brief
  // form first) sat underneath it. Same node, swapped contents, keeps
  // the observer alive across the toggle.
  return (
    <div
      ref={ref}
      onClick={collapsed ? () => setExpanded(true) : undefined}
      style={collapsed
        ? {
            position: 'absolute', right: 20, bottom: bottomOffset, width: 44, height: 44, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)', zIndex: 20, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }
        : {
            position: 'absolute', right: 20, bottom: bottomOffset, width: isMobile ? 180 : 210,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '14px 16px', zIndex: 20, boxSizing: 'border-box',
          }}
    >
      {collapsed ? (
        <>
          <Icon name="bell" color="var(--text-secondary)" />
          {!loading && reminders.length > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
              background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {reminders.length > 9 ? '9+' : reminders.length}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Icon name="bell" style={{ marginRight: 6 }} color="var(--text-secondary)" />
              Reminders
            </span>
            {isMobile && (
              <span onClick={() => setExpanded(false)} style={{ cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--text-body)', lineHeight: 1 }}>✕</span>
            )}
          </div>
          {visible.map((r) => (
            <div key={r.id} style={{ fontSize: 'var(--text-small)', color: 'var(--text-quaternary)', padding: '6px 0', borderTop: '1px solid var(--surface-3)' }}>
              {r.title} — {dueLabel(r.due_date)}
            </div>
          ))}
          {!loading && visible.length === 0 && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', padding: '6px 0', borderTop: '1px solid var(--surface-3)' }}>Nothing due.</div>
          )}
        </>
      )}
    </div>
  );
});

export default RemindersBox;
