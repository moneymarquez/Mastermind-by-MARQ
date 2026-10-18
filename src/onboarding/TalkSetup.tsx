import { useState } from 'react';
import { ONBOARDING_INTRO, ONBOARDING_PROMPT, VOICE_HOWTO } from '../data/onboardingPrompt';
import { parseImportText } from '../data/importFormat';
import type { ImportData } from '../data/importFormat';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import ImportPreview from '../components/solo/ImportPreview';

/** Onboarding step 1 (brief §4.5): "set up Masterminds by talking". The
 *  person's own AI interviews them and hands back an import block; this
 *  previews it and applies it. "Set up manually" keeps the old questions. */
export default function TalkSetup({ onDone, onManual }: { onDone: (d: ImportData) => void; onManual: () => void }) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState<ImportData | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const copy = async () => { try { await navigator.clipboard.writeText(ONBOARDING_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('Copy was blocked. Select the prompt below and copy it by hand.'); } };
  const read = async () => {
    setErr(''); setBusy(true);
    let r = parseImportText(text);
    if (!r) { const x = await api<{ ok?: boolean; data?: ImportData; errors?: string[]; error?: string }>('/api/solo/import-parse', { body: { text } }); r = x.error ? { ok: false, data: null, errors: [x.error], unknownKeys: [] } : { ok: !!x.ok, data: x.data ?? null, errors: x.errors ?? [], unknownKeys: [] }; }
    setBusy(false);
    if (!r.ok || !r.data) { setErr(r.errors.join(' ') || 'Couldn\'t read that. Paste the whole block your AI gave you.'); return; }
    const { data: imp } = await supabase.from('brain_imports').insert({ method: 'block', parsed: r.data, source: r.data.source }).select('id').single();
    setImportId((imp as { id: string } | null)?.id ?? null);
    setData(r.data);
  };
  const box = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column' as const, gap: 12 };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: 'calc(56px + env(safe-area-inset-top)) 16px 40px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '-0.03em' }}>Set up Masterminds by talking</h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ONBOARDING_INTRO} It already knows a lot about you, so this takes about ten minutes, and you land on a Home that's already set up.</p>
        {!data && (
          <>
            <div style={box}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><strong style={{ flex: 1 }}>1. Copy the prompt</strong><button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void copy()}>{copied ? 'Copied ✓' : 'Copy prompt'}</button></div>
              <details><summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>See the prompt</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--surface-2)', padding: 12, borderRadius: 10, maxHeight: 260, overflowY: 'auto' }}>{ONBOARDING_PROMPT}</pre></details>
            </div>
            <div style={box}>
              <strong>2. Paste it into your AI and turn on voice</strong>
              {VOICE_HOWTO.map((v) => <div key={v.app} style={{ fontSize: 14, color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>{v.app}:</strong> {v.steps}</div>)}
            </div>
            <div style={box}>
              <strong>3. Paste what it gives you back</strong>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="===MASTERMINDS IMPORT v1=== …" style={{ minHeight: 160, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
              {err && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{err}</div>}
              <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !text.trim()} onClick={() => void read()}>{busy ? 'Reading…' : 'Preview my setup'}</button>
            </div>
          </>
        )}
        {data && <div style={box}><strong>Here's what goes in</strong><ImportPreview data={data} importId={importId} source="onboarding" onCancel={() => setData(null)} onApplied={() => onDone(data)} /></div>}
        <button onClick={onManual} style={{ all: 'unset', cursor: 'pointer', alignSelf: 'center', fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Set up manually instead</button>
      </div>
    </div>
  );
}
