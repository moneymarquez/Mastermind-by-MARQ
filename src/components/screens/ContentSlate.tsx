import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContentGrowthPlan } from '../../data/useContentGrowth';
import type { ContentIdea } from '../../data/useContentIdeas';
import { generateContentSlate } from '../../data/contentIdeaEngine';
import type { LastCheckinSignal } from '../../data/contentIdeaEngine';

interface Props {
  plan: ContentGrowthPlan;
  clientName: string;
  ideas: ContentIdea[];
  loading: boolean;
  /** The plan's most recent check-in, if any — feeds "the answers
   *  reshape next week's slate" (build order item 6). Undefined for a
   *  plan with no check-in history yet. */
  lastCheckin?: LastCheckinSignal;
  onGenerateSlate: (drafts: ReturnType<typeof generateContentSlate>) => void;
  onPick: (id: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const ideaCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const metaRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' };
const STATUS_COLOR: Record<string, string> = { picked: 'var(--success)', parked: 'var(--text-tertiary)', offered: 'var(--text-secondary)', published: 'var(--success)' };

function IdeaCard({ idea, onPick }: { idea: ContentIdea; onPick: (id: string) => void }) {
  return (
    <div style={ideaCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{idea.title}</div>
        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[idea.status], flexShrink: 0 }}>{idea.status}</span>
      </div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.5 }}>"{idea.hook_line}"</div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{idea.rationale}</div>
      <div style={metaRow}>
        {idea.pillar && <span>Pillar: {idea.pillar}</span>}
        {idea.format && <span>Format: {idea.format}</span>}
      </div>
      {(idea.status === 'offered' || idea.status === 'parked') && (
        <div style={{ marginTop: 12 }}>
          <span style={ghostBtn} onClick={() => onPick(idea.id)}>{idea.status === 'parked' ? 'Switch to this idea' : 'Pick this idea'}</span>
        </div>
      )}
    </div>
  );
}

/** Screen 2 of the Content Creation rebuild (build order item 2, with
 *  item 6's reshaping folded in) — generate, show the reasoning, let the
 *  operator pick one to build out (item 3). Locked behind page_purpose
 *  the same way Marketing's slate is locked behind business_model — "do
 *  not generate one slate for both." Unlike Marketing's one-time channel
 *  slate, this can always generate another round — content needs a
 *  fresh batch on a weekly cadence, informed by the latest check-in. */
export default function ContentSlate({ plan, clientName, ideas, loading, lastCheckin, onGenerateSlate, onPick }: Props) {
  const [generating, setGenerating] = useState(false);

  if (!plan.page_purpose) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Set the page purpose first</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Pick "My own audience" or "Leads for this business" above — it changes the entire slate, so nothing generates until it's set.
        </div>
      </div>
    );
  }

  if (loading) return null;

  const generate = () => {
    if (generating) return;
    setGenerating(true);
    onGenerateSlate(generateContentSlate(plan, clientName, lastCheckin));
    setGenerating(false);
  };

  if (ideas.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>No slate yet</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Generates a set of ideas for {clientName || 'this account'} — each with the actual hook line and why it should land for this viewer. Nothing gets built out here; you pick one to build out next.
        </div>
        <div style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }} onClick={generate}>
          {generating ? 'Generating…' : `Generate slate for ${clientName || 'this account'}`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} onPick={onPick} />)}
      <div>
        <span style={ghostBtn} onClick={generate}>{generating ? 'Generating…' : "Generate more ideas for next week"}</span>
      </div>
    </div>
  );
}
