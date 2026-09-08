import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingBrief } from '../../data/useMarketingBriefs';
import type { MarketingPlay } from '../../data/useMarketingPlays';
import { BUSINESS_MODELS, generateSlate } from '../../data/marketingPlaysEngine';
import type { BusinessModel } from '../../data/marketingPlaysEngine';

interface Props {
  brief: MarketingBrief;
  clientName: string;
  plays: MarketingPlay[];
  loading: boolean;
  onSetBusinessModel: (model: BusinessModel) => void;
  onGenerateSlate: (drafts: ReturnType<typeof generateSlate>) => void;
  onPick: (id: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const playCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const metaRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' };
const CATEGORY_LABEL: Record<string, string> = { free: 'Free', paid: 'Paid', offline: 'Offline' };
const STATUS_COLOR: Record<string, string> = { active: 'var(--success)', parked: 'var(--text-tertiary)', offered: 'var(--text-secondary)', won: 'var(--success)', killed: 'var(--danger)' };

function PlayCard({ play, onPick }: { play: MarketingPlay; onPick: (id: string) => void }) {
  return (
    <div style={playCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{play.title}</div>
        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: STATUS_COLOR[play.status], flexShrink: 0 }}>{play.status}</span>
      </div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{play.rationale}</div>
      <div style={metaRow}>
        {play.cost_estimate && <span>Cost: {play.cost_estimate}</span>}
        {play.speed_to_signal && <span>Signal: {play.speed_to_signal}</span>}
        {play.effort_level && <span>Effort: {play.effort_level}</span>}
      </div>
      {play.honest_risk && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4, fontStyle: 'italic' }}>Risk: {play.honest_risk}</div>
      )}
      {(play.status === 'offered' || play.status === 'parked') && (
        <div style={{ marginTop: 12 }}>
          <span style={ghostBtn} onClick={() => onPick(play.id)}>{play.status === 'parked' ? 'Switch to this play' : 'Pick this play'}</span>
        </div>
      )}
    </div>
  );
}

/** Screen 3 of the Marketing Plays rebuild (build order item 2) — the
 *  branch-on-business-model slate, not yet gated behind the free-plays
 *  checklist (that gate is item 3) or built out into assets (item 4).
 *  Just: generate, show the reasoning, let the operator pick one. */
export default function MarketingPlaysSlate({ brief, clientName, plays, loading, onSetBusinessModel, onGenerateSlate, onPick }: Props) {
  const [pendingModel, setPendingModel] = useState<BusinessModel | null>(null);
  const [generating, setGenerating] = useState(false);

  if (!brief.business_model) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>What kind of business is this?</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
          The play slate branches on this, not on industry — a plumber and a peptide ecommerce brand need completely different channels even though neither is "retail."
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BUSINESS_MODELS.map((bm) => (
            <div
              key={bm.key}
              onClick={() => setPendingModel(bm.key)}
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1px solid ${pendingModel === bm.key ? 'var(--text)' : 'var(--border)'}`,
              }}
            >
              <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: pendingModel === bm.key ? 'var(--text)' : 'var(--text-secondary)' }}>{bm.label}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3 }}>{bm.hint}</div>
            </div>
          ))}
        </div>
        <div
          style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: pendingModel ? 1 : 0.5, pointerEvents: pendingModel ? 'auto' : 'none' }}
          onClick={() => pendingModel && onSetBusinessModel(pendingModel)}
        >
          Save
        </div>
      </div>
    );
  }

  if (loading) return null;

  if (plays.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>No slate yet</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Generates a set of viable plays for {clientName || 'this client'} — free, paid, and offline — each with the reasoning, cost, speed to a real signal, and honest risk. Nothing gets launched here; you pick one to build out next.
        </div>
        <div
          style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}
          onClick={() => {
            if (generating || !brief.business_model) return;
            setGenerating(true);
            const drafts = generateSlate(brief, brief.business_model, clientName);
            onGenerateSlate(drafts);
            setGenerating(false);
          }}
        >
          {generating ? 'Generating…' : `Generate slate for ${clientName || 'this client'}`}
        </div>
      </div>
    );
  }

  const byCategory = (cat: string) => plays.filter((p) => p.category === cat);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {(['free', 'paid', 'offline'] as const).map((cat) => {
        const list = byCategory(cat);
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{CATEGORY_LABEL[cat]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map((p) => <PlayCard key={p.id} play={p} onPick={onPick} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
