import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useCashFlow } from '../../data/useCashFlow';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11.5, color: '#8A8F98' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? '#F5F6F7', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
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

      {loading && <div style={{ fontSize: 12.5, color: '#565b64', marginTop: 20 }}>Building the forecast…</div>}

      {!loading && forecast && (
        <>
          <div style={{ ...cardStyle, marginTop: 24, maxWidth: 320 }}>
            <div style={{ fontSize: 11.5, color: '#8A8F98', marginBottom: 6 }}>Current balance (starting point)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" style={{ ...inputStyle, flex: 1 }}
                placeholder={String(forecast.startingBalance)}
                value={balanceDraft}
                onChange={(e) => setBalanceDraft(e.target.value)}
              />
              <div style={{ padding: '9px 16px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} onClick={() => { if (balanceDraft) { setStartingBalance(Number(balanceDraft)); setBalanceDraft(''); } }}>
                Set
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <StatTile label="Today" value={money(forecast.startingBalance)} />
            <StatTile label="In 30 days" value={money(forecast.balanceAt30)} color={forecast.balanceAt30 < 0 ? '#c47a7a' : undefined} />
            <StatTile label="In 60 days" value={money(forecast.balanceAt60)} color={forecast.balanceAt60 < 0 ? '#c47a7a' : undefined} />
            <StatTile label="In 90 days" value={money(forecast.balanceAt90)} color={forecast.balanceAt90 < 0 ? '#c47a7a' : undefined} />
          </div>

          {forecast.firstShortfall ? (
            <div style={{ ...cardStyle, marginTop: 16, borderColor: '#c47a7a55', background: '#c47a7a10' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#c47a7a' }}>
                Projected shortfall on {new Date(forecast.firstShortfall.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: '#C7CAD1', marginTop: 8 }}>Driven by: {forecast.firstShortfall.drivers.join(', ')}</div>
            </div>
          ) : (
            <div style={{ ...cardStyle, marginTop: 16, fontSize: 12.5, color: '#8fae8f' }}>No projected shortfall in the next 90 days, at current pace.</div>
          )}

          <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F6F7', marginTop: 36, marginBottom: 14 }}>Upcoming known events</div>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
            {upcomingEvents.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1c1e23', fontSize: 12.5 }}>
                <span style={{ color: '#F5F6F7' }}>{e.label}</span>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ color: '#565b64' }}>{new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span style={{ fontWeight: 600, color: e.amount >= 0 ? '#8fae8f' : '#c47a7a', minWidth: 70, textAlign: 'right' }}>{money(e.amount)}</span>
                </div>
              </div>
            ))}
            {upcomingEvents.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#565b64' }}>Nothing scheduled — recurring items, unpaid invoices with due dates, and subscription renewals show up here.</div>}
          </div>
          <div style={{ fontSize: 11, color: '#565b64', marginTop: 8 }}>
            Plus an average daily variable spend of {money(forecast.avgDailyVariableExpense)}/day, based on your last 30 days of non-recurring expenses.
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F6F7', marginTop: 36, marginBottom: 14 }}>Ask a scenario question</div>
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                placeholder='e.g. "What if this invoice pays 2 weeks late?"'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && question.trim() && !scenarioLoading) askScenario(question.trim()); }}
              />
              <div style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: scenarioLoading ? 'default' : 'pointer', opacity: scenarioLoading ? 0.6 : 1 }} onClick={() => question.trim() && !scenarioLoading && askScenario(question.trim())}>
                {scenarioLoading ? 'Thinking…' : 'Ask'}
              </div>
            </div>
            {scenarioError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 10 }}>{scenarioError}</div>}
            {scenarioAnswer && <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{scenarioAnswer}</div>}
          </div>
        </>
      )}
    </div>
  );
}
