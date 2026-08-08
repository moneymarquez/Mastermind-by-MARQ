import type { CSSProperties } from 'react';
import { useDailyPlan } from '../../data/useDailyPlan';
import type { DailyPlanBlockType } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const TYPE_COLOR: Record<DailyPlanBlockType, string> = {
  fixed: '#8A8F98', goal: '#5B8DEF', fitness: '#4CAF7D', macros: '#e0a35c', ai_suggested: '#c47ad1',
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

      {loading && <div style={{ marginTop: 24, fontSize: 13, color: '#565b64' }}>Loading…</div>}

      {!loading && !plan && (
        <div style={{ marginTop: 24, maxWidth: 480, fontSize: 13, color: '#565b64', lineHeight: 1.6 }}>
          No plan for today yet. Plans generate overnight from your calendar, active goals, and any active
          Fitness/Macros plan — once you're subscribed to push notifications, today's plan will be here by 8am.
        </div>
      )}

      {!loading && plan && (
        <div style={{ marginTop: 24, maxWidth: 560 }}>
          {plan.status === 'confirmed' && (
            <div style={{ fontSize: 12, color: '#4CAF7D', marginBottom: 14 }}>Confirmed — this is your day.</div>
          )}
          {plan.status === 'skipped' && (
            <div style={{ fontSize: 12, color: '#565b64', marginBottom: 14 }}>Skipped for today.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.blocks.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#14161A', border: `1px solid ${TYPE_COLOR[b.type]}33` }}>
                <div style={{ fontSize: 12, color: '#8A8F98', fontFamily: "'JetBrains Mono', monospace", width: 52, flexShrink: 0, paddingTop: 1 }}>{b.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{b.title}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: TYPE_COLOR[b.type], border: `1px solid ${TYPE_COLOR[b.type]}`, borderRadius: 999, padding: '1px 7px' }}>
                      {TYPE_LABEL[b.type]}
                    </span>
                  </div>
                  {b.detail && <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 3, lineHeight: 1.4 }}>{b.detail}</div>}
                </div>
                {plan.status === 'draft' && (
                  <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => removeBlock(i)}>✕</span>
                )}
              </div>
            ))}
            {plan.blocks.length === 0 && (
              <div style={{ fontSize: 12.5, color: '#565b64' }}>Nothing in this plan.</div>
            )}
          </div>

          {plan.status === 'draft' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <div style={{ padding: '10px 24px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={confirm}>
                Confirm plan
              </div>
              <div style={{ padding: '10px 16px', borderRadius: 999, color: '#565b64', fontSize: 13, cursor: 'pointer' }} onClick={skip}>
                Skip today
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
