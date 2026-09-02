import type { CSSProperties } from 'react';
import type { ClientInvoiceStatus } from '../data/types';

interface Props {
  from?: string;
  billTo: string;
  description: string;
  amount: number | null;
  dueDate: string | null;
  invoiceNumber?: number;
  status?: ClientInvoiceStatus;
  paidAt?: string | null;
  style?: CSSProperties;
}

export function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const micro: CSSProperties = { fontSize: 'var(--text-micro)', letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)' };

/** The invoice as a document — one component, every context: the owner's
 *  draft preview before sending, the owner's read-only view after, and
 *  the client's own copy in the portal. Same layout in all three so what
 *  the client sees is exactly what was approved. */
export default function InvoiceDocument({ from = 'Made by MARQ', billTo, description, amount, dueDate, invoiceNumber, status, paidAt, style }: Props) {
  const amt = amount !== null && amount > 0 ? money(amount) : '—';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={micro}>From</div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{from}</div>
          {invoiceNumber !== undefined && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>Invoice #{invoiceNumber}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={micro}>Bill to</div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{billTo}</div>
          {status && (
            <div style={{ ...micro, marginTop: 4, color: status === 'paid' ? 'var(--success)' : status === 'void' ? 'var(--text-tertiary)' : 'var(--danger)' }}>
              {status === 'paid' && paidAt ? `Paid ${new Date(paidAt).toLocaleDateString()}` : status}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 'var(--text-body)', color: 'var(--text)', flex: 1 }}>{description || 'Untitled line item'}</span>
          <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{amt}</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>{dueDate ? `Due ${dueDate}` : 'Due on receipt'}</span>
        <span style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)' }}>{amt}</span>
      </div>
    </div>
  );
}
