import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PipelineItem, PipelineStage } from '../../data/useMarketing';
import type { ContentIdea } from '../../data/useContentIdeas';

interface Props {
  items: PipelineItem[];
  loading: boolean;
  /** Ideas already picked/published that could be sent to the board —
   *  offered as a shortcut so a picked idea doesn't have to be retyped. */
  pickableIdeas: ContentIdea[];
  onAdd: (title: string, ideaId: string | null) => void;
  onMoveStage: (id: string, stage: PipelineStage) => void;
  onRemove: (id: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const itemCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 12 };
const primaryBtn: CSSProperties = {
  padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const STAGES: PipelineStage[] = ['idea', 'drafted', 'filmed', 'scheduled', 'published'];
const STAGE_LABEL: Record<PipelineStage, string> = { idea: 'Idea', drafted: 'Drafted', filmed: 'Filmed', scheduled: 'Scheduled', published: 'Published' };

/** Screen 4 of the Content Creation rebuild (build order item 4) — a
 *  board over the shared marketing_content_pipeline table (schema_083
 *  widened its stage enum to add 'filmed' and gave it plan_id/idea_id so
 *  this board and Marketing's own can coexist on the same table without
 *  colliding). The shot-day batcher (item 5) reads whatever's sitting in
 *  'idea'/'drafted' here — this screen is just where those rows live and
 *  move. */
export default function ContentPipelineBoard({ items, loading, pickableIdeas, onAdd, onMoveStage, onRemove }: Props) {
  const [newTitle, setNewTitle] = useState('');

  const alreadyOnBoard = new Set(items.map((i) => i.idea_id).filter(Boolean));
  const availableIdeas = pickableIdeas.filter((i) => !alreadyOnBoard.has(i.id));

  return (
    <div>
      <div style={{ ...cardStyle, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, flex: '1 1 220px' }} placeholder="New pipeline item" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <div style={primaryBtn} onClick={() => { if (!newTitle.trim()) return; onAdd(newTitle.trim(), null); setNewTitle(''); }}>Add</div>
      </div>

      {availableIdeas.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Send a picked idea to the board</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableIdeas.map((idea) => (
              <div key={idea.id} style={{ ...itemCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>{idea.title}</div>
                <span style={{ ...primaryBtn, padding: '6px 12px', fontSize: 'var(--text-small)' }} onClick={() => onAdd(idea.title, idea.id)}>+ Add to board</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {STAGES.map((stage) => (
            <div key={stage}>
              <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>{STAGE_LABEL[stage]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.filter((i) => i.stage === stage).map((i) => (
                  <div key={i.id} style={itemCard}>
                    <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{i.title}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {STAGES.filter((s) => s !== stage).map((s) => (
                        <span key={s} style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }} onClick={() => onMoveStage(i.id, s)}>
                          → {STAGE_LABEL[s]}
                        </span>
                      ))}
                      <span style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => onRemove(i.id)}>Delete</span>
                    </div>
                  </div>
                ))}
                {items.filter((i) => i.stage === stage).length === 0 && (
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
