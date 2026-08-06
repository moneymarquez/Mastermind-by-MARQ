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
      <div style={{ fontSize: 32, fontWeight: 600, color: '#F5F6F7', letterSpacing: '-0.01em' }}>Sticky Spot</div>
      <div style={{ fontSize: 14, color: '#8A8F98', marginTop: 6 }}>Fast-cash plays — $500-$1,000 in the same hour or day.</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 220, background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none' }}
          placeholder="Idea (e.g. Sell a website build)"
          value={newIdeaText}
          onChange={onNewIdeaText}
        />
        <input
          style={{ width: 100, background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none' }}
          placeholder="$ est."
          value={newIdeaEst}
          onChange={onNewIdeaEst}
        />
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={onAdd}
        >
          <Icon name="plus" style={{ marginRight: 6 }} color="#F5F6F7" />
          Add
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
        {stickyIdeas.map((idea) => (
          <div key={idea.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{idea.text}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F5F6F7' }}>{idea.est}</span>
            <span style={{ cursor: 'pointer' }} onClick={() => onRemove(idea.id)}>
              <Icon name="x" size={14} color="#565b64" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
