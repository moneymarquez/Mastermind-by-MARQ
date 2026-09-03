import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import ModulePicker from '../../onboarding/ModulePicker';
import { useModuleAccess } from '../../data/useModuleAccess';
import { MODULE_REGISTRY } from '../../modules.config';
import Icon from '../../Icon';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  currentUserId: string;
  isOwner: boolean;
  /** Real access — same function Stage.tsx uses for screen-level gating.
   *  Used here only to decide which modules are even eligible to hide or
   *  reorder (no point offering either for something you can't open). */
  canAccess: (moduleKey: string) => boolean;
  hiddenModules: Set<string>;
  order: Record<string, number>;
  onToggleHidden: (moduleKey: string, hide: boolean) => void;
  onReorderCategory: (orderedModuleKeys: string[]) => void;
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

/** Hide/show and reorder — a purely cosmetic layer on top of real access
 *  (schema_056_nav_module_order.sql). Neither hiding nor reordering ever
 *  touches user_modules or a module's own data; both only change how
 *  Sidebar/MobileMenuSheet lay the module out. Lists every module the
 *  account can currently open, grouped by category and sorted in the
 *  same order the real nav renders them, each with up/down arrows and a
 *  show/hide toggle. */
function HideFromMenu({ canAccess, hiddenModules, order, onToggleHidden, onReorderCategory }: Pick<Props, 'canAccess' | 'hiddenModules' | 'order' | 'onToggleHidden' | 'onReorderCategory'>) {
  const visible = MODULE_REGISTRY.filter((m) => canAccess(m.key));
  const categories = [...new Set(visible.map((m) => m.category))];
  const hiddenCount = visible.filter((m) => hiddenModules.has(m.key)).length;

  const move = (categoryItems: typeof visible, key: string, dir: -1 | 1) => {
    const idx = categoryItems.findIndex((m) => m.key === key);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= categoryItems.length) return;
    const keys = categoryItems.map((m) => m.key);
    [keys[idx], keys[swapIdx]] = [keys[swapIdx], keys[idx]];
    onReorderCategory(keys);
  };

  return (
    <div style={{ marginTop: 28, maxWidth: 640 }}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--mm-text)' }}>Hide & reorder</div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--mm-dim)', marginTop: 4, lineHeight: 1.5 }}>
        Declutter or rearrange your Sidebar/Menu without losing anything — hiding or moving a module never touches
        its data, and a hidden one stays reachable from Home or Nova. Flip it back on or move it back any time.
        {hiddenCount > 0 && <span style={{ color: 'var(--mm-faint)' }}> {hiddenCount} hidden right now.</span>}
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {categories.map((cat) => {
          const items = visible
            .filter((m) => m.category === cat)
            .map((m, i) => ({ m, natural: i }))
            .sort((a, b) => (order[a.m.key] ?? a.natural) - (order[b.m.key] ?? b.natural))
            .map(({ m }) => m);
          return (
            <div key={cat ?? 'other'}>
              <div style={{ fontSize: 'var(--text-caption)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mm-faint)', marginBottom: 8 }}>
                {cat ?? 'Other'}
              </div>
              <div style={card}>
                {items.map((m, i) => {
                  const hidden = hiddenModules.has(m.key);
                  return (
                    <div key={m.key} style={row(i === items.length - 1)}>
                      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                        <div style={moveBtn(i === 0)} onClick={() => i > 0 && move(items, m.key, -1)}>▲</div>
                        <div style={moveBtn(i === items.length - 1)} onClick={() => i < items.length - 1 && move(items, m.key, 1)}>▼</div>
                      </div>
                      <Icon name={m.icon} size={19} color="var(--mm-dim)" />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-body)', color: hidden ? 'var(--mm-faint)' : 'var(--mm-text)' }}>
                        {m.label}
                      </div>
                      <div onClick={() => onToggleHidden(m.key, !hidden)} style={toggleTrack(!hidden)} title={hidden ? 'Hidden — tap to show' : 'Shown — tap to hide'}>
                        <div style={toggleDot(!hidden)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--mm-faint)' }}>No modules to show yet.</div>
        )}
      </div>
    </div>
  );
}

export default function ManageModulesScreen({ homeHeadStyle, homeSubStyle, currentUserId, isOwner, canAccess, hiddenModules, order, onToggleHidden, onReorderCategory }: Props) {
  const { loading, enabledKeys, saveModuleSelections } = useModuleAccess(currentUserId, isOwner);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) setSelected(new Set(enabledKeys));
    // Only sync from the loaded value once — don't clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await saveModuleSelections([...selected]);
    setSaving(false);
    setSaved(true);
  };

  if (isOwner) {
    return (
      <div>
        <div style={homeHeadStyle}>Manage modules</div>
        <div style={homeSubStyle}>
          Your account always has everything on — this screen doesn't apply to you. Looking to give someone else free
          access? That moved to Settings → Grant Access.
        </div>
        <HideFromMenu canAccess={canAccess} hiddenModules={hiddenModules} order={order} onToggleHidden={onToggleHidden} onReorderCategory={onReorderCategory} />
      </div>
    );
  }

  return (
    <div>
      <div style={homeHeadStyle}>Manage modules</div>
      <div style={homeSubStyle}>Turn sections on or off — this only changes what shows up in your nav, your data is never touched.</div>

      <div style={{ marginTop: 24, maxWidth: 760 }}>
        {!loading && <ModulePicker selected={selected} onToggle={toggle} />}
      </div>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
            fontSize: 'var(--text-body)', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Saved.</span>}
      </div>

      <HideFromMenu canAccess={canAccess} hiddenModules={hiddenModules} order={order} onToggleHidden={onToggleHidden} onReorderCategory={onReorderCategory} />
    </div>
  );
}
