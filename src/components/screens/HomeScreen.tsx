import type { CSSProperties } from 'react';
import { useSkin } from '../../data/useTheme';
import CyberOverview from '../cyber/CyberOverview';
import BrainNudgeCard from './brain/BrainNudgeCard';
import { useNudges } from '../../data/useNudges';
import { useCallsToday } from '../../data/useCallsToday';
import { useDailyCallGoal } from '../../data/useDailyCallGoal';
import { useDailyPlan } from '../../data/useDailyPlan';
import { useReminders } from '../../data/useReminders';
import { greetingLine } from '../../data/greeting';
import { dateStr, timeToMinutes } from '../../data/time';
import { useHomeWidgetPrefs } from '../../data/useHomeWidgetPrefs';
import { HOME_WIDGET_REGISTRY, isWidgetVisible } from '../../data/homeWidgets';
import { useMyTeams } from '../../data/useDispatch';
import { FromOwnerSection } from '../../dispatch/FromOwner';

interface Props {
  currentUserId?: string;
  isMobile: boolean;
  isOwner: boolean;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onOpenNova: () => void;
  assistantName: string;
  onNavigate: (screen: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The Overview screen — a registry-driven render of HOME_WIDGET_REGISTRY
 *  (src/data/homeWidgets.ts), filtered/sorted by this account's own
 *  saved preferences (useHomeWidgetPrefs / home_widget_prefs — "Edit
 *  widgets" under Settings). No saved prefs at all (everyone, until they
 *  actually open the editor) renders the exact pre-widget-system default
 *  layout: 6-tile KPI row, then Macros/Schedule/Nova in that order. */
export default function HomeScreen({ currentUserId, isMobile, isOwner, homeHeadStyle, homeSubStyle, onOpenNova, assistantName, onNavigate }: Props) {
  const { nudges } = useNudges();
  // Teams this account is on (not the one it leads): "From <lead>" goes first.
  const { teams } = useMyTeams(!!currentUserId);
  const { hidden, order, known, sizes, loading: prefsLoading } = useHomeWidgetPrefs();
  const { callsToday, loading: callsLoading } = useCallsToday();
  const target = useDailyCallGoal();
  const { plan } = useDailyPlan();
  const { reminders } = useReminders();
  const now = new Date();
  const callBlock = plan?.blocks.find((b) => b.source === 'dials-calls');
  const nudgeSummary = greetingLine({
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    callsToday, target,
    callStartMinutes: callBlock ? timeToMinutes(callBlock.time) : 16 * 60,
    overdueCount: reminders.filter((r) => r.due_date < dateStr(now)).length,
    nudgeCount: nudges.length,
    loading: callsLoading,
  });

  const skin = useSkin();

  const widgetProps = { isMobile, onNavigate, onOpenNova, assistantName };
  const hasCustomOrder = Object.keys(order).length > 0;
  const visible = HOME_WIDGET_REGISTRY
    .filter((w) => (!w.ownerOnly || isOwner) && isWidgetVisible(w, hidden, known))
    .map((w, i) => ({ w, natural: i }))
    .sort((a, b) => (order[a.w.key] ?? a.natural) - (order[b.w.key] ?? b.natural))
    .map(({ w }) => w);
  const fullWidgets = visible.filter((w) => w.layout === 'full');
  const columnWidgets = visible.filter((w) => w.layout === 'column');
  // Same fixed 3-column widths the pre-widget-system layout used, only
  // while exactly today's default 3 column widgets are showing (so the
  // untouched default looks byte-identical) — anything else (a widget
  // hidden, or Phase 4's new options added) falls back to a generic
  // auto-fit grid instead of leaving gaps or squeezing a 4th into 3 slots.
  const desktopGridColumns = columnWidgets.length === 3 ? 'minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(280px, 340px)' : 'repeat(auto-fit, minmax(280px, 1fr))';

  // Cyberpunk is a different Overview, not a restyle: see CyberOverview.
  // Its fixed layout still carries the member side of Dispatch, and the
  // Dispatch widget when it's switched on — above the overview when it's
  // been pinned first in Edit widgets, below otherwise (spec 15 §3A).
  if (skin === 'cyberpunk') {
    const dispatchDef = visible.find((w) => w.key === 'dispatch');
    const pinned = dispatchDef && visible[0]?.key === 'dispatch' && hasCustomOrder;
    const dispatchCard = dispatchDef && <div style={{ marginTop: 18 }}><dispatchDef.Component {...widgetProps} size={sizes.dispatch ?? dispatchDef.sizes?.[0]} /></div>;
    return (
      <>
        <BrainNudgeCard onOpen={() => onNavigate('brain')} />
        {currentUserId && teams.map((t) => <div key={t.owner_id} style={{ marginBottom: 18 }}><FromOwnerSection team={t} userId={currentUserId} /></div>)}
        {pinned && dispatchCard}
        <CyberOverview isMobile={isMobile} onNavigate={onNavigate} />
        {!pinned && dispatchCard}
      </>
    );
  }

  if (prefsLoading) return <div style={homeSubStyle}>Loading…</div>;

  return (
    // On mobile, the widgets an account has on today (often just Nova +
    // the KPI row) rarely fill the available height above the tab bar —
    // top-anchoring them the way a normal document flows then leaves a
    // large, unexplained blank stretch at the bottom. minHeight: '100%'
    // (resolving against #tour-content-panel's own padded box in
    // Stage.tsx, which has a definite height) + justifyContent: 'flex-end'
    // instead groups the greeting + widgets together and settles that
    // whole block toward the bottom, so it reads as filling the screen
    // rather than floating in its top third. Desktop's multi-column
    // layout doesn't have this problem (it's wide, not tall-and-sparse),
    // so it keeps the normal top-anchored flow.
    <div style={isMobile ? { display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'flex-end' } : undefined}>
      <div style={homeHeadStyle}>{greeting()}.</div>
      <div style={homeSubStyle}>{nudgeSummary}</div>
      <BrainNudgeCard onOpen={() => onNavigate('brain')} />
      {currentUserId && teams.map((t) => <div key={t.owner_id} style={{ marginTop: 18 }}><FromOwnerSection team={t} userId={currentUserId} /></div>)}

      {isMobile && !hasCustomOrder ? (
        // No custom order saved yet — keep the original mobile default
        // (Nova right under the greeting, ahead of the KPI grid) exactly
        // as it always rendered. The moment an account actually saves a
        // custom order (below), mobile switches to honoring it like
        // desktop always does.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {columnWidgets.filter((w) => w.key === 'nova').map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
          {fullWidgets.map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
          {columnWidgets.filter((w) => w.key !== 'nova').map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {fullWidgets.map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
          {columnWidgets.map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
        </div>
      ) : (
        <>
          {fullWidgets.map((w) => (
            <div key={w.key} style={{ marginTop: 24 }}>
              <w.Component {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />
            </div>
          ))}
          {columnWidgets.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: desktopGridColumns, gap: 12, marginTop: 18 }}>
              {columnWidgets.map((w) => <w.Component key={w.key} {...widgetProps} size={sizes[w.key] ?? w.sizes?.[0]} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** What the redesigned Home keeps from this one: the Brain nudge and the
 *  member side of Dispatch ("From <lead>"), above everything else. */
export function HomeExtras({ currentUserId, onNavigate }: { currentUserId?: string; onNavigate: (screen: string) => void }) {
  const { teams } = useMyTeams(!!currentUserId);
  return (
    <>
      <BrainNudgeCard onOpen={() => onNavigate('brain')} />
      {currentUserId && teams.map((t) => <FromOwnerSection key={t.owner_id} team={t} userId={currentUserId} />)}
    </>
  );
}
