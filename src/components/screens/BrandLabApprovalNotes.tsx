import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BrandLabBrief, BenchmarkFeedback } from '../../data/types';

interface Props {
  brief: BrandLabBrief;
  onSave: (patch: Partial<Pick<BrandLabBrief, 'approval_notes' | 'niche_feedback' | 'benchmark_feedback'>>) => Promise<void>;
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16, maxWidth: 680 };
const textarea: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 12px', color: 'var(--text)', fontSize: 16, lineHeight: 1.5, outline: 'none', resize: 'vertical', minHeight: 70, fontFamily: 'inherit',
};
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6, marginTop: 12 };
const vote = (on: boolean, good: boolean): CSSProperties => ({
  padding: '6px 10px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer', fontWeight: 600,
  border: `1px solid ${on ? (good ? 'var(--success)' : 'var(--danger)') : 'var(--border-2)'}`,
  color: on ? (good ? 'var(--success)' : 'var(--danger)') : 'var(--text-tertiary)', background: 'transparent',
});

/** Step 8 — what a finished project writes back. Shown once a design is
 *  locked; everything here feeds the per-niche Learning panel and the
 *  benchmark counts in the Niche library. Two minutes on the phone right
 *  after approval is when the operator actually knows the answers. */
export default function BrandLabApprovalNotes({ brief, onSave }: Props) {
  const [notes, setNotes] = useState(brief.approval_notes ?? '');
  const [nicheFb, setNicheFb] = useState(brief.niche_feedback ?? '');
  const feedback = brief.benchmark_feedback ?? [];

  const setVote = (url: string, helpful: boolean) => {
    const existing = feedback.find((f) => f.url === url);
    let next: BenchmarkFeedback[];
    if (existing && existing.helpful === helpful) next = feedback.filter((f) => f.url !== url);
    else next = [...feedback.filter((f) => f.url !== url), { url, helpful }];
    onSave({ benchmark_feedback: next });
  };

  return (
    <div style={card}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>What made this one land</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>
        Approved in {brief.rounds_to_approval ?? '?'} round{brief.rounds_to_approval === 1 ? '' : 's'}. This is the part that makes the next {brief.niche_slug === 'other' ? 'brief' : `${brief.niche_slug} brief`} better — fill it in while it's fresh.
      </div>

      <div style={label}>Phrasing, structure, or decisions worth repeating</div>
      <textarea style={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes.trim() !== (brief.approval_notes ?? '') && onSave({ approval_notes: notes.trim() || null })} placeholder="e.g. Leading with the emergency CTA in the spec kept every round on structure…" />

      <div style={label}>What the niche research got wrong or missed</div>
      <textarea style={textarea} value={nicheFb} onChange={(e) => setNicheFb(e.target.value)} onBlur={() => nicheFb.trim() !== (brief.niche_feedback ?? '') && onSave({ niche_feedback: nicheFb.trim() || null })} placeholder="e.g. Trust signals should include the state license lookup link; the 'financing' section wasn't relevant for this client." />

      {brief.benchmarks_used.length > 0 && (
        <>
          <div style={label}>Benchmarks that were in the prompt — did each help?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brief.benchmarks_used.map((b) => {
              const v = feedback.find((f) => f.url === b.url);
              return (
                <div key={b.url} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                    <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', overflowWrap: 'anywhere' }}>{b.url}</div>
                    {b.note && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>{b.note}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={vote(v?.helpful === true, true)} onClick={() => setVote(b.url, true)}>Helped</span>
                    <span style={vote(v?.helpful === false, false)} onClick={() => setVote(b.url, false)}>Didn't</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
