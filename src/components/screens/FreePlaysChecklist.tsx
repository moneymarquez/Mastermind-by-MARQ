import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingBrief } from '../../data/useMarketingBriefs';
import type { MarketingPlay } from '../../data/useMarketingPlays';
import { generateFreePlaysChecklist } from '../../data/marketingPlaysEngine';
import type { BusinessModel } from '../../data/marketingPlaysEngine';

interface Props {
  brief: MarketingBrief;
  clientName: string;
  plays: MarketingPlay[];
  loading: boolean;
  onGenerate: (drafts: ReturnType<typeof generateFreePlaysChecklist>) => void;
  onMarkDone: (id: string) => void;
  onSkip: (id: string, reason: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const itemCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 14 };
const ghostBtn: CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '8px 11px', color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const moveBtn: CSSProperties = { cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 'var(--text-caption)', padding: '2px 6px', userSelect: 'none' };

function ChecklistItem({ item, index, count, onDone, onSkip, onMove }: {
  item: MarketingPlay; index: number; count: number;
  onDone: () => void; onSkip: (reason: string) => void; onMove: (dir: -1 | 1) => void;
}) {
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState('');
  const resolved = item.status === 'done' || item.status === 'skipped';

  return (
    <div style={{ ...itemCard, opacity: resolved ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2 }}>
            <span style={{ ...moveBtn, opacity: index === 0 ? 0.3 : 1, pointerEvents: index === 0 ? 'none' : 'auto' }} onClick={() => onMove(-1)}>▲</span>
            <span style={{ ...moveBtn, opacity: index === count - 1 ? 0.3 : 1, pointerEvents: index === count - 1 ? 'none' : 'auto' }} onClick={() => onMove(1)}>▼</span>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{item.rationale}</div>
            {item.status === 'skipped' && item.skip_reason && (
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>Skipped — {item.skip_reason}</div>
            )}
          </div>
        </div>
        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: item.status === 'done' ? 'var(--success)' : item.status === 'skipped' ? 'var(--text-tertiary)' : 'var(--text-secondary)', flexShrink: 0 }}>
          {item.status === 'offered' ? 'open' : item.status}
        </span>
      </div>
      {!resolved && (
        <div style={{ marginTop: 12 }}>
          {skipping ? (
            <div>
              <textarea
                style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }}
                placeholder="Why doesn't this apply? Required."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ ...ghostBtn, opacity: reason.trim() ? 1 : 0.5, pointerEvents: reason.trim() ? 'auto' : 'none' }} onClick={() => { onSkip(reason.trim()); setSkipping(false); }}>Confirm skip</span>
                <span style={ghostBtn} onClick={() => setSkipping(false)}>Cancel</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={primaryBtn} onClick={onDone}>Mark done</span>
              <span style={ghostBtn} onClick={() => setSkipping(true)}>Not applicable — skip</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Screen 4 of the Marketing Plays rebuild (build order item 3) — the
 *  universal free-plays checklist and the gate: the paid channel slate
 *  (MarketingPlaysSlate) stays locked until every item here is done or
 *  skipped with a reason. Order is re-orderable — "reactivation jumps to
 *  #1 for a client with 500 past customers" — via the up/down controls,
 *  not drag-and-drop, to keep this usable on the phone screenshot this
 *  whole rebuild started from. */
export default function FreePlaysChecklist({ brief, clientName, plays, loading, onGenerate, onMarkDone, onSkip, onReorder }: Props) {
  const [generating, setGenerating] = useState(false);

  if (loading) return null;

  if (plays.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Free plays first</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          The checklist for {clientName || 'this client'} — whichever of the universal free plays actually apply to a {brief.business_model?.replace('_', ' ') ?? ''} business. The paid channel slate below stays locked until every item here is checked off or skipped with a reason.
        </div>
        <div
          style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}
          onClick={() => {
            if (generating || !brief.business_model) return;
            setGenerating(true);
            onGenerate(generateFreePlaysChecklist(brief, brief.business_model as BusinessModel, clientName));
            setGenerating(false);
          }}
        >
          {generating ? 'Generating…' : 'Build the checklist'}
        </div>
      </div>
    );
  }

  const move = (id: string, dir: -1 | 1) => {
    const ordered = [...plays];
    const i = ordered.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    onReorder(ordered.map((p) => p.id));
  };

  const doneCount = plays.filter((p) => p.status === 'done' || p.status === 'skipped').length;

  return (
    <div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 12 }}>
        {doneCount} of {plays.length} resolved{doneCount < plays.length ? ' — paid channels stay locked until all are done or skipped' : ' — paid channels are unlocked'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plays.map((p, i) => (
          <ChecklistItem
            key={p.id}
            item={p}
            index={i}
            count={plays.length}
            onDone={() => onMarkDone(p.id)}
            onSkip={(reason) => onSkip(p.id, reason)}
            onMove={(dir) => move(p.id, dir)}
          />
        ))}
      </div>
    </div>
  );
}
