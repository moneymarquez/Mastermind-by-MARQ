import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { money } from '../../../../data/ecom';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { Empty } from '../../../mm/States';

interface ClientRow { user_id: string; name: string; revenue30: number; red: number; amber: number; last_run: { created_at: string; status: string } | null; stores: { id: string; name: string; current_step: number; health: string; live_url: string | null; revenue30: number; orders30: number }[] }

/** Client Stores (brief §2.1): every Masterminds subscriber on the
 *  E-commerce tier — their stores, 30-day revenue, open flags, last worker
 *  run. Read-only: click a store to see it like your own. */
export default function ClientStoresSection() {
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<{ clients: ClientRow[] }>('/api/ecom/client-stores').then((r) => { if (r.error) setErr(r.error); else setRows(r.clients); }); }, []);
  if (err) return <Card title="Client stores"><span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{err}</span></Card>;
  if (!rows) return <Card title="Client stores">Loading…</Card>;
  if (!rows.length) return <Card title="Client stores"><Empty text="No subscribers run stores yet. When E-commerce opens to Masterminds subscribers, each one shows up here with their stores, revenue, flags and last worker run." /></Card>;
  const sorted = [...rows].sort((a, b) => b.red - a.red || b.amber - a.amber || b.revenue30 - a.revenue30);
  return (
    <Card title="Client stores" meta={`${rows.length} subscriber${rows.length === 1 ? '' : 's'} · read-only`} flush>
      {sorted.map((c, i) => (
        <div key={c.user_id} style={{ borderTop: i ? '1px solid var(--grid)' : 'none' }}>
          <button onClick={() => setOpen(open === c.user_id ? null : c.user_id)} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', padding: '12px 0', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
            <span style={{ minWidth: 0 }}><span style={{ fontWeight: 600 }}>{c.name}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{c.stores.length} store{c.stores.length === 1 ? '' : 's'} · last run {c.last_run ? new Date(c.last_run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'never'}</span></span>
            <span style={{ display: 'flex', gap: 6 }}>{c.red > 0 && <Chip k="bad">{c.red} red</Chip>}{c.amber > 0 && <Chip k="warn">{c.amber} amber</Chip>}</span>
            <span style={{ fontWeight: 600 }}>{money(c.revenue30, 0)}</span>
          </button>
          {open === c.user_id && c.stores.map((s) => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, padding: '8px 0 8px 16px', fontSize: 13.5, color: 'var(--text-secondary)' }}>
              <span>{s.name} · step {s.current_step} · {s.health}{s.live_url && <> · <a href={s.live_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>live ↗</a></>}</span>
              <span>{s.orders30} orders</span><span>{money(s.revenue30, 0)}</span>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}
