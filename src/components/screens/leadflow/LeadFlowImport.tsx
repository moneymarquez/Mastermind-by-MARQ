import { useRef, useState } from 'react';
import { parseCsv } from '../../../lib/csv';
import { useLeadflowImport } from '../../../data/useLeadflow';
import { Banner } from './ui';

/** Bulk-import a master CSV export into the shared LeadFlow pool. Dedupes by
 *  phone against the whole existing table (no unique constraint on phone to
 *  upsert on); rows without a phone are skipped. See useLeadflowImport. */
export default function LeadFlowImport() {
  const { progress, run } = useLeadflowImport();
  const [fileName, setFileName] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const rows = parseCsv(await file.text());
    await run(rows);
  };
  const busy = progress.phase === 'checking' || progress.phase === 'importing';
  const n = (v: number) => v.toLocaleString();

  return (
    <div className="lf-panel" style={{ maxWidth: 640, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>Import master file</div>
        <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
          Upload a CSV export of your leads, same columns as the leads table. Every row is checked by phone against every existing lead first, so nothing already in the pool is duplicated. Rows without a phone can't be deduped or dialed, so they're skipped.
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void take(f); }} />

      {!busy && progress.phase !== 'done' && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void take(e.dataTransfer.files?.[0]); }}
          style={{ border: `1px dashed ${drag ? 'var(--lf-accent)' : 'var(--lf-border-strong)'}`, background: drag ? 'var(--lf-accent-wash)' : 'transparent', borderRadius: 'var(--lf-r-panel)', padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, transition: 'background-color .12s, border-color .12s' }}>
          <button className="lf-btn lf-btn--secondary" onClick={() => inputRef.current?.click()}>Choose CSV file</button>
          <span className="lf-label">or drop a .csv here</span>
          {fileName && <span className="lf-mono" style={{ fontSize: 13 }}>{fileName}</span>}
        </div>
      )}

      {busy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fileName && <div className="lf-mono" style={{ fontSize: 13 }}>{fileName}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--lf-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: 4, background: 'var(--lf-accent)', borderRadius: 2, width: progress.phase === 'importing' && progress.totalRows ? `${Math.min(100, (progress.importedCount / Math.max(1, progress.totalRows)) * 100)}%` : '30%', transition: 'width .18s' }} />
            </div>
            <span className="lf-mono" style={{ fontSize: 13 }}>
              {progress.phase === 'checking' ? `checking ${n(progress.existingChecked)}` : `importing ${n(progress.importedCount)}${progress.totalRows ? ` / ${n(progress.totalRows)}` : ''}`}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--lf-text-tertiary)' }}>{progress.phase === 'checking' ? 'Checking against existing leads…' : 'Importing new leads…'}</div>
        </div>
      )}

      {progress.phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Banner s="go" title="Import complete" />
          <div style={{ border: '1px solid var(--lf-border)', borderRadius: 'var(--lf-r-panel)' }}>
            {[['Added', progress.importedCount], ['Skipped as duplicates', progress.skippedCount], ['Skipped without phone', progress.noPhoneCount]].map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: i ? '1px solid var(--lf-border)' : 0, fontSize: 14 }}>
                <span style={{ color: 'var(--lf-text-secondary)' }}>{l}</span><span className="lf-mono">{n(v as number)}</span>
              </div>
            ))}
          </div>
          <button className="lf-btn lf-btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={() => inputRef.current?.click()}>Import another file</button>
        </div>
      )}

      {progress.phase === 'error' && <Banner s="stop">{progress.error}</Banner>}
    </div>
  );
}
