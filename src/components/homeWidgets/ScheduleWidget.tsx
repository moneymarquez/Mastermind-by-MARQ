import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { useCallOutcomes, DAILY_CALL_GOAL } from '../../data/useCallOutcomes';
import { dateStr, formatTimeLabel } from '../../data/time';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';

/** Today's events + the last-7-days dial pace bar chart, stacked — kept
 *  together as one widget (not split further) since that's exactly how
 *  they rendered before the widget system existed; splitting them into
 *  two independently-orderable widgets is a later call, not this pass. */
export default function ScheduleWidget({ onNavigate }: HomeWidgetProps) {
  const { events, loading: eventsLoading } = useEvents();
  const { contacts, loading: contactsLoading } = useContacts();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const { todayCount, history, loading: outcomesLoading } = useCallOutcomes(dialingContacts);

  const today = dateStr(new Date());
  const todayEvents = events
    .filter((e) => e.event_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const dialBars = [...history].slice(0, 7).reverse();
  const dialBarMax = Math.max(DAILY_CALL_GOAL, ...dialBars.map((d) => d.total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ ...cardShell, padding: 20, gap: 10, flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Today</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          {eventsLoading && <div style={{ color: 'var(--mm-faint)' }}>Loading…</div>}
          {!eventsLoading && todayEvents.length === 0 && <div style={{ color: 'var(--mm-faint)' }}>Nothing on the calendar today.</div>}
          {todayEvents.map((e) => (
            <div
              key={e.id}
              onClick={() => onNavigate('schedule')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, background: 'var(--mm-tile)', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', width: 46, flexShrink: 0, color: 'var(--mm-faint)' }}>{formatTimeLabel(e.start_time)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || e.type}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...cardShell, padding: '18px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Dial pace</div>
          <div style={{ fontSize: 11.5, color: 'var(--mm-faint)' }}>
            {outcomesLoading || contactsLoading ? '—' : `${todayCount}/${DAILY_CALL_GOAL} today`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 52 }}>
          {dialBars.length === 0 && !outcomesLoading && (
            <div style={{ fontSize: 12, color: 'var(--mm-faint)' }}>No calls logged yet.</div>
          )}
          {dialBars.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.total} calls`}
              style={{ flex: 1, height: `${Math.max(6, Math.round((d.total / dialBarMax) * 100))}%`, borderRadius: 3, background: d.total >= DAILY_CALL_GOAL ? 'var(--mm-text)' : 'var(--mm-track)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
