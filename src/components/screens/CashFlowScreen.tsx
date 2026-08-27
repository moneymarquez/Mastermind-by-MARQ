import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useCashFlow } from '../../data/useCashFlow';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700, color: color ?? 'var(--text)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

export default function CashFlowScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { forecast, loading, setStartingBalance, askScenario, scenarioAnswer, scenarioLoading, scenarioError } = useCashFlow();
  const [balanceDraft, setBalanceDraft] = useState('');
  const [question, setQuestion] = useState('');

  const upcomingEvents = forecast ? forecast.days.flatMap((d) => d.events.map((e) => ({ ...e }))).slice(0, 15) : [];

  return (
    <div>
      <div style={homeHeadStyle}>Cash-Flow Forecast</div>
      <div style={homeSubStyle}>30/60/90-day balance projection from real invoices, recurring items, and spending.</div>

      {loading && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 20 }}>Building the forecast…</div>}

      {!loading && forecast && (
        <>
          <div style={{ ...cardStyle, marginTop: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 6 }}>Current balance (starting point)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" style={{ ...inputStyle, flex: 1 }}
                placeholder={String(forecast.startingBalance)}
                value={balanceDraft}
                onChange={(e) => setBalanceDraft(e.target.value)}
              />
              <div style={{ padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }} onClick={() => { if (balanceDraft) { setStartingBalance(Number(balanceDraft)); setBalanceDraft(''); } }}>
                Set
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <StatTile label="Today" value={money(forecast.startingBalance)} />
            <StatTile label="In 30 days" value={money(forecast.balanceAt30)} color={forecast.balanceAt30 < 0 ? 'var(--danger)' : undefined} />
            <StatTile label="In 60 days" value={money(forecast.balanceAt60)} color={forecast.balanceAt60 < 0 ? 'var(--danger)' : undefined} />
            <StatTile label="In 90 days" value={money(forecast.balanceAt90)} color={forecast.balanceAt90 < 0 ? 'var(--danger)' : undefined} />
          </div>

          {forecast.firstShortfall ? (
            <div style={{ ...cardStyle, marginTop: 16, borderColor: 'color-mix(in srgb, var(--danger) 33%, transparent)', background: 'color-mix(in srgb, var(--danger) 6%, transparent)' }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--danger)' }}>
                Projected shortfall on {new Date(forecast.firstShortfall.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-quaternary)', marginTop: 8 }}>Driven by: {forecast.firstShortfall.drivers.join(', ')}</div>
            </div>
          ) : (
            <div style={{ ...cardStyle, marginTop: 16, fontSize: 'var(--text-body-sm)', color: 'var(--success)' }}>No projected shortfall in the next 90 days, at current pace.</div>
          )}

          <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)', marginTop: 36, marginBottom: 14 }}>Upcoming known events</div>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {upcomingEvents.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--surface-3)', fontSize: 'var(--text-body-sm)' }}>
                <span style={{ color: 'var(--text)' }}>{e.label}</span>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span style={{ fontWeight: 600, color: e.amount >= 0 ? 'var(--success)' : 'var(--danger)', minWidth: 70, textAlign: 'right' }}>{money(e.amount)}</span>
                </div>
              </div>
            ))}
            {upcomingEvents.length === 0 && <div style={{ padding: 16, fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Nothing scheduled — recurring items, unpaid invoices with due dates, and subscription renewals show up here.</div>}
          </div>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 8 }}>
            Plus an average daily variable spend of {money(forecast.avgDailyVariableExpense)}/day, based on your last 30 days of non-recurring expenses.
          </div>

          <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)', marginTop: 36, marginBottom: 14 }}>Ask a scenario question</div>
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                placeholder='e.g. "What if this invoice pays 2 weeks late?"'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && question.trim() && !scenarioLoading) askScenario(question.trim()); }}
              />
              <div style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: scenarioLoading ? 'default' : 'pointer', opacity: scenarioLoading ? 0.6 : 1 }} onClick={() => question.trim() && !scenarioLoading && askScenario(question.trim())}>
                {scenarioLoading ? 'Thinking…' : 'Ask'}
              </div>
            </div>
            {scenarioError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 10 }}>{scenarioError}</div>}
            {scenarioAnswer && <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary)', marginTop: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{scenarioAnswer}</div>}
          </div>
        </>
      )}
    </div>
  );
}
