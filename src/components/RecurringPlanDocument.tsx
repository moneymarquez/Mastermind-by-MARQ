import type { CSSProperties } from 'react';
import { money } from './InvoiceDocument';

interface Item {
  /** The pricing item's label, with any "(ongoing $X/mo after this)"
   *  disclosure suffix stripped — this document IS that disclosure, so
   *  repeating it inline on every row would be redundant. */
  label: string;
  ongoingAmount: number;
  description: string | null;
  narrative: string | null;
}

interface Props {
  clientName: string;
  items: Item[];
  style?: CSSProperties;
}

const micro: CSSProperties = { fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-tertiary)' };

/** The other invoice isn't sent yet — this is. A heads-up companion to
 *  the actual (mostly one-time/upfront) invoice and the Product Sheet:
 *  what the client will ALSO be billed monthly going forward, once this
 *  first invoice is paid, and what that ongoing amount actually covers.
 *  Built from the same bundled line items the invoice and Product Sheet
 *  use (InvoiceLineItem's cadence/ongoing_amount), filtered to the
 *  monthly ones — never a separate, invented number. */
export default function RecurringPlanDocument({ clientName, items, style }: Props) {
  const totalMonthly = items.reduce((sum, i) => sum + i.ongoingAmount, 0);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', ...style }}>
      <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>
        What {clientName} pays going forward
      </div>

      {/* The headline number up top, before any explanation — "here's the
          monthly amount," then "here's why," not the other way around. */}
      <div style={{ marginTop: 16, padding: '18px 20px', borderRadius: 'var(--radius-md)', background: 'var(--surface-4)' }}>
        <div style={micro}>Total going forward</div>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{money(totalMonthly)}<span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-tertiary)' }}>/mo</span></div>
      </div>

      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 16, lineHeight: 1.6 }}>
        Today's invoice covers the upfront work. Starting next month, on top of that, you'll be billed monthly for:
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={micro}>Ongoing service</span>
          <span style={micro}>Monthly</span>
        </div>
        {items.map((item, i) => {
          const bodyText = item.narrative || item.description;
          return (
            <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{money(item.ongoingAmount)}/mo</span>
              </div>
              {bodyText && (
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{bodyText}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
