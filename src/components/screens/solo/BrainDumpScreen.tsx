import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, Tabs, Sheet, field, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import MiniMarkdown from '../../MiniMarkdown';
import ImportPreview from '../../solo/ImportPreview';
import { IMPORT_TEMPLATE } from '../../../data/importFormat';
import type { ImportData } from '../../../data/importFormat';
import { undoImport } from '../../../data/applyImport';
import { authedFetch } from '../../../lib/api';

const CATEGORIES = ['APHS', 'Made by Marq', 'Masterminds', 'E-commerce', 'Personal'];
const ACCEPT = '.md,.txt,.pdf,.docx,.json,text/plain,text/markdown,application/pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
interface Doc { id: string; title: string; category: string; file_name: string | null; mime: string | null; body_text: string | null; created_at: string }
interface Imp { id: string; method: string; status: string; created_at: string; applied: unknown[] }

/** Brain → Brain Dump (brief §4.4): drop or paste anything; it's filed in
 *  the Documents library, and a Masterminds Import (or anything the AI can
 *  pull from) builds the app out after a preview. */
export default function BrainDumpScreen() {
  const { nav } = useModule();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('Personal');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState<{ data: ImportData; importId: string | null; errors: string[] } | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [imports, setImports] = useState<Imp[]>([]);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Doc | null>(null);
  const [drag, setDrag] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const load = useCallback(async () => {
    const [d, i] = await Promise.all([supabase.from('brain_documents').select('id,title,category,file_name,mime,body_text,created_at').order('created_at', { ascending: false }).limit(500), supabase.from('brain_imports').select('id,method,status,created_at,applied').order('created_at', { ascending: false }).limit(10)]);
    setDocs((d.data ?? []) as Doc[]); setImports((i.data ?? []) as Imp[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cats = useMemo(() => [...new Set([...CATEGORIES, ...docs.map((d) => d.category)])], [docs]);
  const shown = docs.filter((d) => (cat === 'All' || d.category === cat) && (!q || `${d.title} ${d.body_text ?? ''}`.toLowerCase().includes(q.toLowerCase())));

  const submit = async () => {
    if (!text.trim() && !file) return;
    setBusy(true); setMsg(''); setPreview(null);
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('text', text);
    const res = await authedFetch('/api/solo/import-parse', { method: 'POST', body: form });
    const r = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: ImportData; errors?: string[]; method?: 'block' | 'ai'; text?: string; file_name?: string | null; error?: string };
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    // Every drop is kept in the library, import or not.
    const body = r.text ?? text;
    let docId: string | null = null;
    if (body.trim()) {
      const { data } = await supabase.from('brain_documents').insert({ title: (file?.name ?? body.split('\n')[0]).slice(0, 120) || 'Brain dump', category, file_name: file?.name ?? null, mime: file?.type || 'text/plain', size_bytes: file?.size ?? body.length, body_text: body }).select('id').single();
      docId = (data as { id: string } | null)?.id ?? null;
    }
    if (!r.ok || !r.data) { setMsg(`Saved to Documents. ${(r.errors ?? []).join(' ')}`); await load(); return; }
    const { data: imp } = await supabase.from('brain_imports').insert({ method: r.method ?? 'block', parsed: r.data, document_id: docId, source: r.data.source }).select('id').single();
    setPreview({ data: r.data, importId: (imp as { id: string } | null)?.id ?? null, errors: r.errors ?? [] });
    setText(''); setFile(null); await load();
  };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); };

  return (
    <Page title="Brain Dump" sub="Drop a file or paste anything. It's filed, and anything actionable becomes tasks, goals and settings after you check it.">
      <Tabs tabs={[{ id: 'brain', label: 'Brain' }, { id: 'dump', label: 'Brain Dump' }]} value="dump" onChange={(t) => { if (t === 'brain') nav('brain'); }} />
      <Card title="Drop it here">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} style={{ border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea style={{ ...field, height: 140, padding: 12, resize: 'vertical' }} value={text} placeholder="Paste notes, a chat, or the Masterminds Import block your AI gave you…" onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="mm-btn" style={{ height: 40, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>📎 {file ? file.name : 'Choose a file (.md .txt .pdf .docx .json)'}<input type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <select style={{ ...field, width: 'auto', height: 40 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">{cats.map((c) => <option key={c}>{c}</option>)}</select>
            <div style={{ flex: 1 }} />
            <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={busy || (!text.trim() && !file)} onClick={() => void submit()}>{busy ? 'Reading…' : 'Read it'}</button>
          </div>
        </div>
        {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</div>}
        <button className="mm-btn" style={{ alignSelf: 'flex-start', height: 32, fontSize: 13 }} onClick={() => setShowFormat((x) => !x)}>{showFormat ? 'Hide' : 'What is'} the Masterminds Import format?</button>
        {showFormat && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Any AI can write it. Paste this template into ChatGPT or Claude and ask it to fill it in from your conversation. Every part is optional; anything unknown is kept as a note.<pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, background: 'var(--surface-2)', padding: 10, borderRadius: 8, overflowX: 'auto' }}>{IMPORT_TEMPLATE}</pre><button className="mm-btn" style={{ height: 32 }} onClick={() => void navigator.clipboard?.writeText(IMPORT_TEMPLATE)}>Copy template</button></div>}
      </Card>
      {preview && (
        <Card title="Check before it's applied" meta={preview.errors.join(' ')}>
          <ImportPreview data={preview.data} importId={preview.importId} source="brain_dump" onCancel={() => setPreview(null)} onApplied={(r) => { setPreview(null); setMsg(`Applied ${r.applied}.${r.failed.length ? ` ${r.failed.length} didn't go in: ${r.failed.map((f) => `${f.label} (${f.error})`).join('; ')}` : ''} You can undo it below.`); void load(); }} />
        </Card>
      )}
      {imports.some((i) => i.status === 'applied') && (
        <Card title="Recent imports">
          {imports.filter((i) => i.status !== 'previewed').map((i, k) => (
            <div key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: k ? '1px solid var(--grid)' : 'none', fontSize: 14 }}>
              <span style={{ flex: 1 }}>{new Date(i.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {i.applied.length} changes · {i.method === 'ai' ? 'read by AI' : 'import block'}</span>
              {i.status === 'applied' ? <button className="mm-btn" style={{ height: 32 }} onClick={async () => { if (!window.confirm('Undo this import? Everything it added is removed and old macros come back.')) return; const n = await undoImport(i.id); setMsg(`Undid ${n} changes.`); await load(); }}>Undo</button> : <Chip k="neutral">{i.status}</Chip>}
            </div>
          ))}
        </Card>
      )}
      <Card title="Documents" meta={`${docs.length}`}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['All', ...cats].map((c) => <button key={c} className={`mm-btn ${cat === c ? 'mm-btn--primary' : ''}`} style={{ height: 32, padding: '0 12px', fontSize: 13 }} onClick={() => setCat(c)}>{c}{c !== 'All' ? ` ${docs.filter((d) => d.category === c).length}` : ''}</button>)}</div>
        <input style={field} placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
        {shown.length === 0 && <Empty text={docs.length ? 'Nothing matches.' : 'Everything you drop is kept here, by category. Put everything for James under APHS.'} />}
        {shown.map((d, k) => (
          <button key={d.id} onClick={() => setOpen(d)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: k ? '1px solid var(--grid)' : 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
            <Chip k="neutral">{d.category}</Chip>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </Card>
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)} width={760}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <select style={{ ...field, width: 'auto', height: 36 }} value={open.category} onChange={async (e) => { const c = e.target.value; await supabase.from('brain_documents').update({ category: c, updated_at: new Date().toISOString() }).eq('id', open.id); setOpen({ ...open, category: c }); await load(); }}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="mm-btn" style={{ height: 36 }} onClick={async () => { const c = window.prompt('New category name')?.trim(); if (!c) return; await supabase.from('brain_documents').update({ category: c, updated_at: new Date().toISOString() }).eq('id', open.id); setOpen({ ...open, category: c }); await load(); }}>New category</button>
            <button className="mm-btn" style={{ height: 36, color: 'var(--danger)', marginLeft: 'auto' }} onClick={async () => { if (!window.confirm('Delete this document?')) return; await supabase.from('brain_documents').delete().eq('id', open.id); setOpen(null); await load(); }}>Delete</button>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}><MiniMarkdown text={open.body_text ?? '(no text)'} /></div>
        </Sheet>
      )}
    </Page>
  );
}
