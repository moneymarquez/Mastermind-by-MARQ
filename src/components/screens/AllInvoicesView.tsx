import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { useClientCRM } from '../../data/useClientCRM';
import type { ClientInvoice, ClientInvoiceStatus } from '../../data/types';
import { cardStyle, selectStyle } from './ClientCRMScreen';
import InvoiceDetailView from './InvoiceDetailView';

interface Props {
  crm: ReturnType<typeof useClientCRM>;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

type SortKey = 'created' | 'due';

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function statusColor(status: ClientInvoiceStatus): string {
  if (status === 'paid') return 'var(--success)';
  if (status === 'draft' || status === 'void') return 'var(--text-tertiary)';
  return 'var(--danger)'; // sent / overdue
}

/** Every invoice across every client — the list the build prompt asks
 *  for (columns, status color, sort, filter), with a real row-click ->
 *  detail flow via the same InvoiceDetailView ClientDetailView's
 *  per-client tab uses. */
export default function AllInvoicesView({ crm, homeHeadStyle, homeSubStyle }: Props) {
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ClientInvoiceStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [selected, setSelected] = useState<{ invoice: ClientInvoice; clientName: string } | null>(null);

  const rows = useMemo(() => {
    let flat = crm.clients.flatMap((c) => c.invoices.map((inv) => ({ inv, clientId: c.id, clientName: c.business_name })));
    if (clientFilter !== 'all') flat = flat.filter((r) => r.clientId === clientFilter);
    if (statusFilter !== 'all') flat = flat.filter((r) => r.inv.status === statusFilter);
    flat.sort((a, b) => {
      if (sortKey === 'due') return (b.inv.due_date ?? '').localeCompare(a.inv.due_date ?? '');
      return b.inv.created_at.localeCompare(a.inv.created_at);
    });
    return flat;
  }, [crm.clients, clientFilter, statusFilter, sortKey]);

  if (selected) {
    // Re-derive from crm.clients on every render so an action inside the
    // detail view (send/void/mark paid) reflects immediately without a
    // stale local copy.
    const fresh = crm.clients.flatMap((c) => c.invoices.map((inv) => ({ inv, clientName: c.business_name }))).find((r) => r.inv.id === selected.invoice.id);
    if (!fresh) {
      setSelected(null);
      return null;
    }
    return <InvoiceDetailView invoice={fresh.inv} clientBusinessName={fresh.clientName} crm={crm} onClose={() => setSelected(null)} />;
  }

  return (
    <div>
      <div style={homeHeadStyle}>All Invoices</div>
      <div style={homeSubStyle}>Every invoice across every client, newest first.</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <select style={{ ...selectStyle, width: 'auto' }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="all">All clients</option>
          {crm.clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
        <select style={{ ...selectStyle, width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClientInvoiceStatus | 'all')}>
          <option value="all">All statuses</option>
          {(['draft', 'sent', 'paid', 'overdue', 'void'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...selectStyle, width: 'auto' }} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="created">Sort: newest</option>
          <option value="due">Sort: due date</option>
        </select>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 780 }}>
        {rows.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No invoices match this filter.</div>}
        {rows.map(({ inv, clientName }) => (
          <div key={inv.id} style={{ ...cardStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }} onClick={() => setSelected({ invoice: inv, clientName })}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', width: 64, flexShrink: 0 }}>#{inv.invoice_number}</div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{clientName}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>{inv.description}</div>
            </div>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{money(inv.amount)}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', width: 100, flexShrink: 0 }}>{inv.due_date ?? '—'}</div>
            <span style={{
              fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', borderRadius: 'var(--radius-pill)', padding: '3px 9px', flexShrink: 0,
              color: statusColor(inv.status), border: `1px solid color-mix(in srgb, ${statusColor(inv.status)} 40%, transparent)`,
            }}>
              {inv.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
