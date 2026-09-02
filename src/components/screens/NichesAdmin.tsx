import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { useNiches } from '../../data/useNiches';
import type { Niche } from '../../data/types';

interface Props {
  nichesApi: ReturnType<typeof useNiches>;
  onClose: () => void;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16 };
const input: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const textarea: CSSProperties = { ...input, minHeight: 90, resize: 'vertical', lineHeight: 1.5 };
const primaryBtn: CSSProperties = {
  padding: '10px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
};
const ghostBtn: CSSProperties = {
  padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};
const label: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6 };

const LIST_FIELDS: { key: keyof Pick<Niche, 'standard_sections' | 'required_functionality' | 'trust_signals' | 'common_mistakes' | 'keywords'>; title: string; hint: string }[] = [
  { key: 'standard_sections', title: 'Standard sections', hint: 'One per line, in the order the site should read.' },
  { key: 'required_functionality', title: 'Required functionality', hint: 'Non-negotiable interactive things — booking, quote form, click-to-call.' },
  { key: 'trust_signals', title: 'Trust signals', hint: 'What makes this niche\'s buyer believe them.' },
  { key: 'common_mistakes', title: 'Common mistakes', hint: 'What most sites in this niche get wrong — the prompt tells Design to avoid these.' },
  { key: 'keywords', title: 'Keywords', hint: 'SEO baseline. One per line.' },
];

function toLines(arr: string[]): string { return arr.join('\n'); }
function fromLines(s: string): string[] { return s.split('\n').map((l) => l.trim()).filter(Boolean); }

/** The niche library editor. Benchmark-site paste is the first thing on a
 *  niche's page, on purpose — it's the field that gets touched from a phone
 *  mid-week ("found a good one"), everything else is set-and-forget. */
