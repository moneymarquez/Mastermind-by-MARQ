import { forwardRef } from 'react';
import Icon from '../Icon';
import { useReminders } from '../data/useReminders';
import { dateStr } from '../data/time';

interface Props {
  isMobile: boolean;
  /** Clears the fixed mobile tab bar (MobileTabBar.tsx) on mobile; 20 (the
   *  plain corner margin) everywhere else, including desktop. */
  bottomOffset?: number;
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

const RemindersBox = forwardRef<HTMLDivElement, Props>(function RemindersBox({ isMobile, bottomOffset = 20 }, ref) {
  const { reminders, loading } = useReminders();
  const visible = reminders.slice(0, 4);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 20, bottom: bottomOffset, width: isMobile ? 180 : 210,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '14px 16px', zIndex: 20,
      }}
    >
      <div style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
        <Icon name="bell" style={{ marginRight: 6 }} color="var(--text-secondary)" />
        Reminders
      </div>
      {visible.map((r) => (
        <div key={r.id} style={{ fontSize: 'var(--text-small)', color: 'var(--text-quaternary)', padding: '6px 0', borderTop: '1px solid var(--surface-3)' }}>
          {r.title} — {dueLabel(r.due_date)}
        </div>
      ))}
      {!loading && visible.length === 0 && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', padding: '6px 0', borderTop: '1px solid var(--surface-3)' }}>Nothing due.</div>
      )}
    </div>
  );
});

export default RemindersBox;
