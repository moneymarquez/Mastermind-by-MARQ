import { useMemo, useState } from 'react';
import { previewImport, previewSentence } from '../../data/importFormat';
import type { ImportData } from '../../data/importFormat';
import { applyImport } from '../../data/applyImport';
import type { ApplyResult } from '../../data/applyImport';

/** Always preview before applying (brief §4.4): one checkbox per change,
 *  a plain sentence of what will happen, then Apply. */
export default function ImportPreview({ data, importId, source, onApplied, onCancel }: { data: ImportData; importId: string | null; source: 'brain_dump' | 'onboarding'; onApplied: (r: ApplyResult) => void; onCancel?: () => void }) {
  const items = useMemo(() => previewImport(data), [data]);
  const [on, setOn] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((i) => on.has(i.id));
  const apply = async () => { setBusy(true); const r = await applyImport(data, chosen, { importId, source }); setBusy(false); onApplied(r); };
  if (!items.length) return <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing in there to import. Paste the whole block, including the ===MASTERMINDS IMPORT v1=== lines.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{previewSentence(chosen)}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => setOn(new Set(items.map((i) => i.id)))}>All</button>
        <button className="mm-btn" style={{ height: 32, fontSize: 13 }} onClick={() => setOn(new Set())}>None</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        {items.map((i, k) => (
          <label key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderTop: k ? '1px solid var(--grid)' : 'none', cursor: 'pointer' }}>
            <input type="checkbox" checked={on.has(i.id)} onChange={() => setOn((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} style={{ marginTop: 3 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14 }}>{i.label}</span>{i.detail && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{i.detail}</span>}</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="mm-btn mm-btn--primary" style={{ flex: 1, height: 44 }} disabled={busy || !chosen.length} onClick={() => void apply()}>{busy ? 'Applying…' : `Apply ${chosen.length}`}</button>
        {onCancel && <button className="mm-btn" style={{ height: 44 }} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
