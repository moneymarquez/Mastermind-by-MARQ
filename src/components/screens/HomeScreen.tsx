import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useSobriety } from '../../data/useSobriety';
import { useMacros } from '../../data/useMacros';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { useFitness } from '../../data/useFitness';
import { useCallOutcomes, DAILY_CALL_GOAL } from '../../data/useCallOutcomes';
import { dateStr, formatTimeLabel } from '../../data/time';

interface StatCard {
  icon: string;
  value: string;
  caption: string;
  valueStyle: CSSProperties;
}

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  statGridStyle: CSSProperties;
  statCards: StatCard[];
  onOpenNova: () => void;
  assistantName: string;
}

export default function HomeScreen({ homeHeadStyle, homeSubStyle, statGridStyle, statCards, onOpenNova, assistantName }: Props) {
  const { streak, loading: sobrietyLoading } = useSobriety();
  const { totals, loading: macrosLoading } = useMacros();
  const { events, loading: eventsLoading } = useEvents();
  const { contacts, loading: contactsLoading } = useContacts();
  const { weekCount, loading: fitnessLoading } = useFitness();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const leadContacts = contacts.filter((c) => c.source === 'scalez');
  const { todayCount, loading: outcomesLoading } = useCallOutcomes(dialingContacts);

  const today = dateStr(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const todayEvents = events
    .filter((e) => e.event_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const next = events
    .filter((e) => e.event_date > today || (e.event_date === today && e.start_time >= `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`))
    .sort((a, b) => (a.event_date === b.event_date ? a.start_time.localeCompare(b.start_time) : a.event_date.localeCompare(b.event_date)))[0];
  const nextLabel = !next
    ? 'Nothing yet'
    : next.event_date === today
    ? formatTimeLabel(next.start_time)
    : new Date(`${next.event_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const cards = statCards.map((card) => {
    if (card.caption === "Today's call goal") {
      return { ...card, value: contactsLoading || outcomesLoading ? '—' : `${todayCount} / ${DAILY_CALL_GOAL}` };
    }
    if (card.caption === 'Sobriety streak') {
      return { ...card, value: sobrietyLoading ? '—' : `${streak} day${streak === 1 ? '' : 's'}` };
    }
    if (card.caption === 'Workouts this week') {
      return { ...card, value: fitnessLoading ? '—' : `${weekCount}` };
    }
    if (card.caption === "Today's macros") {
      return { ...card, value: macrosLoading ? '—' : `${totals.calories} kcal` };
    }
    if (card.caption === 'Leads in pipeline') {
      return { ...card, value: contactsLoading ? '—' : `${leadContacts.length}` };
    }
    if (card.caption === 'Next on schedule') {
      return { ...card, value: eventsLoading ? '—' : nextLabel };
    }
    return card;
  });

  return (
    <div>
      <div style={homeHeadStyle}>Welcome back, Cristopher</div>
      <div style={homeSubStyle}>Here's where things stand today.</div>
      <div style={statGridStyle}>
        {cards.map((card, i) => (
          <div key={i} style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, position: 'relative', minWidth: 0 }}>
            <Icon name={card.icon} size={18} color="#565b64" style={{ position: 'absolute', top: 16, right: 16 }} />
            <div style={card.valueStyle}>{card.value}</div>
            <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 6 }}>{card.caption}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7', marginTop: 32, marginBottom: 12 }}>Today's schedule</div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
        {todayEvents.map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: '#8A8F98', minWidth: 64 }}>{formatTimeLabel(e.start_time)}</div>
            <div style={{ fontSize: 13.5, color: '#c8cad0' }}>{e.notes || e.type}</div>
          </div>
        ))}
        {!eventsLoading && todayEvents.length === 0 && (
          <div style={{ padding: '16px 20px', fontSize: 13, color: '#565b64', background: '#101114' }}>Nothing on the calendar today.</div>
        )}
      </div>

      <div
        onClick={onOpenNova}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, padding: '14px 18px', borderRadius: 12,
          background: '#14161A', border: '1px solid #22262B', cursor: 'pointer', maxWidth: 420,
        }}
      >
        <Icon name="sparkle" size={16} color="#C9A24B" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Ask {assistantName}</div>
          <div style={{ fontSize: 11.5, color: '#8A8F98', marginTop: 1 }}>Anything about today, or anywhere else in the app.</div>
        </div>
      </div>
    </div>
  );
}
