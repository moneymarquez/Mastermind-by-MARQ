import type { CSSProperties } from 'react';
import { usePatternDetection } from '../../data/usePatternDetection';
import type { Confidence } from '../../data/usePatternDetection';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const CONFIDENCE_COLOR: Record<Confidence, string> = { low: 'var(--text-tertiary)', medium: '#C9A24B', high: '#8fae8f' };
const CONFIDENCE_LABEL: Record<Confidence, string> = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' };

export default function PatternDetectionScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { insights, loading, generating, error, refresh, dismiss } = usePatternDetection();

  return (
    <div>
      <div style={homeHeadStyle}>Patterns</div>
      <div style={homeSubStyle}>Real correlations across your modules — not single-purpose-app blind spots. Correlation, not causation.</div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <div
          style={{ padding: '10px 22px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.6 : 1 }}
          onClick={() => !generating && refresh()}
        >
          {generating ? 'Looking for patterns…' : 'Look for patterns'}
        </div>
      </div>
      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 12, textAlign: 'center', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {insights.map((i) => (
          <div key={i.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{i.summary}</div>
              <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={() => dismiss(i.id)}>Dismiss</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, color: CONFIDENCE_COLOR[i.confidence], border: `1px solid ${CONFIDENCE_COLOR[i.confidence]}`, borderRadius: 'var(--radius-pill)', padding: '2px 10px' }}>
                {CONFIDENCE_LABEL[i.confidence]}
              </span>
              {i.modules.map((m) => (
                <span key={m} style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 10px' }}>{m}</span>
              ))}
            </div>
          </div>
        ))}
        {!loading && insights.length === 0 && !error && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', textAlign: 'center' }}>No patterns found yet — click above to look, once you've got a few weeks of activity logged.</div>
        )}
      </div>
    </div>
  );
}
