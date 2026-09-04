import Icon from '../../Icon';
import { useMacros } from '../../data/useMacros';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';

/** Macros today — donut + macro bars + last 2 logged meals + quick-log
 *  shortcut. Unchanged from the pre-widget-system HomeScreen, just its
 *  own component now. */
export default function MacrosWidget({ onNavigate }: HomeWidgetProps) {
  const { totals, nutritionTarget, todayMeals, loading: macrosLoading } = useMacros();

  const caloriesTarget = nutritionTarget?.daily_calories ?? null;
  const caloriesPct = caloriesTarget ? Math.min(100, Math.round((totals.calories / caloriesTarget) * 100)) : null;
  const macroBars = nutritionTarget
    ? [
        { label: 'Protein', have: totals.protein_g, of: nutritionTarget.daily_protein_g },
        { label: 'Carbs', have: totals.carbs_g, of: nutritionTarget.daily_carbs_g },
        { label: 'Fat', have: totals.fat_g, of: nutritionTarget.daily_fat_g },
      ]
    : [];

  return (
    <div style={{ ...cardShell, padding: 20, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Macros today</div>
        <div style={{ fontSize: 12, color: 'var(--mm-faint)' }}>
          {macrosLoading ? '—' : caloriesTarget ? `${totals.calories} / ${caloriesTarget} kcal` : `${totals.calories} kcal`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0, borderRadius: '50%', background: caloriesPct !== null ? `conic-gradient(var(--mm-text) ${caloriesPct}%, var(--mm-track) 0)` : 'var(--mm-track)' }}>
          <div style={{ position: 'absolute', inset: 11, borderRadius: '50%', background: 'var(--mm-panel-solid)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{caloriesPct !== null ? `${caloriesPct}%` : '—'}</div>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>of target</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
          {macroBars.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--mm-faint)' }}>No active nutrition target set.</div>
          ) : (
            macroBars.map((b) => (
              <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{b.label}</span>
                  <span style={{ color: 'var(--mm-faint)' }}>{Math.round(b.have)} / {b.of}g</span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: 'var(--mm-track)' }}>
                  <div style={{ width: `${Math.min(100, Math.round((b.have / b.of) * 100))}%`, height: '100%', borderRadius: 5, background: 'var(--mm-text)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {todayMeals.slice(0, 2).map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, background: 'var(--mm-tile)', fontSize: 12.5 }}>
            <Icon name="fork-knife" size={15} color="var(--mm-faint)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.meal_type} — {m.restaurant_name || m.note || 'logged'}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--mm-faint)', flexShrink: 0 }}>{m.calories ?? '—'}</span>
          </div>
        ))}
        <div onClick={() => onNavigate('macros')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, border: '1px dashed var(--mm-line2)', fontSize: 12.5, color: 'var(--mm-faint)', cursor: 'pointer' }}>
          <Icon name="plus" size={15} />Log a meal
        </div>
      </div>
    </div>
  );
}
