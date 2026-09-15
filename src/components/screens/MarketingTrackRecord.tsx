import type { CSSProperties } from 'react';
import type { PlayOutcome } from '../../data/usePlayOutcomes';
import { rankTrackRecord } from '../../data/usePlayOutcomes';

interface Props {
  outcomes: PlayOutcome[];
  loading: boolean;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginTop: 20 };
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' };

/** Cross-client track record — "plays get ranked by what's actually
 *  worked for this operator's clients... doubles as screenshot-able
 *  proof content." Reads every logged outcome regardless of which
 *  client is currently selected, since the whole point is showing what
 *  works across the operator's real client base, not one client's
 *  history. Says plainly that it's not meaningful yet below ~10 logged
 *  outcomes, rather than presenting a thin sample as a real signal. */
export default function MarketingTrackRecord({ outcomes, loading }: Props) {
  if (loading || outcomes.length === 0) return null;

  const ranked = rankTrackRecord(outcomes);
  const thin = outcomes.length < 10;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)' }}>Track record</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 8 }}>
        {thin
          ? `Only ${outcomes.length} outcome${outcomes.length === 1 ? '' : 's'} logged so far — worthless as a real signal below ~10. That's expected, not broken.`
          : `Based on ${outcomes.length} logged outcomes across every client.`}
      </div>
      <div>
        {ranked.map((r) => (
          <div key={r.play_key} style={row}>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>{r.play_title}</div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              {r.worked} worked{r.didnt_work > 0 ? `, ${r.didnt_work} didn't` : ''}{r.inconclusive > 0 ? `, ${r.inconclusive} inconclusive` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
