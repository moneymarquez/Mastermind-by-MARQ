import { forwardRef } from 'react';
import Icon from '../Icon';
import { useReminders } from '../data/useReminders';
import { dateStr } from '../data/time';

interface Props {
  isMobile: boolean;
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

const RemindersBox = forwardRef<HTMLDivElement, Props>(function RemindersBox({ isMobile }, ref) {
  const { reminders, loading } = useReminders();
  const visible = reminders.slice(0, 4);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', right: 20, bottom: 20, width: isMobile ? 180 : 210,
        background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: '14px 16px', zIndex: 20,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8A8F98', display: 'flex', alignItems: 'center' }}>
        <Icon name="bell" style={{ marginRight: 6 }} color="#8A8F98" />
        Reminders
      </div>
      {visible.map((r) => (
        <div key={r.id} style={{ fontSize: 12, color: '#C7CAD1', padding: '6px 0', borderTop: '1px solid #1c1e23' }}>
          {r.title} — {dueLabel(r.due_date)}
        </div>
      ))}
      {!loading && visible.length === 0 && (
        <div style={{ fontSize: 11.5, color: '#565b64', padding: '6px 0', borderTop: '1px solid #1c1e23' }}>Nothing due.</div>
      )}
    </div>
  );
});

export default RemindersBox;
