import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContentIdea } from '../../data/useContentIdeas';
import type { HookType, HookVerdict, LogHookInput } from '../../data/useHookLog';

interface Props {
  idea: ContentIdea;
  onLog: (idea: ContentIdea, input: LogHookInput) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 14 };
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

const HOOK_TYPES: { key: HookType; label: string }[] = [
  { key: 'question', label: 'Question' },
  { key: 'bold_claim', label: 'Bold claim' },
  { key: 'story_open', label: 'Story open' },
  { key: 'controversy', label: 'Controversy' },
  { key: 'proof_receipt', label: 'Proof/receipt' },
  { key: 'direct_callout', label: 'Direct callout' },
  { key: 'how_to', label: 'How-to' },
];

const VERDICTS: { key: HookVerdict; label: string }[] = [
  { key: 'worked', label: 'Worked' },
  { key: 'didnt_work', label: "Didn't work" },
  { key: 'inconclusive', label: 'Inconclusive' },
];

/** Build order item 7's log — "prompts the hook_log entry for each
 *  published post." ~30 seconds, same as Marketing's outcome log.
 *  Explicitly says it's not a ranking signal yet for the first ~30
 *  posts, so a thin sample isn't mistaken for the feature being
 *  broken. */
export default function ContentHookLogForm({ idea, onLog }: Props) {
  const [hookType, setHookType] = useState<HookType>('story_open');
  const [verdict, setVerdict] = useState<HookVerdict>('worked');
  const [performanceNote, setPerformanceNote] = useState('');
  const [retentionNote, setRetentionNote] = useState('');
  const [postedAt, setPostedAt] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    onLog(idea, { hook_type: hookType, verdict, performance_note: performanceNote, retention_note: retentionNote, posted_at: postedAt });
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Log this post — {idea.title}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
        30 seconds. This says nothing useful for the first ~30 posts — that's expected, not broken. It gets more useful every time.
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Hook type — what kind of open was this</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {HOOK_TYPES.map((h) => (
            <div
              key={h.key}
              onClick={() => setHookType(h.key)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
                border: `1px solid ${hookType === h.key ? 'var(--text)' : 'var(--border)'}`,
                color: hookType === h.key ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {h.label}
            </div>
          ))}
        </div>
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Verdict</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {VERDICTS.map((v) => (
            <div
              key={v.key}
              onClick={() => setVerdict(v.key)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
                border: `1px solid ${verdict === v.key ? 'var(--text)' : 'var(--border)'}`,
                color: verdict === v.key ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {v.label}
            </div>
          ))}
        </div>
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Posted on</div>
        <input style={inputStyle} type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Performance — retention, saves, shares, whatever you actually track (not just likes)</div>
        <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={performanceNote} onChange={(e) => setPerformanceNote(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Retention note — where people dropped off, if you can tell</div>
        <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={retentionNote} onChange={(e) => setRetentionNote(e.target.value)} />
      </div>

      <div style={primaryBtn} onClick={submit}>Log it</div>
    </div>
  );
}
