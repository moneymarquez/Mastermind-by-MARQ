import { useEffect, useState } from 'react';
import Card from '../../mm/Card';
import { supabase } from '../../../lib/supabase';
import { band, trustTrend } from '../../../data/aiScores';
import type { ScoreRow } from '../../../data/aiScores';

const COLOR = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--danger)' } as const;

/** Trust trend: which workers are getting better or worse, and the checks
 *  that fail most often. Reads ai_output_scores for the last 30 days. */
export default function TrustTrendCard() {
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    void supabase.from('ai_output_scores').select('worker,overall,checks,rejected_reason,created_at').gte('created_at', since).limit(2000)
      .then(({ data }) => setRows((data ?? []) as ScoreRow[]));
  }, []);
  if (!rows) return null;
  const { workers, failed } = trustTrend(rows);
  const cell = (n: number | null) => {
    const b = band(n);
    return <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: b ? COLOR[b] : 'var(--text-tertiary)' }}>{n ?? '—'}</span>;
  };
  return (
    <Card title="Trust trend" meta={`${rows.length} scored · 30 days`}>
      {workers.length === 0 ? (
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No scored outputs yet. Scores show up as workers produce cards.</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) repeat(3,minmax(0,1fr))', gap: '8px 10px', fontSize: 14 }}>
          {['Worker', '7 days', '30 days', 'Sent back'].map((h, i) => <span key={h} style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: i ? 'right' : 'left' }}>{h}</span>)}
          {workers.map((w) => [
            <span key={`${w.worker}-n`} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.worker}</span>,
            <span key={`${w.worker}-7`} style={{ display: 'contents' }}>{cell(w.avg7)}</span>,
            <span key={`${w.worker}-30`} style={{ display: 'contents' }}>{cell(w.avg30)}</span>,
            <span key={`${w.worker}-b`} style={{ textAlign: 'right', color: w.sentBack ? 'var(--danger)' : 'var(--text-tertiary)' }}>{w.sentBack}</span>,
          ])}
        </div>
      )}
      {failed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Most common failed checks</span>
          {failed.map((f) => <span key={f.name} style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--danger)', fontWeight: 700 }}>✗</span> {f.name} <span style={{ color: 'var(--text-tertiary)' }}>× {f.count}</span></span>)}
        </div>
      )}
    </Card>
  );
}
