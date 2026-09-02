import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { BrandLabIntake, BrandLabIntakeSource, Niche } from '../../data/types';
import type { CrmClientWithChildren } from '../../data/useClientCRM';
import { extractIntakeFromTranscript, intakeFromClient, EMPTY_INTAKE } from '../../data/brandLabIntake';
import { AiError } from '../../lib/ai';

export const TONE_OPTIONS = ['Minimal & calm', 'Bold & energetic', 'Editorial & narrative', 'Playful', 'Luxury / premium', 'Technical / precise'];

export interface IntakePayload {
  intake: BrandLabIntake;
  intake_source: BrandLabIntakeSource;
  transcript: string | null;
  client_id: string | null;
  extracted_fields: string[];
  tone: string;
  color_pref: string | null;
  refs: (string | null)[];
}

interface Props {
  niches: Niche[];
  clients: CrmClientWithChildren[];
  onSubmit: (payload: IntakePayload) => Promise<void>;
  onCancel: () => void;
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 };
const input: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '10px 13px',
  color: 'var(--text)', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};
const textarea: CSSProperties = { ...input, resize: 'vertical', lineHeight: 1.5 };
const primaryBtn: CSSProperties = {
  alignSelf: 'flex-start', padding: '11px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)',
  color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', border: 'none',
};
const chip = (active: boolean): CSSProperties => ({
  padding: '9px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body-sm)', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? 'color-mix(in srgb, var(--text) 8%, transparent)' : 'var(--surface)',
  color: active ? 'var(--text)' : 'var(--text-secondary)',
});
const labelRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6 };
const tag: CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 'var(--radius-pill)',
  background: 'color-mix(in srgb, var(--warning) 18%, transparent)', color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
};

type TextKey = Exclude<keyof BrandLabIntake, 'quotes' | 'niche_slug'>;
const FIELDS: { key: TextKey; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'business', label: "What's the business?", placeholder: 'Name + what they actually do' },
  { key: 'audience', label: "Who's the audience?", placeholder: 'Who buys, in their words' },
  { key: 'bottleneck_verbatim', label: 'Their bottleneck — in their words', placeholder: '"We get calls but nobody books"', multiline: true },
  { key: 'services', label: 'Services / products', placeholder: 'What they sell' },
  { key: 'geography', label: 'Service area', placeholder: 'City, region, radius' },
  { key: 'budget', label: 'Budget', placeholder: 'If mentioned' },
  { key: 'wants', label: 'They want', placeholder: 'Explicit asks', multiline: true },
  { key: 'dont_wants', label: "They don't want", placeholder: 'Explicit no-gos', multiline: true },
  { key: 'competitors', label: 'Competitors / reference sites named', placeholder: 'As said' },
];

/** The intake step in front of the original brief form. Three ways in
 *  (transcript, idea, existing client), one brief out. Every extracted
 *  value is tagged and editable; the tag clears the moment the operator
 *  overwrites the field, so "extracted" always means "still the model's
 *  words." Nothing is ever pre-filled that wasn't said. */
