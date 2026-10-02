import { useEffect, useState } from 'react';
import { useLists } from '../../../data/useInbound';
import type { ListFilters, MktList } from '../../../data/useInbound';
import { VENTURES } from '../../../data/mktEngine';
import { E, Badge, TeachingEmpty, btn, field, label } from '../ecom/ecomShared';
import { askConfirm } from '../../../lib/confirm';

const COUNT_LABELS: [string, string][] = [['total', 'Total'], ['callable', 'Callable'], ['filtered', 'Checked'], ['chain_excluded', 'Chains'], ['duplicates', 'Duplicates'], ['sized', 'Sized'], ['called', 'Called']];

/** M2 — saved slices of LeadFlow (state, city, category, size) with what
 *  the Lead Filter has done to them: how many are chains or duplicates,
 *  how many are callable, how many you've already called. The Campaign
 *  Planner picks a list when it plans the week. */
export default function ListsTab() {
  const api = useLists();
  const [editing, setEditing] = useState<MktList | 'new' | null>(null);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn('primary')} onClick={() => setEditing('new')}>＋ List</button>
      </div>
      {editing && <ListEditor list={editing === 'new' ? null : editing} api={api} onDone={() => setEditing(null)} />}
      {!api.loading && api.lists.length === 0 && !editing && <div style={{ marginTop: 14 }}><TeachingEmpty what="No lists yet. A list is a slice of your LeadFlow leads — e.g. single-location food trucks in Austin, chains and duplicates out — with live counts." worker="the Lead Filter (tags chains, size and duplicates so the counts mean something)" /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10, marginTop: 14 }}>
        {api.lists.map((l) => (
          <div key={l.id} style={{ ...E.card, padding: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: E.text, flex: 1, minWidth: 0 }}>{l.name}</span>
              <Badge color={E.faint}>{VENTURES.find((v) => v.id === l.venture)?.label ?? l.venture}</Badge>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4 }}>{describe(l.filters)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
              {COUNT_LABELS.filter(([k]) => l.counts[k] != null).map(([k, lab]) => (
                <div key={k}><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: k === 'callable' ? E.green : E.text }}>{Number(l.counts[k]).toLocaleString()}</div><div style={{ fontSize: 10.5, color: E.faint }}>{lab}</div></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => api.refresh(l)}>Refresh</button>
              <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => setEditing(l)}>Edit</button>
              <span style={{ fontSize: 10.5, color: E.faint, marginLeft: 'auto' }}>{new Date(l.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function describe(f: ListFilters): string {
  const where = [f.city, f.state].filter(Boolean).join(', ');
  return [f.category || 'All categories', where && `in ${where}`, f.size && (f.size === 'single' ? 'single-location' : 'multi-location'), f.excludeChains !== false && 'no chains', f.excludeDuplicates !== false && 'no duplicates', f.uncalledOnly && 'not called yet'].filter(Boolean).join(' · ');
}

function ListEditor({ list, api, onDone }: { list: MktList | null; api: ReturnType<typeof useLists>; onDone: () => void }) {
  const [name, setName] = useState(list?.name ?? '');
  const [venture, setVenture] = useState(list?.venture ?? 'madebymarq');
  const [f, setF] = useState<ListFilters>(list?.filters ?? { excludeChains: true, excludeDuplicates: true, size: '' });
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<ListFilters>) => setF((x) => ({ ...x, ...p }));
  useEffect(() => { const t = setTimeout(() => { void api.countFor(f).then(setPreview).catch(() => setPreview(null)); }, 400); return () => clearTimeout(t); }, [f, api]);
  const save = async () => { setBusy(true); const e = await api.save({ id: list?.id, name, venture, filters: f }); setBusy(false); if (e) setErr(e); else onDone(); };
  return (
    <div style={{ ...E.card, padding: 14, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={label}>{list ? 'Edit list' : 'New list'}</div>
      <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Austin food trucks, single" autoFocus />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...field, flex: '2 1 160px' }} value={f.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="Category contains (food truck, salon…)" />
        <input style={{ ...field, flex: '1 1 110px' }} value={f.city ?? ''} onChange={(e) => set({ city: e.target.value })} placeholder="City" />
        <input style={{ ...field, flex: '0 1 80px' }} value={f.state ?? ''} onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })} placeholder="TX" maxLength={2} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Size" style={{ ...field, width: 'auto' }} value={f.size ?? ''} onChange={(e) => set({ size: e.target.value as ListFilters['size'] })}><option value="">Any size</option><option value="single">Single-location</option><option value="multi">Multi-location</option></select>
        <select aria-label="Venture" style={{ ...field, width: 'auto' }} value={venture} onChange={(e) => setVenture(e.target.value)}>{VENTURES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 'var(--text-body)', color: E.muted }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.excludeChains !== false} onChange={(e) => set({ excludeChains: e.target.checked })} /> No chains</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.excludeDuplicates !== false} onChange={(e) => set({ excludeDuplicates: e.target.checked })} /> No duplicates</label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!f.uncalledOnly} onChange={(e) => set({ uncalledOnly: e.target.checked })} /> Not called yet</label>
      </div>
      {preview && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><strong style={{ color: E.green }}>{preview.callable.toLocaleString()}</strong> callable of {preview.total.toLocaleString()} matching · {preview.chain_excluded} chains · {preview.duplicates} duplicates · {preview.total - preview.filtered} not checked by the Lead Filter yet</div>}
      {err && <div style={{ fontSize: 'var(--text-caption)', color: E.red }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btn('primary')} disabled={busy || !name.trim()} onClick={save}>{busy ? 'Counting…' : 'Save list'}</button>
        <button style={btn('ghost')} onClick={onDone}>Cancel</button>
        {list && <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={async () => { if (await askConfirm('Delete this list?')) { await api.remove(list.id); onDone(); } }}>Delete</button>}
      </div>
    </div>
  );
}
