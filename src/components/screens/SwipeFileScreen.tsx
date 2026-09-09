import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSwipeFile, filterSwipeFile } from '../../data/useSwipeFile';
import type { SwipeFileEntry, SwipeFileInput } from '../../data/useSwipeFile';
import type { HookType } from '../../data/useHookLog';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const entryCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 12 };
const ghostBtn: CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', display: 'inline-block',
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
const HOOK_TYPE_LABEL: Record<string, string> = Object.fromEntries(HOOK_TYPES.map((h) => [h.key, h.label]));

function AddEntryForm({ onAdd }: { onAdd: (input: SwipeFileInput) => void }) {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [hookType, setHookType] = useState<HookType | ''>('');
  const [format, setFormat] = useState('');
  const [whyItWorked, setWhyItWorked] = useState('');
  const [performanceNote, setPerformanceNote] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [open, setOpen] = useState(false);

  const submit = () => {
    if (!url.trim()) return;
    onAdd({
      url,
      platform: platform.trim() || null,
      hook_type: hookType || null,
      format: format.trim() || null,
      why_it_worked: whyItWorked,
      performance_note: performanceNote,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setUrl(''); setPlatform(''); setHookType(''); setFormat(''); setWhyItWorked(''); setPerformanceNote(''); setTagsText('');
    setOpen(false);
  };

  if (!open) {
    return <div style={primaryBtn} onClick={() => setOpen(true)}>+ Add to swipe file</div>;
  }

  return (
    <div style={cardStyle}>
      <div style={fieldWrap}>
        <div style={labelStyle}>URL</div>
        <input style={inputStyle} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <div style={fieldWrap}>
            <div style={labelStyle}>Platform</div>
            <input style={inputStyle} placeholder="TikTok, Reels, Shorts…" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <div style={fieldWrap}>
            <div style={labelStyle}>Format</div>
            <input style={inputStyle} placeholder="Talking head, montage…" value={format} onChange={(e) => setFormat(e.target.value)} />
          </div>
        </div>
      </div>
      <div style={fieldWrap}>
        <div style={labelStyle}>Hook type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {HOOK_TYPES.map((h) => (
            <div
              key={h.key}
              onClick={() => setHookType(hookType === h.key ? '' : h.key)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
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
        <div style={labelStyle}>Why it worked — the structural breakdown, in your own words (pacing, what the hook did, why it landed)</div>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={whyItWorked} onChange={(e) => setWhyItWorked(e.target.value)} />
      </div>
      <div style={fieldWrap}>
        <div style={labelStyle}>Performance note — what you actually observed, e.g. "hit 400k"</div>
        <input style={inputStyle} value={performanceNote} onChange={(e) => setPerformanceNote(e.target.value)} />
      </div>
      <div style={fieldWrap}>
        <div style={labelStyle}>Tags, comma separated</div>
        <input style={inputStyle} placeholder="food, build-in-public, steal-this-format" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ ...primaryBtn, opacity: url.trim() ? 1 : 0.5, pointerEvents: url.trim() ? 'auto' : 'none' }} onClick={submit}>Save</span>
        <span style={ghostBtn} onClick={() => setOpen(false)}>Cancel</span>
      </div>
    </div>
  );
}

function EntryCard({ entry, onRemove }: { entry: SwipeFileEntry; onRemove: () => void }) {
  return (
    <div style={entryCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <a href={entry.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', textDecoration: 'none', wordBreak: 'break-all' }}>
          {entry.url} ↗
        </a>
        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={onRemove}>Delete</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>
        {entry.platform && <span>{entry.platform}</span>}
        {entry.format && <span>{entry.format}</span>}
        {entry.hook_type && <span>{HOOK_TYPE_LABEL[entry.hook_type] ?? entry.hook_type}</span>}
        {entry.performance_note && <span>{entry.performance_note}</span>}
      </div>
      {entry.why_it_worked && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{entry.why_it_worked}</div>}
      {entry.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {entry.tags.map((t) => <span key={t} style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>#{t}</span>)}
        </div>
      )}
    </div>
  );
}

/** Build order item 8, the final item — swipe_file's own tab, "not
 *  buried in the module." The operator writes their own structural
 *  breakdown of something they actually watched (hook, pacing, why it
 *  worked) rather than the system claiming to analyze a video it never
 *  saw — this app has no way to fetch or watch content behind a bare
 *  URL, so pretending otherwise would be exactly the kind of invented
 *  capability the rest of this rebuild has been careful to avoid.
 *  "Feeds the slate with patterns actually working right now" and "on a
 *  blank day, adapt a proven format" both just need this to be real,
 *  searchable, and tagged — which it is. */
export default function SwipeFileScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { entries, loading, error, addEntry, removeEntry } = useSwipeFile();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  const filtered = filterSwipeFile(entries, query, activeTag);

  return (
    <div>
      <div style={homeHeadStyle}>Swipe File</div>
      <div style={homeSubStyle}>Real formats you've watched work, broken down and tagged — the layer that keeps Content Creation current.</div>

      <div style={{ marginTop: 20, marginBottom: 14 }}>
        <AddEntryForm onAdd={addEntry} />
      </div>

      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

      {entries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <input style={{ ...inputStyle, maxWidth: 260 }} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {allTags.map((t) => (
            <span
              key={t}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              style={{ ...ghostBtn, border: `1px solid ${activeTag === t ? 'var(--text)' : 'var(--border)'}`, color: activeTag === t ? 'var(--text)' : 'var(--text-secondary)' }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>
          {entries.length === 0 ? 'Nothing saved yet — paste in something you\'ve seen actually work.' : 'Nothing matches that search.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((e) => <EntryCard key={e.id} entry={e} onRemove={() => removeEntry(e.id)} />)}
      </div>
    </div>
  );
}
