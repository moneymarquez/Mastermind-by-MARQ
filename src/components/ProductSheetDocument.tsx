import type { CSSProperties } from 'react';
import { money } from './InvoiceDocument';

interface Item {
  label: string;
  amount: number;
  marketPrice: number | null;
  description: string | null;
}

interface Props {
  from?: string;
  clientName: string;
  items: Item[];
  teachingPhilosophy: string;
  style?: CSSProperties;
}

const micro: CSSProperties = { fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-tertiary)' };

/** The value-comparison companion to an invoice — what's actually being
 *  done, what it would cost from someone else, and how the owner works
 *  while teaching the client to eventually run it themselves. Built from
 *  the same bundled line items an invoice carries (InvoiceLineItem),
 *  never invented separately — this only ever shows work that's actually
 *  being billed. */
export default function ProductSheetDocument({ from = 'Made by MARQ', clientName, items, teachingPhilosophy, style }: Props) {
  const totalCharged = items.reduce((sum, i) => sum + i.amount, 0);
  const totalMarket = items.reduce((sum, i) => sum + (i.marketPrice ?? i.amount), 0);
  const totalSavings = totalMarket - totalCharged;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', ...style }}>
      <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>
        What {from} is doing for {clientName}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={micro}>Service</span>
          <span style={micro}>The deal</span>
        </div>
        {items.map((item, i) => {
          const savings = item.marketPrice !== null && item.marketPrice > item.amount ? item.marketPrice - item.amount : null;
          return (
            <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{money(item.amount)}</span>
              </div>
              {item.description && (
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{item.description}</div>
              )}
              {savings !== null && (
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Typically {money(item.marketPrice as number)} elsewhere — you're saving {money(savings)}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalSavings > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-4)' }}>
          <span style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Total value {money(totalMarket)} — you're paying {money(totalCharged)}</span>
          <span style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--success)' }}>Save {money(totalSavings)}</span>
        </div>
      )}

      {teachingPhilosophy.trim() && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={micro}>How I work</div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{teachingPhilosophy}</div>
        </div>
      )}
    </div>
  );
}
