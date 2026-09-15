import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { PipelineItem } from '../../data/useMarketing';
import type { ContentIdea } from '../../data/useContentIdeas';

interface Props {
  /** Pipeline items for this plan sitting in 'idea' or 'drafted' — built
   *  but not yet filmed. Anything already 'filmed'/'scheduled'/
   *  'published' has no business showing up on a shoot-day list. */
  items: PipelineItem[];
  ideas: ContentIdea[];
  onMarkAllFilmed: (ids: string[]) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const setupCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const primaryBtn: CSSProperties = {
  padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-block',
};
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 };

function shotLines(shotList: string): string[] {
  return shotList.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Screen 4's "important part" (build order item 5) — groups everything
 *  ready to film into one session instead of one trip per post. "This
 *  is the feature that converts intent into published posts": the whole
 *  point is that filming happens once a week, so the batcher has to
 *  actually save a second trip, not just list items separately. */
export default function ContentShotDayBatcher({ items, ideas, onMarkAllFilmed }: Props) {
  const [confirming, setConfirming] = useState(false);
  const ideaById = new Map(ideas.map((i) => [i.id, i]));

  if (items.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Nothing queued to shoot</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Build out an idea and send it to the pipeline — once a few are queued in "Idea" or "Drafted," they'll group here into one shoot day.
        </div>
      </div>
    );
  }

  const totalSetups = items.reduce((sum, item) => {
    const idea = item.idea_id ? ideaById.get(item.idea_id) : null;
    return sum + (idea?.shot_list ? shotLines(idea.shot_list).length : 0);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)' }}>
          Shoot day — {totalSetups} setup{totalSetups === 1 ? '' : 's'} across {items.length} post{items.length === 1 ? '' : 's'}
        </div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Everything below in one trip. Shoot it all, then mark the whole batch filmed at once.
        </div>
      </div>

      {items.map((item) => {
        const idea = item.idea_id ? ideaById.get(item.idea_id) : null;
        return (
          <div key={item.id} style={setupCard}>
            <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{item.title}</div>
            {!idea?.shot_list && (
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>
                Not built out yet — no shot list. Build it out from the slate first, or handle this one manually.
              </div>
            )}
            {idea?.hook_line && (
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', marginTop: 8, fontStyle: 'italic' }}>Open with: "{idea.hook_line}"</div>
            )}
            {idea?.shot_list && (
              <div style={{ marginTop: 10 }}>
                <div style={label}>Setups</div>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {shotLines(idea.shot_list).map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}
            {idea?.script && (
              <div style={{ marginTop: 10 }}>
                <div style={label}>Lines to deliver</div>
                <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.6 }}>{idea.script}</p>
              </div>
            )}
          </div>
        );
      })}

      {confirming ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={primaryBtn} onClick={() => { onMarkAllFilmed(items.map((i) => i.id)); setConfirming(false); }}>Confirm — mark all {items.length} filmed</span>
          <span style={{ ...primaryBtn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} onClick={() => setConfirming(false)}>Cancel</span>
        </div>
      ) : (
        <div style={primaryBtn} onClick={() => setConfirming(true)}>Shot everything — mark batch filmed</div>
      )}
    </div>
  );
}
