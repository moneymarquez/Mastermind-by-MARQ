import { useCrmPipelineSnapshot } from '../../data/useCrmPipelineSnapshot';
import type { HomeWidgetProps } from './types';
import { cardShell } from './types';
import { STAGES } from '../screens/ClientCRMScreen';

/** New in the widget-customization pass — owner-only (the registry marks
 *  it ownerOnly), off by default like the other new widgets. A quick
 *  read of how many clients sit in each Client CRM stage, without
 *  opening the board. */
export default function CrmPipelineWidget({ onNavigate }: HomeWidgetProps) {
  const { counts, total, loading } = useCrmPipelineSnapshot();

  return (
    <div style={{ ...cardShell, padding: 20, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>Client CRM</div>
        <div style={{ fontSize: 12, color: 'var(--mm-faint)' }}>{loading ? '—' : `${total} total`}</div>
      </div>

      {!loading && total === 0 && (
        <div onClick={() => onNavigate('client-crm')} style={{ fontSize: 12.5, color: 'var(--mm-faint)', cursor: 'pointer' }}>
          No clients yet →
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {STAGES.filter((s) => counts[s.key] > 0).map((s) => (
          <div key={s.key} onClick={() => onNavigate('client-crm')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 12.5, flex: 1, color: 'var(--mm-dim)' }}>{s.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--mm-text)', fontWeight: 600 }}>{counts[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
