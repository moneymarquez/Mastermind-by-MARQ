import { useMemo, useRef, useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { api } from '../../../../lib/api';
import { IMPORT_FIELDS, columnsOf, guessMapping, mapRows, missingRequired, parseAny, type ImportKey, type Mapping, type RawRow } from '../../../../data/leadImport';

const sel: React.CSSProperties = { height: 38, borderRadius: 'var(--g-r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, minWidth: 0, width: '100%' };

/** One-time import of the terminal scraper's output: pick the file, check the column mapping, import in batches. Matched by place_id; existing leads are left as they are. */
export default function ImportTab() {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<RawRow[]>([]);
  const [map, setMap] = useState<Mapping>({});
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; added: number; existing: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const cols = useMemo(() => columnsOf(rows), [rows]);
  const prepared = useMemo(() => (rows.length ? mapRows(rows, map) : null), [rows, map]);
  const missing = missingRequired(map);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(''); setProgress(null);
    const parsed = parseAny(f.name, await f.text());
    setName(f.name); setRows(parsed); setMap(guessMapping(columnsOf(parsed)));
    if (!parsed.length) setMsg('No rows found in that file. It should be a CSV or JSON file with one business per row.');
  };
  const go = async () => {
    if (!prepared) return;
    setBusy(true); stop.current = false; setMsg('');
    const total = prepared.leads.length; let added = 0, existing = 0;
    for (let i = 0; i < total; i += 500) {
      if (stop.current) break;
      const r = await api<{ added?: number; existing?: number }>('/api/outreach/import', { body: { leads: prepared.leads.slice(i, i + 500) } });
      if (r.error) { setMsg(`Stopped at ${i}: ${r.error}. You can run it again; leads already imported are skipped.`); break; }
      added += r.added ?? 0; existing += r.existing ?? 0;
      setProgress({ done: Math.min(total, i + 500), total, added, existing });
    }
    setBusy(false);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Import your old scraper results" meta="one time">
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Pick the file your terminal scraper made (CSV or JSON). You'll check which column is which, then it's added to the lead table. A business already there (same Google place ID) is left alone, so running it twice is safe.</div>
        <input type="file" accept=".csv,.json,.ndjson,.jsonl,text/csv,application/json" onChange={(e) => void onFile(e.target.files?.[0])} aria-label="Scraper file" />
        {msg && <div style={{ fontSize: 13.5, color: 'var(--warning)' }}>{msg}</div>}
      </Card>
      {rows.length > 0 && (
        <Card title="Match the columns" meta={`${name} · ${rows.length.toLocaleString()} rows`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {f.label}{'required' in f && f.required ? ' *' : ''}
                <select style={sel} value={map[f.key as ImportKey] ?? ''} onChange={(e) => setMap({ ...map, [f.key]: e.target.value || undefined })}>
                  <option value="">(skip)</option>
                  {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
          {rows[0] && <details style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}><summary style={{ cursor: 'pointer' }}>First row as it will be imported</summary><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(prepared?.leads[0] ?? 'This row has no place ID or name yet.', null, 1)}</code></details>}
          {missing.length > 0 && <Chip k="warn">Still needed: {missing.join(', ')}</Chip>}
          {prepared && missing.length === 0 && <div style={{ fontSize: 13.5 }}><strong>{prepared.leads.length.toLocaleString()}</strong> ready · {prepared.skipped.toLocaleString()} skipped (no place ID or name) · {prepared.duplicates.toLocaleString()} repeated in the file</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={busy || missing.length > 0 || !prepared?.leads.length} onClick={() => void go()}>{busy ? 'Importing…' : `Import ${prepared?.leads.length.toLocaleString() ?? 0} leads`}</button>
            {busy && <button className="mm-btn" style={{ height: 40 }} onClick={() => { stop.current = true; }}>Stop</button>}
          </div>
          {progress && <div style={{ fontSize: 13.5 }}>{progress.done.toLocaleString()} of {progress.total.toLocaleString()} checked · <strong>{progress.added.toLocaleString()}</strong> added · {progress.existing.toLocaleString()} already there{progress.done >= progress.total ? ' · Done. Client Finder will check them for gaps.' : ''}</div>}
        </Card>
      )}
    </div>
  );
}
