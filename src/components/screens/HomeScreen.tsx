import type { CSSProperties } from 'react';
import { useNudges } from '../../data/useNudges';
import { useHomeWidgetPrefs } from '../../data/useHomeWidgetPrefs';
import { HOME_WIDGET_REGISTRY, isWidgetVisible } from '../../data/homeWidgets';

interface Props {
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
export default function HomeScreen({ isMobile, isOwner, homeHeadStyle, homeSubStyle, onOpenNova, assistantName, onNavigate }: Props) {
  const { nudges } = useNudges();
  const { hidden, order, known, loading: prefsLoading } = useHomeWidgetPrefs();
  const nudgeSummary = nudges.length > 0 ? `${nudges.length} thing${nudges.length === 1 ? '' : 's'} worth a look today.` : 'Nothing urgent — everything on track.';

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

      {isMobile && !hasCustomOrder ? (
        // No custom order saved yet — keep the original mobile default
        // (Nova right under the greeting, ahead of the KPI grid) exactly
        // as it always rendered. The moment an account actually saves a
        // custom order (below), mobile switches to honoring it like
        // desktop always does.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {columnWidgets.filter((w) => w.key === 'nova').map((w) => <w.Component key={w.key} {...widgetProps} />)}
          {fullWidgets.map((w) => <w.Component key={w.key} {...widgetProps} />)}
          {columnWidgets.filter((w) => w.key !== 'nova').map((w) => <w.Component key={w.key} {...widgetProps} />)}
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
          {fullWidgets.map((w) => <w.Component key={w.key} {...widgetProps} />)}
          {columnWidgets.map((w) => <w.Component key={w.key} {...widgetProps} />)}
        </div>
      ) : (
        <>
          {fullWidgets.map((w) => (
            <div key={w.key} style={{ marginTop: 24 }}>
              <w.Component {...widgetProps} />
            </div>
          ))}
          {columnWidgets.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: desktopGridColumns, gap: 12, marginTop: 18 }}>
              {columnWidgets.map((w) => <w.Component key={w.key} {...widgetProps} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
