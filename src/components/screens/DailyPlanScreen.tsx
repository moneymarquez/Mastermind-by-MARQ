import type { CSSProperties } from 'react';
import { useDailyPlan } from '../../data/useDailyPlan';
import type { DailyPlanBlockType } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const TYPE_COLOR: Record<DailyPlanBlockType, string> = {
  fixed: 'var(--text-secondary)', goal: '#5B8DEF', fitness: 'var(--success)', macros: 'var(--warning)', ai_suggested: '#c47ad1',
};
const TYPE_LABEL: Record<DailyPlanBlockType, string> = {
  fixed: 'Fixed', goal: 'Goal', fitness: 'Fitness', macros: 'Macros', ai_suggested: 'Nova suggested',
};

export default function DailyPlanScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { plan, loading, removeBlock, confirm, skip } = useDailyPlan();

  return (
    <div>
      <div style={homeHeadStyle}>Daily Plan</div>
      <div style={homeSubStyle}>Generated overnight, ready to review — confirm as-is or adjust first.</div>

      {loading && <div style={{ marginTop: 24, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)' }}>Loading…</div>}

      {!loading && !plan && (
        <div style={{ marginTop: 24, maxWidth: 480, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          No plan for today yet. Plans generate overnight from your calendar, active goals, and any active
          Fitness/Macros plan — once you're subscribed to push notifications, today's plan will be here by 8am.
        </div>
      )}

      {!loading && plan && (
        <div style={{ marginTop: 24, maxWidth: 560 }}>
          {plan.status === 'confirmed' && (
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--success)', marginBottom: 14 }}>Confirmed — this is your day.</div>
          )}
          {plan.status === 'skipped' && (
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginBottom: 14 }}>Skipped for today.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.blocks.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface)', border: `1px solid ${TYPE_COLOR[b.type]}33` }}>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', width: 52, flexShrink: 0, paddingTop: 1 }}>{b.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{b.title}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: TYPE_COLOR[b.type], border: `1px solid ${TYPE_COLOR[b.type]}`, borderRadius: 'var(--radius-pill)', padding: '1px 7px' }}>
                      {TYPE_LABEL[b.type]}
                    </span>
                  </div>
                  {b.detail && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{b.detail}</div>}
                </div>
                {plan.status === 'draft' && (
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => removeBlock(i)}>✕</span>
                )}
              </div>
            ))}
            {plan.blocks.length === 0 && (
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing in this plan.</div>
            )}
          </div>

          {plan.status === 'draft' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="ap-btn ap-btn-primary" onClick={confirm}>Confirm plan</button>
              <button className="ap-btn ap-btn-secondary" onClick={skip}>Skip today</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
