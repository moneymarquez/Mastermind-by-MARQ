import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingBrief, PrimaryLeak } from '../../data/useMarketingBriefs';
import { LEAKS } from '../../data/useMarketingBriefs';

interface Props {
  brief: MarketingBrief;
  clientName: string;
  onSetLeak: (leak: PrimaryLeak, note: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

// The verdict headline plus which brief fields actually back it up — "the
// three or four numbers from the brief that produced that verdict, shown
// inline so the operator can argue with it." Deliberately not AI-written:
// the headline is a fixed template per leak (same five leaks everywhere in
// this app), and the evidence is just the real fields, verbatim — nothing
// here predicts an outcome or invents a number.
const VERDICT: Record<PrimaryLeak, { headline: (name: string) => string; fields: { key: keyof MarketingBrief; label: string }[] }> = {
  positioning: {
    headline: (name) => `Positioning problem — ${name} has no clear reason to be picked over the alternative.`,
    fields: [
      { key: 'positioning_statement', label: 'Positioning statement' },
      { key: 'competitor_diff', label: 'Vs. competitor' },
      { key: 'target_audience', label: 'Audience' },
    ],
  },
  pricing: {
    headline: (name) => `Pricing problem — ${name} is busy but underpriced for what they do.`,
    fields: [
      { key: 'avg_transaction_value', label: 'Avg transaction value' },
      { key: 'last_price_change', label: 'Pricing' },
      { key: 'gross_margin', label: 'Gross margin' },
    ],
  },
  conversion: {
    headline: (name) => `Conversion problem — people find ${name} and don't buy.`,
    fields: [
      { key: 'contact_to_customer_rate', label: 'Contact-to-customer rate' },
      { key: 'capacity_constraint', label: 'Capacity' },
    ],
  },
  retention: {
    headline: (name) => `Retention problem — ${name}'s customers buy once and don't come back.`,
    fields: [
      { key: 'repeat_customer_pct', label: 'Repeat customers' },
      { key: 'customer_ltv_notes', label: 'Customer LTV' },
    ],
  },
  awareness: {
    headline: (name) => `Visibility problem — not enough people know ${name} exists.`,
    fields: [
      { key: 'revenue_sources', label: 'Current sources of business' },
      { key: 'biggest_constraint', label: 'Biggest constraint' },
    ],
  },
};

function formatValue(key: keyof MarketingBrief, value: MarketingBrief[keyof MarketingBrief]): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (key === 'avg_transaction_value') return `$${Number(value).toLocaleString()}`;
  if (key === 'repeat_customer_pct') return `${value}%`;
  return String(value);
}

function LeakPicker({ current, onPick }: { current: PrimaryLeak | null; onPick: (leak: PrimaryLeak) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {LEAKS.map((l) => (
        <div
          key={l.key}
          onClick={() => onPick(l.key)}
          style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${current === l.key ? 'var(--text)' : 'var(--border)'}`,
            background: current === l.key ? '#F5F6F71a' : 'transparent',
          }}
        >
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: current === l.key ? 'var(--text)' : 'var(--text-secondary)' }}>{l.label}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{l.test}</div>
        </div>
      ))}
    </div>
  );
}

/** Screen 1 of the Marketing Plays rebuild — reads marketing_briefs and
 *  renders the diagnosis as a verdict the operator can argue with, not a
 *  black box. No leak set yet and "overriding" the current one go through
 *  the same picker; the only difference is whether a note is required
 *  (always, per the build prompt — even the first pick is a claim worth
 *  writing down). */
export default function MarketingDiagnosisHeader({ brief, clientName, onSetLeak }: Props) {
  const [picking, setPicking] = useState(false);
  const [pendingLeak, setPendingLeak] = useState<PrimaryLeak | null>(null);
  const [note, setNote] = useState('');

  const verdict = brief.primary_leak ? VERDICT[brief.primary_leak] : null;
  const evidence = verdict ? verdict.fields.map((f) => ({ label: f.label, value: formatValue(f.key, brief[f.key]) })).filter((f) => f.value) : [];

  const startPicking = () => {
    setPendingLeak(brief.primary_leak);
    setNote('');
    setPicking(true);
  };

  const confirm = () => {
    if (!pendingLeak || !note.trim()) return;
    onSetLeak(pendingLeak, note.trim());
    setPicking(false);
  };

  if (picking) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          {brief.primary_leak ? 'Override the diagnosis' : 'Diagnose first'}
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
          Pick the leak whose test actually matches {clientName}, then say why — even the first pick is a claim worth writing down.
        </div>
        <LeakPicker current={pendingLeak} onPick={setPendingLeak} />
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Why this one</div>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            placeholder="What in their numbers makes this the leak — required, even to disagree with yourself later."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ ...primaryBtn, opacity: pendingLeak && note.trim() ? 1 : 0.5, pointerEvents: pendingLeak && note.trim() ? 'auto' : 'none' }} onClick={confirm}>
            Save diagnosis
          </div>
          <div style={ghostBtn} onClick={() => setPicking(false)}>Cancel</div>
        </div>
      </div>
    );
  }

  if (!verdict) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>No diagnosis yet</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Positioning → pricing → conversion → retention → awareness, in that order. Nothing downstream (channel, offer, plays) should happen before this is picked.
        </div>
        <div style={{ ...primaryBtn, marginTop: 14, display: 'inline-block' }} onClick={startPicking}>Diagnose {clientName}</div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{verdict.headline(clientName)}</div>
      {brief.leak_note && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>"{brief.leak_note}"</div>
      )}
      {evidence.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          {evidence.map((e) => (
            <div key={e.label} style={{ fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{e.label}: </span>
              <span style={{ color: 'var(--text)' }}>{e.value}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <span style={ghostBtn} onClick={startPicking}>Disagree? Override</span>
      </div>
    </div>
  );
}
