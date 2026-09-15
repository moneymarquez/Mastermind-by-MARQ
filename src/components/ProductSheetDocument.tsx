import type { CSSProperties } from 'react';

interface Item {
  label: string;
  description: string | null;
  /** A personalized "why this helps you" paragraph for this client,
   *  written from their own discovery-audit answers. Takes priority over
   *  `description` (the generic catalog text) when present. */
  narrative: string | null;
}

interface Props {
  from?: string;
  clientName: string;
  /** This client's specific situation and why this plan addresses it —
   *  the personalized opening paragraph. Absent until "Generate
   *  personalized write-up" has been run for this invoice. */
  intro?: string | null;
  items: Item[];
  teachingPhilosophy: string;
  style?: CSSProperties;
}

const micro: CSSProperties = { fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-tertiary)' };

/** The explanation companion to an invoice — what's actually being done
 *  and why, for the one-time/upfront work only (a monthly item gets its
 *  own explanation on RecurringPlanDocument instead, alongside its
 *  price, so nothing's explained twice). Deliberately carries no dollar
 *  amounts at all — the price is already on the invoice itself, and
 *  repeating it here added nothing. Built from the same bundled line
 *  items an invoice carries (InvoiceLineItem), never invented
 *  separately — this only ever explains work that's actually being
 *  billed. */
export default function ProductSheetDocument({ from = 'Made by MARQ', clientName, intro, items, teachingPhilosophy, style }: Props) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', ...style }}>
      <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>
        What {from} is doing for {clientName}
      </div>

      {intro && intro.trim() && (
        <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>{intro}</div>
      )}

      <div style={{ marginTop: 20 }}>
        <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span style={micro}>What this includes</span>
        </div>
        {items.map((item, i) => {
          const bodyText = item.narrative || item.description;
          return (
            <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
              {bodyText && (
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{bodyText}</div>
              )}
            </div>
          );
        })}
      </div>

      {teachingPhilosophy.trim() && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
          <div style={micro}>How I work</div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{teachingPhilosophy}</div>
        </div>
      )}
    </div>
  );
}