export default function NichesAdmin({ nichesApi, onClose, homeHeadStyle, homeSubStyle }: Props) {
  const { niches, loading, addNiche, updateNiche, removeNiche, addBenchmark, removeBenchmark } = nichesApi;
  const [openId, setOpenId] = useState<string | null>(null);
  const [benchUrl, setBenchUrl] = useState('');
  const [benchNote, setBenchNote] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<string, string>>>>({});
  const [newName, setNewName] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const open = niches.find((n) => n.id === openId) ?? null;

  const draftFor = (n: Niche, field: string, fallback: string) => drafts[n.id]?.[field] ?? fallback;
  const setDraft = (id: string, field: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));

  const saveText = async (n: Niche, field: 'name' | 'buyer_context' | 'visual_conventions') => {
    const value = drafts[n.id]?.[field];
    if (value === undefined || value === n[field]) return;
    await updateNiche(n.id, { [field]: value });
    flash(n.id);
  };
  const saveList = async (n: Niche, field: (typeof LIST_FIELDS)[number]['key']) => {
    const value = drafts[n.id]?.[field];
    if (value === undefined) return;
    await updateNiche(n.id, { [field]: fromLines(value) });
    flash(n.id);
  };
  const flash = (id: string) => { setSavedFlash(id); setTimeout(() => setSavedFlash((s) => (s === id ? null : s)), 1200); };

  const submitBenchmark = async () => {
    if (!open) return;
    const url = benchUrl.trim();
    if (!url) return;
    await addBenchmark(open.id, { url: /^https?:\/\//i.test(url) ? url : `https://${url}`, note: benchNote.trim() });
    setBenchUrl('');
    setBenchNote('');
  };

  const createNiche = async () => {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `niche-${Date.now().toString(36)}`;
    const created = await addNiche({
      slug, name, buyer_context: '', standard_sections: [], required_functionality: [], trust_signals: [], common_mistakes: [],
      visual_conventions: '', benchmark_sites: [], keywords: [], sort_order: niches.length,
    });
    setNewName('');
    if (created) setOpenId(created.id);
  };

  if (open) {
    return (
      <div>
        <span style={ghostBtn} onClick={() => setOpenId(null)}>← All niches</span>
        <div style={{ ...homeHeadStyle, marginTop: 12 }}>{open.name}</div>
        <div style={homeSubStyle}>
          <code style={{ fontSize: 'var(--text-caption)' }}>{open.slug}</code>
          {savedFlash === open.id && <span style={{ marginLeft: 10, color: 'var(--success)', fontSize: 'var(--text-caption)' }}>Saved</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, maxWidth: 680 }}>
          {/* Benchmarks first — the field that compounds. */}
          <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--warning) 45%, var(--border))' }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Benchmark sites ({open.benchmark_sites.length})</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
              Found a site doing this niche right? Paste it with one line on <em>why</em>. Every future prompt for this niche cites these.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input style={input} placeholder="URL" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={benchUrl} onChange={(e) => setBenchUrl(e.target.value)} />
              <input style={input} placeholder="Why it works (one line)" value={benchNote} onChange={(e) => setBenchNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitBenchmark(); }} />
              <div style={primaryBtn} onClick={submitBenchmark}>Add benchmark</div>
            </div>
            {open.benchmark_sites.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {open.benchmark_sites.map((b) => (
                  <div key={b.url} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontWeight: 600, wordBreak: 'break-all' }}>{b.url.replace(/^https?:\/\//, '')}</a>
                      {b.note && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{b.note}</div>}
                    </div>
                    <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={() => removeBenchmark(open.id, b.url)}>Remove</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={label}>Name</div>
            <input style={input} value={draftFor(open, 'name', open.name)} onChange={(e) => setDraft(open.id, 'name', e.target.value)} onBlur={() => saveText(open, 'name')} />
          </div>

          <div style={card}>
            <div style={label}>Buyer context — who buys, what triggers it, how urgent</div>
            <textarea style={textarea} value={draftFor(open, 'buyer_context', open.buyer_context)} onChange={(e) => setDraft(open.id, 'buyer_context', e.target.value)} onBlur={() => saveText(open, 'buyer_context')} />
          </div>

          <div style={card}>
            <div style={label}>Visual conventions — what the category looks like, and what breaking it costs</div>
            <textarea style={textarea} value={draftFor(open, 'visual_conventions', open.visual_conventions)} onChange={(e) => setDraft(open.id, 'visual_conventions', e.target.value)} onBlur={() => saveText(open, 'visual_conventions')} />
          </div>

          {LIST_FIELDS.map((f) => (
            <div key={f.key} style={card}>
              <div style={label}>{f.title} <span style={{ opacity: 0.7 }}>— {f.hint}</span></div>
              <textarea style={textarea} value={draftFor(open, f.key, toLines(open[f.key]))} onChange={(e) => setDraft(open.id, f.key, e.target.value)} onBlur={() => saveList(open, f.key)} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={ghostBtn} onClick={() => updateNiche(open.id, { active: !open.active })}>{open.active ? 'Hide from picker' : 'Show in picker'}</span>
            {open.slug !== 'other' && (
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => { removeNiche(open.id); setOpenId(null); }}>Delete niche</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span style={ghostBtn} onClick={onClose}>← Back to Brand Lab</span>
      <div style={{ ...homeHeadStyle, marginTop: 12 }}>Niche library</div>
      <div style={homeSubStyle}>Pre-loaded research the factory reasons from. Edit anything; the benchmark sites are the part that makes it yours.</div>

      <div style={{ ...card, marginTop: 18, maxWidth: 680, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={input} placeholder="New niche name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createNiche(); }} />
        <div style={primaryBtn} onClick={createNiche}>Add</div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
        {loading && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!loading && niches.length === 0 && (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No niches yet — run schema_050 to seed the presets, or add one above.</div>
        )}
        {niches.map((n) => (
          <div key={n.id} onClick={() => setOpenId(n.id)} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: n.active ? 1 : 0.55 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{n.name}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {n.benchmark_sites.length} benchmark{n.benchmark_sites.length === 1 ? '' : 's'} · {n.standard_sections.length} sections · {n.required_functionality.length} required
              </div>
            </div>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
