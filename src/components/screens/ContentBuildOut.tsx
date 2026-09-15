import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContentGrowthPlan } from '../../data/useContentGrowth';
import type { ContentIdea, ContentIdeaPatch } from '../../data/useContentIdeas';
import { generateContentBuildOut } from '../../lib/contentBuildOut';
import type { ContentBuildOutResult } from '../../lib/contentBuildOut';
import { AiError } from '../../lib/ai';

interface Props {
  plan: ContentGrowthPlan;
  clientName: string;
  /** The one picked idea, if any — build-out only ever applies to
   *  whichever idea the operator actually picked from the slate. */
  pickedIdea: ContentIdea | null;
  onSave: (id: string, patch: ContentIdeaPatch) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const subCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 };
const pre: CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--text-body-sm)', color: 'var(--text)', margin: 0, lineHeight: 1.6 };

/** Screen 3 of the Content Creation rebuild (build order item 3) — full
 *  script, shot list, caption, and the hook written three ways for
 *  whichever idea is picked. Saves directly onto the content_ideas row
 *  (script/shot_list/caption/hook_variants are already columns there) —
 *  simpler than Marketing's build-out, which had to create separate
 *  marketing_assets rows since marketing_plays had no such columns. */
export default function ContentBuildOut({ plan, clientName, pickedIdea, onSave }: Props) {
  const [draft, setDraft] = useState<ContentBuildOutResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!pickedIdea) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Nothing picked yet</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Pick an idea from the slate above — build-out generates the full script, shot list, caption, and three hook variants for whichever one you choose.
        </div>
      </div>
    );
  }

  const hasSaved = !!pickedIdea.script;

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const result = await generateContentBuildOut(pickedIdea, plan, clientName);
      setDraft(result);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not generate the build-out — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(pickedIdea.id, { hook_variants: draft.hook_variants, script: draft.script, shot_list: draft.shot_list, caption: draft.caption });
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Building out: <strong style={{ color: 'var(--text)' }}>{pickedIdea.title}</strong></div>

      {!draft && !hasSaved && (
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>No build-out yet</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
            Generates a full script, a concrete shot list, a caption, and the hook written three ways so you can test which opening lands.
          </div>
          {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
          <div style={{ ...primaryBtn, marginTop: 14, display: 'inline-block', opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }} onClick={() => !generating && generate()}>
            {generating ? 'Generating…' : 'Build it out'}
          </div>
        </div>
      )}

      {draft && (
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Preview — not saved yet</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={subCard}>
              <div style={label}>Hook — three ways</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {draft.hook_variants.map((h, i) => (
                  <div key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontStyle: 'italic' }}>{i + 1}. "{h}"</div>
                ))}
              </div>
            </div>
            <div style={subCard}><div style={label}>Script</div><p style={{ ...pre, marginTop: 8 }}>{draft.script}</p></div>
            <div style={subCard}><div style={label}>Shot list</div><p style={{ ...pre, marginTop: 8 }}>{draft.shot_list}</p></div>
            <div style={subCard}><div style={label}>Caption</div><p style={{ ...pre, marginTop: 8 }}>{draft.caption}</p></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <span style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => !saving && save()}>{saving ? 'Saving…' : 'Save this build-out'}</span>
            <span style={ghostBtn} onClick={() => !saving && generate()}>Regenerate</span>
            <span style={ghostBtn} onClick={() => setDraft(null)}>Discard</span>
          </div>
        </div>
      )}

      {hasSaved && !draft && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Saved build-out</div>
            <span style={ghostBtn} onClick={() => !generating && generate()}>{generating ? 'Generating…' : 'Regenerate'}</span>
          </div>
          {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {pickedIdea.hook_variants && pickedIdea.hook_variants.length > 0 && (
              <div style={subCard}>
                <div style={label}>Hook — three ways</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {pickedIdea.hook_variants.map((h, i) => (
                    <div key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontStyle: 'italic' }}>{i + 1}. "{h}"</div>
                  ))}
                </div>
              </div>
            )}
            {pickedIdea.script && <div style={subCard}><div style={label}>Script</div><p style={{ ...pre, marginTop: 8 }}>{pickedIdea.script}</p></div>}
            {pickedIdea.shot_list && <div style={subCard}><div style={label}>Shot list</div><p style={{ ...pre, marginTop: 8 }}>{pickedIdea.shot_list}</p></div>}
            {pickedIdea.caption && <div style={subCard}><div style={label}>Caption</div><p style={{ ...pre, marginTop: 8 }}>{pickedIdea.caption}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}
