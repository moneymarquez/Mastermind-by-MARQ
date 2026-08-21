import type { ChangeEvent } from 'react';
import type { StickyIdea } from '../../types';
import Icon from '../../Icon';

interface Props {
  newIdeaText: string;
  newIdeaEst: string;
  onNewIdeaText: (e: ChangeEvent<HTMLInputElement>) => void;
  onNewIdeaEst: (e: ChangeEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  stickyIdeas: StickyIdea[];
  onRemove: (id: number) => void;
}

export default function StickySpotScreen({ newIdeaText, newIdeaEst, onNewIdeaText, onNewIdeaEst, onAdd, stickyIdeas, onRemove }: Props) {
  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>Sticky Spot</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>Fast-cash plays — $500-$1,000 in the same hour or day.</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13.5, outline: 'none' }}
          placeholder="Idea (e.g. Sell a website build)"
          value={newIdeaText}
          onChange={onNewIdeaText}
        />
        <input
          style={{ width: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13.5, outline: 'none' }}
          placeholder="$ est."
          value={newIdeaEst}
          onChange={onNewIdeaEst}
        />
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid var(--text)', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={onAdd}
        >
          <Icon name="plus" style={{ marginRight: 6 }} color="var(--text)" />
          Add
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {stickyIdeas.map((idea) => (
          <div key={idea.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{idea.text}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text)' }}>{idea.est}</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onRemove(idea.id)}>
              <Icon name="x" size={14} color="var(--text-tertiary)" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
