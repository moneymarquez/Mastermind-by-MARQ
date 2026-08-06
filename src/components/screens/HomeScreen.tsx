import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useSobriety } from '../../data/useSobriety';
import { useMacros } from '../../data/useMacros';
import { useEvents } from '../../data/useEvents';
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
}

export default function HomeScreen({ homeHeadStyle, homeSubStyle, statGridStyle, statCards }: Props) {
  const { streak, loading: sobrietyLoading } = useSobriety();
  const { totals, loading: macrosLoading } = useMacros();
  const { events, loading: eventsLoading } = useEvents();

  const today = dateStr(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const next = events
    .filter((e) => e.event_date > today || (e.event_date === today && e.start_time >= `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`))
    .sort((a, b) => (a.event_date === b.event_date ? a.start_time.localeCompare(b.start_time) : a.event_date.localeCompare(b.event_date)))[0];
  const nextLabel = !next
    ? 'Nothing yet'
    : next.event_date === today
    ? formatTimeLabel(next.start_time)
    : new Date(`${next.event_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const cards = statCards.map((card) => {
    if (card.caption === 'Sobriety streak') {
      return { ...card, value: sobrietyLoading ? '—' : `${streak} day${streak === 1 ? '' : 's'}` };
    }
    if (card.caption === "Today's macros") {
      return { ...card, value: macrosLoading ? '—' : `${totals.calories} kcal` };
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
    </div>
  );
}
