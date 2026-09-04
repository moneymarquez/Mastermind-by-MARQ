import type { CSSProperties } from 'react';
import type { ClientInvoiceStatus } from '../data/types';

interface Props {
  from?: string;
  /** Letterhead contact details — optional since the client-portal call
   *  site can't read business_profile (owner-only RLS) and shouldn't try
   *  to; the document still reads fine with just the business name. */
  businessAddress?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
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

const micro: CSSProperties = { fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-tertiary)' };
const contactLine: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5 };

function statusStyle(status: ClientInvoiceStatus): CSSProperties {
  const color = status === 'paid' ? 'var(--success)' : status === 'void' ? 'var(--text-tertiary)' : 'var(--danger)';
  return {
    fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color,
    border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`, borderRadius: 'var(--radius-pill)', padding: '3px 10px',
  };
}

/** The invoice as a document — one component, every context: the owner's
 *  draft preview before sending, the owner's read-only view after, and
 *  the client's own copy in the portal. Same layout in all three so what
 *  the client sees is exactly what was approved.
 *
 *  Deliberately no accent color — this app's whole shell runs on the
 *  accent-free "ink" system (background-vs-text inverted for emphasis,
 *  never a brand hue), and an invoice is the one document a client keeps;
 *  it should read as a letterhead, not a UI card. Weight comes from
 *  scale and rule lines instead: a real document title, a two-column
 *  info block (from a real print-invoice layout, not a chat bubble), an
 *  itemized table with its own header row even for one line, and a
 *  closing note — versus the single low-contrast card this used to be. */
export default function InvoiceDocument({
  from = 'Made by MARQ', businessAddress, businessEmail, businessPhone, businessWebsite,
  billTo, description, amount, dueDate, invoiceNumber, status, paidAt, style,
}: Props) {
  const amt = amount !== null && amount > 0 ? money(amount) : '—';
  const hasContact = businessAddress || businessEmail || businessPhone || businessWebsite;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>Invoice</div>
        {status && (
          <span style={statusStyle(status)}>{status === 'paid' && paidAt ? `Paid ${new Date(paidAt).toLocaleDateString()}` : status}</span>
        )}
      </div>
      {invoiceNumber !== undefined && (
        <div style={{ ...contactLine, marginTop: 4 }}>№ {invoiceNumber}{dueDate ? ` · Due ${dueDate}` : ''}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={micro}>From</div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{from}</div>
          {hasContact && (
            <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {businessAddress && <div style={contactLine}>{businessAddress}</div>}
              {businessEmail && <div style={contactLine}>{businessEmail}</div>}
              {businessPhone && <div style={contactLine}>{businessPhone}</div>}
              {businessWebsite && <div style={contactLine}>{businessWebsite}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          <div style={micro}>Bill to</div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{billTo}</div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={micro}>Description</span>
          <span style={micro}>Amount</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 'var(--text-body)', color: 'var(--text)', flex: 1 }}>{description || 'Untitled line item'}</span>
          <span style={{ fontSize: 'var(--text-body)', color: 'var(--text)' }}>{amt}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 16 }}>
            <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Total due</span>
            <span style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)' }}>{amt}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Thank you for your business.</span>
        {!dueDate && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Due on receipt</span>}
      </div>
    </div>
  );
}
