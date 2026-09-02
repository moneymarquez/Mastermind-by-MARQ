import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BrandLabBrief, Niche } from '../../data/types';
import { learnByNiche } from '../../data/brandLabLearning';

interface Props {
  briefs: BrandLabBrief[];
  niches: Niche[];
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16 };
const h: CSSProperties = { fontSize: 'var(--text-caption)', letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, margin: '10px 0 6px' };

/** Step 8 — the learning loop, surfaced. Nothing here is generated: it's
 *  the approved briefs' own write-backs aggregated per niche, so the
 *  numbers are exactly as real as the briefs behind them. Hidden until
 *  there is at least one brief, and reads as an honest "none approved
 *  yet" until a design has actually been locked. */
export default function BrandLabLearning({ briefs, niches }: Props) {
  const [open, setOpen] = useState(false);
  const learning = learnByNiche(briefs, niches);
  if (learning.length === 0) return null;
  const approved = learning.reduce((s, l) => s + l.approved, 0);

  return (
    <div style={{ ...card, maxWidth: 640, marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>What's working</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {approved === 0 ? 'No designs locked yet — rounds-to-approval per niche shows up here once one is.' : `${approved} approved design${approved === 1 ? '' : 's'} across ${learning.length} niche${learning.length === 1 ? '' : 's'}.`}
          </div>
        </div>
        <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
          {learning.map((l) => (
            <div key={l.slug} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.55 }}>{l.insight}</div>
              {l.fastest.length > 0 && (
                <>
                  <div style={h}>Fastest to approval</div>
                  {l.fastest.map((b) => (
                    <div key={b.id} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {b.business || b.direction} — {b.rounds_to_approval} round{b.rounds_to_approval === 1 ? '' : 's'}{b.tone ? ` · ${b.tone}` : ''}
                      {b.approval_notes && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>“{b.approval_notes}”</div>}
                    </div>
                  ))}
                </>
              )}
              {l.benchmarks.length > 0 && (
                <>
                  <div style={h}>Benchmarks referenced</div>
                  {l.benchmarks.map((s) => (
                    <div key={s.url} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere', minWidth: 0 }}>{s.url}</span>
                      <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        used {s.used}{s.helpful ? ` · ${s.helpful} helped` : ''}{s.unhelpful ? ` · ${s.unhelpful} didn't` : ''}
                      </span>
                    </div>
                  ))}
                </>
              )}
              {l.feedback.length > 0 && (
                <>
                  <div style={h}>Niche research gaps</div>
                  {l.feedback.map((f, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{f.business}: </span>{f.text}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
