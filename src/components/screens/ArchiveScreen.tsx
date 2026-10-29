import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import { Page, field } from '../mm/Page';
import { Empty } from '../mm/States';

interface Batch { id: string; created_at: string; label: string | null; counts: Record<string, number> }
interface Item { table: string; id: string; name: string; sub: string; batch: string | null; archived_at: string }

/** Settings → Archive: everything a fresh start set aside, by batch,
 *  searchable, restorable one item or a whole batch at a time. */
export default function ArchiveScreen() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<string>('');
  const [q, setQ] = useState('');
  const [table, setTable] = useState('all');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (batch) qs.set('batch', batch);
    if (q.trim()) qs.set('q', q.trim());
    const r = await api<{ batches: Batch[]; items: Item[]; labels: Record<string, string> }>(`/api/archive/list?${qs}`, { method: 'GET' });
    if (r.error) setMsg(r.error); else { setBatches(r.batches); setItems(r.items); setLabels(r.labels); }
    setLoading(false);
  }, [batch, q]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);

  const restore = async (body: Record<string, unknown>, key: string) => {
    setBusy(key); setMsg('');
    const r = await api<{ ok?: boolean; error?: string }>('/api/archive/restore', { body });
    setBusy('');
    if (r.error) setMsg(r.error); else { setMsg('Restored.'); await load(); }
  };
  const shown = items.filter((i) => table === 'all' || i.table === table);
  const tables = [...new Set(items.map((i) => i.table))];

  return (
    <Page title="Archive" sub="Everything a fresh start set aside. Nothing here was deleted." back="Settings" backTo="account-settings">
      <Card title="Batches" meta={`${batches.length}`}>
        {batches.length === 0 && !loading ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No fresh starts yet.</span> : batches.map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <button type="button" className={batch === b.id ? 'mm-btn mm-btn--primary' : 'mm-btn'} style={{ height: 32 }} onClick={() => setBatch(batch === b.id ? '' : b.id)}>{b.id}</button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
              {new Date(b.created_at).toLocaleDateString()} · {Object.entries(b.counts ?? {}).filter(([, n]) => n).map(([t, n]) => `${n} ${(labels[t] ?? t).toLowerCase()}`).join(', ') || 'empty'}
            </span>
            <button type="button" className="mm-btn" style={{ height: 32 }} disabled={!!busy} onClick={() => { if (confirm(`Restore everything in ${b.id}?`)) void restore({ batch: b.id }, b.id); }}>{busy === b.id ? 'Restoring…' : 'Restore batch'}</button>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search archived leads, products, approvals…" style={{ ...field, flex: 1, minWidth: 220 }} />
        <select value={table} onChange={(e) => setTable(e.target.value)} style={{ ...field, width: 'auto' }}>
          <option value="all">Everything</option>
          {tables.map((t) => <option key={t} value={t}>{labels[t] ?? t}</option>)}
        </select>
      </div>
      {msg && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</span>}

      {loading ? null : shown.length === 0 ? <Empty text={q ? 'Nothing archived matches that.' : 'The archive is empty.'} /> : (
        <Card title="Archived" meta={`${shown.length}${shown.length >= 200 ? '+' : ''}`} flush>
          {shown.map((i) => (
            <div key={`${i.table}:${i.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{i.name || '(no name)'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}><Chip>{labels[i.table] ?? i.table}</Chip> {i.sub}</span>
              </div>
              <button type="button" className="mm-btn" style={{ height: 32, flexShrink: 0 }} disabled={!!busy} onClick={() => void restore({ table: i.table, id: i.id }, i.id)}>{busy === i.id ? '…' : 'Restore'}</button>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
