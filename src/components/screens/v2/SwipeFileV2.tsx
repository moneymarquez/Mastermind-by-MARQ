import { useState } from 'react';
import { useSwipeFile, filterSwipeFile } from '../../../data/useSwipeFile';
import type { SwipeFileEntry, SwipeFileInput } from '../../../data/useSwipeFile';
import type { HookType } from '../../../data/useHookLog';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, area, useModule } from '../../mm/Page';
import { askConfirm } from '../../../lib/confirm';

const HOOK_TYPES: { key: HookType; label: string }[] = [
  { key: 'question', label: 'Question' }, { key: 'bold_claim', label: 'Bold claim' }, { key: 'story_open', label: 'Story open' },
  { key: 'controversy', label: 'Controversy' }, { key: 'proof_receipt', label: 'Proof / receipt' }, { key: 'direct_callout', label: 'Direct callout' }, { key: 'how_to', label: 'How-to' },
];
const HOOK_LABEL: Record<string, string> = Object.fromEntries(HOOK_TYPES.map((h) => [h.key, h.label]));
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const pill = (on: boolean) => ({ padding: '7px 12px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--text)' : 'transparent', color: on ? 'var(--bg)' : 'var(--text-secondary)' });

/** Swipe File: formats you've watched work, broken down in your own words
 *  and tagged. The app never claims to have watched a link itself. */
export default function SwipeFileV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const { entries, loading, error, addEntry, removeEntry } = useSwipeFile();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  const shown = filterSwipeFile(entries, q, tag);
  const hooks = new Map<string, number>(); for (const e of entries) if (e.hook_type) hooks.set(e.hook_type, (hooks.get(e.hook_type) ?? 0) + 1);
  const topHook = [...hooks].sort((a, b) => b[1] - a[1])[0];
  const platforms = new Set(entries.map((e) => e.platform).filter(Boolean));
  const sub = 'Real formats you’ve watched work, broken down and tagged';
  if (!loading && entries.length === 0) {
    return (
      <Page title="Swipe File" sub={sub} back="Content" backTo="content" fab={{ t: 'Add', onClick: () => setAdding(true) }}>
        <Empty text="Nothing saved yet. Paste in something you've seen actually work and write down why." cta="Add to swipe file" onCta={() => setAdding(true)} />
        {adding && <AddSheet onClose={() => setAdding(false)} onAdd={addEntry} />}
      </Page>
    );
  }
  return (
    <Page title="Swipe File" sub={sub} back="Content" backTo="content" fab={{ t: 'Add', onClick: () => setAdding(true) }}>
      {error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>}
      {!phone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Stat label="Saved" value={String(entries.length)} />
          <Stat label="Top hook" value={topHook ? HOOK_LABEL[topHook[0]] ?? topHook[0] : '—'} pill={topHook ? `${topHook[1]} saved` : undefined} />
          <Stat label="Platforms" value={String(platforms.size)} pill={[...platforms].slice(0, 2).join(', ') || undefined} />
          <Stat label="Tags" value={String(tags.length)} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search why it worked, platform, tags" aria-label="Search swipe file" style={{ ...field, flex: '1 1 240px', width: 'auto', maxWidth: phone ? undefined : 360 }} />
        {tags.map((t) => <button key={t} onClick={() => setTag(tag === t ? null : t)} style={pill(tag === t)}>#{t}</button>)}
      </div>
      {shown.length === 0 && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing matches that search.</span>}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: phone ? 12 : 16, alignItems: 'start' }}>
        {shown.map((e) => <Entry key={e.id} e={e} onRemove={async () => { if (await askConfirm('Delete this from your swipe file?')) removeEntry(e.id); }} />)}
      </div>
      {adding && <AddSheet onClose={() => setAdding(false)} onAdd={addEntry} />}
    </Page>
  );
}

function Entry({ e, onRemove }: { e: SwipeFileEntry; onRemove: () => void }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 10, background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 6px, var(--surface-2) 6px 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--text-tertiary)' }}>{(e.platform ?? 'link').slice(0, 6)}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{host(e.url)} ↗</a>
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{[e.platform, e.format].filter(Boolean).join(' · ') || 'No platform noted'}</span>
        </div>
        <button className="mm-icon-btn" aria-label="Delete" onClick={onRemove} style={{ width: 32, height: 32, color: 'var(--text-tertiary)' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {e.hook_type && <Chip k="accent">{HOOK_LABEL[e.hook_type] ?? e.hook_type}</Chip>}
        {e.performance_note && <Chip k="good">{e.performance_note}</Chip>}
      </div>
      {e.why_it_worked && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{e.why_it_worked}</p>}
      {e.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{e.tags.map((t) => <span key={t} style={{ fontSize: 12, color: 'var(--text-tertiary)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px' }}>#{t}</span>)}</div>}
    </section>
  );
}

function AddSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (i: SwipeFileInput) => void }) {
  const [url, setUrl] = useState(''); const [platform, setPlatform] = useState(''); const [format, setFormat] = useState('');
  const [hook, setHook] = useState<HookType | ''>(''); const [why, setWhy] = useState(''); const [perf, setPerf] = useState(''); const [tags, setTags] = useState('');
  return (
    <Sheet title="Add to swipe file" onClose={onClose} width={520}>
      <Field l="URL"><input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={field} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field l="Platform"><input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="TikTok, Reels…" style={field} /></Field>
        <Field l="Format"><input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Talking head…" style={field} /></Field>
      </div>
      <Field l="Hook type"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{HOOK_TYPES.map((h) => <button type="button" key={h.key} onClick={() => setHook(hook === h.key ? '' : h.key)} style={pill(hook === h.key)}>{h.label}</button>)}</div></Field>
      <Field l="Why it worked, in your words"><textarea value={why} onChange={(e) => setWhy(e.target.value)} style={area} placeholder="Pacing, what the hook did, why it landed" /></Field>
      <Field l="What you observed"><input value={perf} onChange={(e) => setPerf(e.target.value)} placeholder="Hit 400k" style={field} /></Field>
      <Field l="Tags, comma separated"><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="food, build-in-public" style={field} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={!url.trim()} onClick={() => { onAdd({ url, platform: platform.trim() || null, hook_type: hook || null, format: format.trim() || null, why_it_worked: why, performance_note: perf, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }); onClose(); }}>Save</button>
    </Sheet>
  );
}
