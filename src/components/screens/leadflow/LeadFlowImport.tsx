import { useRef, useState } from 'react';
import { parseCsv } from '../../../lib/csv';
import { useLeadflowImport } from '../../../data/useLeadflow';

const GREEN = '#16a34a';

/** Bulk-import a master CSV export into the shared LeadFlow pool — the
 *  file this app already produces/consumes (id, business_name, phone,
 *  ... matching the leads table's own columns 1:1). Dedupes by phone
 *  against the whole existing table rather than trusting a DB-level
 *  upsert, since that table has no unique constraint on phone to key one
 *  off of. See useLeadflowImport for the actual logic. */
export default function LeadFlowImport() {
  const { progress, run } = useLeadflowImport();
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    await run(rows);
  };

  const busy = progress.phase === 'checking' || progress.phase === 'importing';

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: '#111' }}>Import master file</div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
        Upload a CSV export of your leads (same columns as this table already uses). Every row is checked against
        every existing lead by phone number first — anything already in the pool is skipped, never duplicated.
        Rows with no phone number can't be deduped or dialed, so those are skipped too.
      </div>

      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFileSelected} />
      <div
        onClick={() => !busy && inputRef.current?.click()}
        style={{
          marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8,
          background: busy ? '#e5e7eb' : GREEN, color: busy ? '#6b7280' : '#fff', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? 'Working…' : 'Choose CSV file'}
      </div>
      {fileName && <div style={{ fontSize: 'var(--text-caption)', color: '#6b7280', marginTop: 8 }}>{fileName}</div>}

      {progress.phase !== 'idle' && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
          {progress.phase === 'checking' && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: '#374151' }}>
              Checking against existing leads… {progress.existingChecked.toLocaleString()} checked so far.
            </div>
          )}
          {progress.phase === 'importing' && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: '#374151' }}>
              Importing new leads… {progress.importedCount.toLocaleString()} saved so far.
            </div>
          )}
          {progress.phase === 'done' && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: '#111' }}>
              <div style={{ fontWeight: 600, color: GREEN }}>Import complete.</div>
              <div style={{ marginTop: 6 }}>{progress.importedCount.toLocaleString()} new leads added.</div>
              <div>{progress.skippedCount.toLocaleString()} already in the pool, skipped.</div>
              {progress.noPhoneCount > 0 && <div>{progress.noPhoneCount.toLocaleString()} had no phone number, skipped.</div>}
            </div>
          )}
          {progress.phase === 'error' && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: '#dc2626' }}>{progress.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
