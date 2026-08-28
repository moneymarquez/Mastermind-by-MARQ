import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useSobriety } from '../../data/useSobriety';
import { useMacros } from '../../data/useMacros';
import { useEvents } from '../../data/useEvents';
import { useContacts } from '../../data/useContacts';
import { useFitness } from '../../data/useFitness';
import { useCallOutcomes, DAILY_CALL_GOAL } from '../../data/useCallOutcomes';
import { useNudges } from '../../data/useNudges';
import { dateStr, formatTimeLabel } from '../../data/time';

interface StatCard {
  icon: string;
  value: string;
  caption: string;
  valueStyle: CSSProperties;
}

interface Props {
  isMobile: boolean;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  statGridStyle: CSSProperties;
  statCards: StatCard[];
  onOpenNova: () => void;
  assistantName: string;
  onNavigate: (screen: string) => void;
}

const tile: CSSProperties = { padding: 17, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9, position: 'relative', minWidth: 0 };
const cardShell: CSSProperties = { borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The Overview screen's content, restyled to the Aperture "App Overview"
 *  artboard's 5-tile-row + 3-column body — but every number in it is real:
 *  the reference's fabricated "sleep dropped your close rate 22%" insight
 *  and invented day-over-day dial bars are replaced with this app's actual
 *  hooks (useCallOutcomes' real history, useMacros' real totals/target,
 *  useNudges' real proactive nudges). Where this app has no live signal
 *  for something the reference shows (a specific personalized Nova
 *  insight), the panel prompts the user into Nova instead of inventing
 *  one. */
export default function HomeScreen({ isMobile, homeHeadStyle, homeSubStyle, statCards, onOpenNova, assistantName, onNavigate }: Props) {
  const { nudges, dismiss: dismissNudge } = useNudges();
  const { streak, loading: sobrietyLoading } = useSobriety();
  const { totals, nutritionTarget, todayMeals, loading: macrosLoading } = useMacros();
  const { events, loading: eventsLoading } = useEvents();
  const { contacts, loading: contactsLoading } = useContacts();
  const { weekCount, loading: fitnessLoading } = useFitness();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const leadContacts = contacts.filter((c) => c.source === 'scalez');
  const { todayCount, history, loading: outcomesLoading } = useCallOutcomes(dialingContacts);

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

  // Same caption-matched override the pre-redesign HomeScreen used —
  // vm.statCards (viewModel.ts) only supplies the icon/caption/placeholder
  // shell; every value shown here comes from the hooks above.
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

  const caloriesTarget = nutritionTarget?.daily_calories ?? null;
  const caloriesPct = caloriesTarget ? Math.min(100, Math.round((totals.calories / caloriesTarget) * 100)) : null;
  const macroBars = nutritionTarget
    ? [
        { label: 'Protein', have: totals.protein_g, of: nutritionTarget.daily_protein_g },
        { label: 'Carbs', have: totals.carbs_g, of: nutritionTarget.daily_carbs_g },
        { label: 'Fat', have: totals.fat_g, of: nutritionTarget.daily_fat_g },
      ]
    : [];

  // Last 7 real days from useCallOutcomes' history (already sorted newest
  // first) — reversed to read left-to-right, chronological.
  const dialBars = [...history].slice(0, 7).reverse();
  const dialBarMax = Math.max(DAILY_CALL_GOAL, ...dialBars.map((d) => d.total), 1);
  const todayVsGoalPct = Math.round((todayCount / DAILY_CALL_GOAL) * 100);

  const nudgeSummary = nudges.length > 0 ? `${nudges.length} thing${nudges.length === 1 ? '' : 's'} worth a look today.` : 'Nothing urgent — everything on track.';

  const kpiGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 9 : 11 }}>
      {cards.map((card, i) => {
        const isCallGoal = card.caption === "Today's call goal";
        const isMacros = card.caption === "Today's macros";
        const pct = isCallGoal ? Math.min(100, todayVsGoalPct) : isMacros ? caloriesPct : null;
        return (
          <div key={i} style={tile}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{card.caption}</div>
              <Icon name={card.icon} size={15} color="var(--text-tertiary)" />
            </div>
            <div style={card.valueStyle}>{card.value}</div>
            {pct !== null && (
              <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-4)' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 4, background: 'var(--text)' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const macrosCard = (
    <div style={{ ...cardShell, padding: 20, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Macros today</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {macrosLoading ? '—' : caloriesTarget ? `${totals.calories} / ${caloriesTarget} kcal` : `${totals.calories} kcal`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0, borderRadius: '50%', background: caloriesPct !== null ? `conic-gradient(var(--text) ${caloriesPct}%, var(--surface-4) 0)` : 'var(--surface-4)' }}>
          <div style={{ position: 'absolute', inset: 11, borderRadius: '50%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{caloriesPct !== null ? `${caloriesPct}%` : '—'}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>of target</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
          {macroBars.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No active nutrition target set.</div>
          ) : (
            macroBars.map((b) => (
              <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{b.label}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{Math.round(b.have)} / {b.of}g</span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: 'var(--surface-4)' }}>
                  <div style={{ width: `${Math.min(100, Math.round((b.have / b.of) * 100))}%`, height: '100%', borderRadius: 5, background: 'var(--text)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {todayMeals.slice(0, 2).map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, background: 'var(--surface-3)', fontSize: 12.5 }}>
            <Icon name="fork-knife" size={15} color="var(--text-tertiary)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.meal_type} — {m.restaurant_name || m.note || 'logged'}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', flexShrink: 0 }}>{m.calories ?? '—'}</span>
          </div>
        ))}
        <div onClick={() => onNavigate('macros')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, border: '1px dashed var(--border-2)', fontSize: 12.5, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
          <Icon name="plus" size={15} />Log a meal
        </div>
      </div>
    </div>
  );

  const scheduleCard = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ ...cardShell, padding: 20, gap: 10, flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Today</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          {eventsLoading && <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>}
          {!eventsLoading && todayEvents.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>Nothing on the calendar today.</div>}
          {todayEvents.map((e) => (
            <div
              key={e.id}
              onClick={() => onNavigate('schedule')}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, background: 'var(--surface-3)', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', width: 46, flexShrink: 0, color: 'var(--text-tertiary)' }}>{formatTimeLabel(e.start_time)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || e.type}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...cardShell, padding: '18px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Dial pace</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            {outcomesLoading || contactsLoading ? '—' : `${todayCount}/${DAILY_CALL_GOAL} today`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 52 }}>
          {dialBars.length === 0 && !outcomesLoading && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No calls logged yet.</div>
          )}
          {dialBars.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.total} calls`}
              style={{ flex: 1, height: `${Math.max(6, Math.round((d.total / dialBarMax) * 100))}%`, borderRadius: 3, background: d.total >= DAILY_CALL_GOAL ? 'var(--text)' : 'var(--surface-4)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const novaCard = (
    <div style={{ ...cardShell, background: 'var(--accent-soft)', border: 'none', padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>
        <Icon name="sparkle" size={16} />Nova
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text)' }}>
        Ask {assistantName} anything about today, or across any module you've turned on.
      </div>

      {nudges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nudges.slice(0, 3).map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div
                style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, cursor: n.target_screen ? 'pointer' : 'default' }}
                onClick={() => n.target_screen && onNavigate(n.target_screen)}
              >
                {n.message}
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); dismissNudge(n.id); }}>✕</span>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={onOpenNova}
        style={{ marginTop: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', borderRadius: 12, background: 'var(--text)', color: 'var(--bg)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
      >
        Open Nova<Icon name="arrow-right" size={16} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={homeHeadStyle}>{greeting()}.</div>
      <div style={homeSubStyle}>{nudgeSummary}</div>

      {isMobile ? (
        // Mobile ordering matches the reference's mobile overview: Nova
        // right under the greeting, then the short KPI grid, then macros,
        // then today's schedule — one column, no fixed-width columns that
        // would overflow a ~390px screen.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {novaCard}
          {kpiGrid}
          {macrosCard}
          {scheduleCard}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24 }}>{kpiGrid}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(280px, 340px)', gap: 12, marginTop: 18 }}>
            {macrosCard}
            {scheduleCard}
            {novaCard}
          </div>
        </>
      )}
    </div>
  );
}
