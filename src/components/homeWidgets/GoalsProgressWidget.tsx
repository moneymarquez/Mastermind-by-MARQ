import Icon from '../../Icon';
import { useGoals } from '../../data/useGoals';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';

/** New in the widget-customization pass — Goals had zero presence on
 *  Overview before this. Off by default (defaultHidden in the registry)
 *  since it's new, not because it's less useful; turn it on from Edit
 *  widgets. Shows up to 3 goals, committed ones first (they have a real
 *  progress number), then in-progress ones. */
export default function GoalsProgressWidget({ onNavigate }: HomeWidgetProps) {
  const { goals, loading } = useGoals();
  const shown = [...goals].sort((a, b) => (b.committed_path ? 1 : 0) - (a.committed_path ? 1 : 0)).slice(0, 3);

  return (
    <div style={{ ...cardShell, padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Goals</div>
        <div style={{ fontSize: 12, color: 'var(--mm-faint)' }}>{loading ? '—' : `${goals.length} active`}</div>
      </div>

      {!loading && shown.length === 0 && (
        <div onClick={() => onNavigate('goals')} style={{ fontSize: 12.5, color: 'var(--mm-faint)', cursor: 'pointer' }}>
          No goals yet — set one →
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.map((g) => {
          const pct = g.target_cost ? Math.min(100, Math.round((g.current_saved / g.target_cost) * 100)) : g.progress_pct;
          return (
            <div key={g.id} onClick={() => onNavigate('goals')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                <span style={{ color: 'var(--mm-faint)', flexShrink: 0, marginLeft: 8 }}>{pct}%</span>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: 'var(--mm-track)', marginTop: 5 }}>
                <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 5, background: 'var(--mm-text)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div onClick={() => onNavigate('goals')} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--mm-faint)' }}>
        <Icon name="target" size={14} color="var(--mm-faint)" />All goals
      </div>
    </div>
  );
}
