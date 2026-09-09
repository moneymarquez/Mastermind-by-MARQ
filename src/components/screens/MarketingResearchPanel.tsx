import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingBrief } from '../../data/useMarketingBriefs';
import type { MarketResearchNote } from '../../data/useMarketResearchNotes';
import type { ResearchSource } from '../../data/marketResearchSources';
import { CORE_SOURCES, INDUSTRY_SOURCES, matchIndustryKey } from '../../data/marketResearchSources';
import { generateIndustrySources, interpretResearchValue } from '../../lib/marketResearchAi';
import { AiError } from '../../lib/ai';

interface Props {
  brief: MarketingBrief;
  clientName: string;
  notes: MarketResearchNote[];
  loading: boolean;
  onSetIndustry: (industry: string) => void;
  onSaveNote: (sourceKey: string, promptShown: string, valueEntered: string, interpretation: string | null) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const sourceCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '8px 11px', color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const ghostBtn: CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

function SourceCard({ source, note, clientName, brief, onSave }: {
  source: ResearchSource; note: MarketResearchNote | undefined; clientName: string; brief: MarketingBrief;
  onSave: (sourceKey: string, promptShown: string, valueEntered: string, interpretation: string | null) => void;
}) {
  const [value, setValue] = useState(note?.value_entered ?? '');
  const [interpretation, setInterpretation] = useState(note?.interpretation ?? '');
  const [interpreting, setInterpreting] = useState(false);
  const [error, setError] = useState('');

  const getRead = async () => {
    if (!value.trim()) return;
    setInterpreting(true);
    setError('');
    try {
      const read = await interpretResearchValue(source.title, source.lookFor, value, brief, clientName);
      setInterpretation(read);
      onSave(source.key, source.lookFor, value, read);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not get a read on that — try again.');
    } finally {
      setInterpreting(false);
    }
  };

  return (
    <div style={sourceCard}>
      <a href={source.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
        {source.title} ↗
      </a>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}><strong>Look for:</strong> {source.lookFor}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}><strong>Why it matters:</strong> {source.whyItMatters}</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input style={inputStyle} placeholder="Paste what you found" value={value} onChange={(e) => { setValue(e.target.value); setInterpretation(''); }} onBlur={() => value.trim() && onSave(source.key, source.lookFor, value, interpretation || null)} />
        <span style={{ ...ghostBtn, opacity: value.trim() && !interpreting ? 1 : 0.5, pointerEvents: value.trim() && !interpreting ? 'auto' : 'none', flexShrink: 0 }} onClick={getRead}>
          {interpreting ? 'Reading…' : "Nova's read"}
        </span>
      </div>
      {error && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
      {interpretation && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', marginTop: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontStyle: 'italic' }}>
          "{interpretation}"
        </div>
      )}
    </div>
  );
}

/** Screen 3's research panel — the fixed core set plus an industry-
 *  specific swap-in, either pre-written or generated on the fly for an
 *  industry with no entry in the catalog. Sits alongside the channel
 *  slate, scoped to whichever client is selected (unlike the cross-
 *  client track record from item 7). */
export default function MarketingResearchPanel({ brief, clientName, notes, loading, onSetIndustry, onSaveNote }: Props) {
  const [industryDraft, setIndustryDraft] = useState('');
  const [generatedSources, setGeneratedSources] = useState<ResearchSource[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const matchedKey = brief.industry ? matchIndustryKey(brief.industry) : null;
  const preWritten = matchedKey ? INDUSTRY_SOURCES[matchedKey] : null;

  useEffect(() => {
    setGeneratedSources(null);
    setGenerateError('');
  }, [brief.industry]);

  const generate = async () => {
    if (!brief.industry) return;
    setGenerating(true);
    setGenerateError('');
    try {
      const sources = await generateIndustrySources(brief.industry);
      setGeneratedSources(sources);
    } catch (e) {
      setGenerateError(e instanceof AiError ? e.message : 'Could not generate sources for that industry — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const swapSources = preWritten ?? generatedSources;
  const allSources = [...CORE_SOURCES, ...(swapSources ?? [])];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...cardStyle, background: 'var(--surface-4)' }}>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>Before using any of this</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
          This shapes creative, messaging, and where to place a play — it does not license targeting an ad by demographic attribute. Several attributes are restricted or illegal to target directly on ad platforms, and that's not what this data is for.
        </div>
      </div>

      {!brief.industry ? (
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>What's {clientName || 'this client'}'s specific industry?</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.5 }}>
            e.g. "plumber," "food truck," "hair salon" — more specific than the business model above. Unlisted industries still get a real checklist, generated on the spot.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inputStyle} placeholder="e.g. food truck" value={industryDraft} onChange={(e) => setIndustryDraft(e.target.value)} />
            <span style={{ ...primaryBtn, opacity: industryDraft.trim() ? 1 : 0.5, pointerEvents: industryDraft.trim() ? 'auto' : 'none', flexShrink: 0 }} onClick={() => industryDraft.trim() && onSetIndustry(industryDraft.trim())}>
              Save
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>
            Industry: <strong style={{ color: 'var(--text)' }}>{brief.industry}</strong>{!matchedKey && !generatedSources ? ' — no pre-written checklist for this one yet' : ''}
          </div>
          {!matchedKey && !generatedSources && (
            <span style={{ ...ghostBtn, opacity: generating ? 0.6 : 1 }} onClick={() => !generating && generate()}>
              {generating ? 'Generating…' : 'Generate industry sources'}
            </span>
          )}
        </div>
      )}

      {generateError && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)' }}>{generateError}</div>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allSources.map((s) => (
            <SourceCard
              key={s.key}
              source={s}
              note={notes.find((n) => n.source_key === s.key)}
              clientName={clientName}
              brief={brief}
              onSave={onSaveNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
