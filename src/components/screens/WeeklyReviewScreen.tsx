import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useWeeklyReview } from '../../data/useWeeklyReview';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };

function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function WeeklyReviewScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { reviews, loading, generating, error, generateCurrentWeek } = useWeeklyReview();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const latest = reviews[0] ?? null;
  const history = reviews.slice(1);

  return (
    <div>
      <div style={homeHeadStyle}>Weekly Review</div>
      <div style={homeSubStyle}>An honest read on what moved, what stalled, and what to do next — generated automatically each week.</div>

      {loading && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 20 }}>Checking for this week's review…</div>}

      {!loading && latest && (
        <div style={{ ...cardStyle, marginTop: 24 }}>
          <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Week of {weekLabel(latest.week_start)}</div>
          <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)', marginTop: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{latest.summary}</div>
          {latest.recommended_actions.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text)', marginTop: 18 }}>For the coming week</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {latest.recommended_actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{i + 1}.</span>{a}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!loading && !latest && (
        <div style={{ ...cardStyle, marginTop: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-body)' }}>
          No review yet — one generates automatically once a full week has passed, or generate a look at the current week now.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <div
          style={{ padding: '9px 20px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: generating ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: generating ? 'default' : 'pointer' }}
          onClick={() => !generating && generateCurrentWeek()}
        >
          {generating ? 'Generating…' : 'Generate progress review for the current week'}
        </div>
      </div>
      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10, textAlign: 'center' }}>{error}</div>}

      {history.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)', marginTop: 40, marginBottom: 12 }}>History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((r) => (
              <div key={r.id} style={cardStyle} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Week of {weekLabel(r.week_start)}</div>
                  <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>{expandedId === r.id ? 'Hide' : 'Expand'}</span>
                </div>
                {expandedId === r.id && (
                  <>
                    <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary)', marginTop: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.summary}</div>
                    {r.recommended_actions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                        {r.recommended_actions.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{i + 1}.</span>{a}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
