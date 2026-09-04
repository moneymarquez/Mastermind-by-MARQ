import type { CSSProperties } from 'react';
import { HOME_WIDGET_REGISTRY, isWidgetVisible } from '../../data/homeWidgets';
import { useHomeWidgetPrefs } from '../../data/useHomeWidgetPrefs';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  isOwner: boolean;
}

const card: CSSProperties = { background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', borderRadius: 'var(--radius-xl)', padding: 4 };
const row = (last: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderBottom: last ? 'none' : '1px solid var(--mm-line)',
});
const toggleTrack = (on: boolean): CSSProperties => ({
  width: 42, height: 25, borderRadius: 999, background: on ? 'var(--mm-text)' : 'var(--mm-line2)', position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s ease',
});
const toggleDot = (on: boolean): CSSProperties => ({
  position: 'absolute', top: 2, left: on ? 19 : 2, width: 21, height: 21, borderRadius: '50%', background: 'var(--mm-bg)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.15s ease',
});
const moveBtn = (disabled: boolean): CSSProperties => ({
  width: 22, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
  color: disabled ? 'var(--mm-line2)' : 'var(--mm-faint)', cursor: disabled ? 'default' : 'pointer',
});

/** Show/hide and reorder the Overview screen's own widgets
 *  (home_widget_prefs) — the exact same up/down-arrow + toggle pattern
 *  ManageModulesScreen's "Hide & reorder" uses for the nav, just for
 *  src/data/homeWidgets.ts's registry instead of MODULE_REGISTRY. Purely
 *  cosmetic: hiding or moving a widget never touches the data behind it
 *  (Macros/Schedule/etc. are all still fully reachable from their own
 *  nav entries), so it's always fully reversible. */
export default function EditHomeWidgetsScreen({ homeHeadStyle, homeSubStyle, isOwner }: Props) {
  const { hidden, order, known, loading, setWidgetHidden, reorderWidgets } = useHomeWidgetPrefs();

  const items = HOME_WIDGET_REGISTRY
    .filter((w) => !w.ownerOnly || isOwner)
    .map((w, i) => ({ w, natural: i }))
    .sort((a, b) => (order[a.w.key] ?? a.natural) - (order[b.w.key] ?? b.natural))
    .map(({ w }) => w);

  const move = (key: string, dir: -1 | 1) => {
    const idx = items.findIndex((w) => w.key === key);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const keys = items.map((w) => w.key);
    [keys[idx], keys[swapIdx]] = [keys[swapIdx], keys[idx]];
    // A defaultHidden widget the account has never touched has no row at
    // all — that's what keeps it off. reorderWidgets upserts every key it's
    // given, and the table's `hidden` column defaults to false on a fresh
    // insert, so writing sort_order for an untouched defaultHidden widget
    // here would silently create a row and turn it on as a side effect of
    // just reordering something else. Skip those; their position falls
    // back to registry order until the account actually flips them on.
    const toWrite = keys.filter((k) => {
      const w = HOME_WIDGET_REGISTRY.find((r) => r.key === k)!;
      return !w.defaultHidden || known.has(k);
    });
    reorderWidgets(toWrite);
  };

  const hiddenCount = items.filter((w) => !isWidgetVisible(w, hidden, known)).length;

  return (
    <div>
      <div style={homeHeadStyle}>Edit widgets</div>
      <div style={homeSubStyle}>
        Choose what shows up on your Overview screen and in what order — hiding or moving a widget never touches its
        data, everything stays reachable from its own section. Changes apply the next time you open Overview.
        {hiddenCount > 0 && <span style={{ color: 'var(--mm-faint)' }}> {hiddenCount} hidden right now.</span>}
      </div>

      {!loading && (
        <div style={{ marginTop: 24, maxWidth: 640 }}>
          <div style={card}>
            {items.map((w, i) => {
              const isHidden = !isWidgetVisible(w, hidden, known);
              return (
                <div key={w.key} style={row(i === items.length - 1)}>
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={moveBtn(i === 0)} onClick={() => i > 0 && move(w.key, -1)}>▲</div>
                    <div style={moveBtn(i === items.length - 1)} onClick={() => i < items.length - 1 && move(w.key, 1)}>▼</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-body)', color: isHidden ? 'var(--mm-faint)' : 'var(--mm-text)' }}>{w.label}</div>
                    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--mm-faint)', marginTop: 2 }}>{w.description}</div>
                  </div>
                  <div onClick={() => setWidgetHidden(w.key, !isHidden)} style={toggleTrack(!isHidden)} title={isHidden ? 'Hidden — tap to show' : 'Shown — tap to hide'}>
                    <div style={toggleDot(!isHidden)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