export default function BrandLabIntakeForm({ niches, clients, onSubmit, onCancel }: Props) {
  const [source, setSource] = useState<BrandLabIntakeSource>('transcript');
  const [transcript, setTranscript] = useState('');
  const [clientId, setClientId] = useState('');
  const [intake, setIntake] = useState<BrandLabIntake>(EMPTY_INTAKE);
  const [extracted, setExtracted] = useState<Set<keyof BrandLabIntake>>(new Set());
  const [ran, setRan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tone, setTone] = useState(TONE_OPTIONS[0]);
  const [colorPref, setColorPref] = useState('');
  const [refs, setRefs] = useState(['', '', '']);
  const [quoteDraft, setQuoteDraft] = useState('');

  const activeNiches = niches.filter((n) => n.active);

  const applyResult = (r: { intake: BrandLabIntake; extractedFields: (keyof BrandLabIntake)[] }) => {
    setIntake(r.intake);
    setExtracted(new Set(r.extractedFields));
    setRan(true);
  };

  const runTranscript = async () => {
    if (!transcript.trim()) return;
    setBusy(true);
    setError('');
    try {
      applyResult(await extractIntakeFromTranscript(transcript.trim(), niches));
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'Could not read the transcript — try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) applyResult(intakeFromClient(c));
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setTranscript(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const setField = (key: keyof BrandLabIntake, value: string) => {
    setIntake((i) => ({ ...i, [key]: value.trim() === '' ? null : value }));
    setExtracted((s) => { const n = new Set(s); n.delete(key); return n; });
  };

  const addQuote = () => {
    const q = quoteDraft.trim();
    if (!q) return;
    setIntake((i) => ({ ...i, quotes: [...i.quotes, q] }));
    setQuoteDraft('');
  };

  const canSubmit = !!intake.business?.trim() && !!intake.audience?.trim() && (intake.niche_slug !== 'other' || !!intake.niche_custom?.trim());

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        intake,
        intake_source: source,
        transcript: source === 'transcript' ? transcript.trim() || null : null,
        client_id: source === 'client' ? clientId || null : null,
        extracted_fields: Array.from(extracted),
        tone,
        color_pref: colorPref.trim() || null,
        refs: refs.map((r) => r.trim() || null),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brief.');
      setBusy(false);
    }
  };

  const showForm = source === 'idea' || ran;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([['transcript', 'From a call transcript'], ['idea', 'From an idea'], ['client', 'From an existing client']] as [BrandLabIntakeSource, string][]).map(([k, l]) => (
          <div key={k} style={chip(source === k)} onClick={() => { setSource(k); setRan(false); setExtracted(new Set()); setIntake(EMPTY_INTAKE); }}>{l}</div>
        ))}
      </div>

      {source === 'transcript' && (
        <div style={card}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Paste the call</div>
          <textarea style={{ ...textarea, minHeight: 160 }} placeholder="Paste the transcript here…" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ ...primaryBtn, opacity: busy || !transcript.trim() ? 0.6 : 1, pointerEvents: busy || !transcript.trim() ? 'none' : 'auto' }} onClick={runTranscript}>
              {busy ? 'Reading…' : ran ? 'Re-read transcript' : 'Read transcript'}
            </div>
            <label style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              or upload .txt
              <input type="file" accept=".txt,.md,.vtt,.srt,text/plain" style={{ display: 'none' }} onChange={(e) => readFile(e.target.files?.[0])} />
            </label>
          </div>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Anything it pulls out is tagged and editable. If they didn't say it, the field stays blank — it never guesses.
          </div>
        </div>
      )}

      {source === 'client' && (
        <div style={card}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Which client?</div>
          <select style={{ ...input, cursor: 'pointer' }} value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">— pick a client —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}{c.audit ? '' : ' (no audit yet)'}</option>)}
          </select>
          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Their audit answers become the brief foundation. Fields the audit didn't cover stay blank.</div>
        </div>
      )}

      {error && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{error}</div>}

      {showForm && (
        <div style={card}>
          <div>
            <div style={labelRow}>Niche</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {activeNiches.map((n) => (
                <div key={n.slug} style={chip(intake.niche_slug === n.slug)} onClick={() => setField('niche_slug', n.slug)}>
                  {n.name}{extracted.has('niche_slug') && intake.niche_slug === n.slug ? ' ·' : ''}
                </div>
              ))}
            </div>
            {intake.niche_slug === 'other' && (
              <input style={{ ...input, marginTop: 8 }} placeholder="Describe the niche in a few words" value={intake.niche_custom ?? ''} onChange={(e) => setField('niche_custom', e.target.value)} />
            )}
          </div>

          {FIELDS.map((f) => (
            <div key={f.key}>
              <div style={labelRow}>
                {f.label}
                {extracted.has(f.key) && <span style={tag}>{source === 'client' ? 'from audit' : 'from transcript'}</span>}
              </div>
              {f.multiline ? (
                <textarea style={{ ...textarea, minHeight: 64 }} placeholder={f.placeholder} value={intake[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
              ) : (
                <input style={input} placeholder={f.placeholder} value={intake[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
              )}
            </div>
          ))}

          <div>
            <div style={labelRow}>
              Quotes worth putting on the site
              {extracted.has('quotes') && <span style={tag}>from transcript</span>}
            </div>
            {intake.quotes.map((q, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.45 }}>“{q}”</span>
                <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setIntake((s) => ({ ...s, quotes: s.quotes.filter((_, j) => j !== i) }))}>✕</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={input} placeholder="Add a quote" value={quoteDraft} onChange={(e) => setQuoteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addQuote(); }} />
              <div style={{ ...primaryBtn, alignSelf: 'stretch', padding: '0 14px', display: 'flex', alignItems: 'center' }} onClick={addQuote}>Add</div>
            </div>
          </div>

          {[0, 1, 2].map((i) => (
            <input key={i} style={input} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={`Reference site ${i + 1} (optional)`} value={refs[i]} onChange={(e) => setRefs((r) => r.map((v, j) => (j === i ? e.target.value : v)))} />
          ))}

          <div>
            <div style={labelRow}>Tone</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_OPTIONS.map((t) => <div key={t} style={chip(tone === t)} onClick={() => setTone(t)}>{t}</div>)}
            </div>
          </div>
          <input style={input} placeholder="Color preference (optional — leave blank for AI's judgment)" value={colorPref} onChange={(e) => setColorPref(e.target.value)} />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ ...primaryBtn, opacity: canSubmit && !busy ? 1 : 0.5, pointerEvents: canSubmit && !busy ? 'auto' : 'none' }} onClick={submit}>{busy ? 'Saving…' : 'Create brief'}</div>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={onCancel}>Cancel</span>
          </div>
          {!canSubmit && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Needs at least the business, the audience, and a niche.</div>}
        </div>
      )}
    </div>
  );
}
