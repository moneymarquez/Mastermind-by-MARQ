import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { MarketingBrief, MarketingBriefPatch, PrimaryLeak } from '../../data/useMarketingBriefs';

interface Props {
  brief: MarketingBrief;
  onUpdate: (patch: MarketingBriefPatch) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Opens Nova with this brief's data already handed to it — undefined
   *  when the caller has no way to reach Nova (shouldn't normally happen,
   *  but the button just doesn't render rather than no-op). */
  onBuildWithNova?: () => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 14 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const subhead: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 26, marginBottom: 4 };
const subheadNote: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 };

// Ordered exactly as Marketing 101 Fundamentals Part 1's own diagnostic
// order — positioning and pricing before conversion, conversion before
// retention, awareness last — because "fixing a later leak while an
// earlier one is open wastes money, but fixing an earlier one while a
// later one is open wastes more." The "test" text is the doc's own
// diagnostic test for that leak, not a paraphrase, so picking one here is
// actually running the diagnosis, not just labeling it after the fact.
const LEAKS: { key: PrimaryLeak; label: string; test: string }[] = [
  { key: 'positioning', label: 'Positioning', test: 'Can they say in one sentence why someone picks them over the place down the street — without saying "quality" or "service"? If no, this is it.' },
  { key: 'pricing', label: 'Pricing', test: 'Busy but broke? If a 10% price increase would lose fewer than 10% of customers — and it almost always would — they\'re underpriced.' },
  { key: 'conversion', label: 'Conversion', test: 'Decent traffic or foot traffic, weak sales — "lookers, not buyers"? Check what % of contacts become customers.' },
  { key: 'retention', label: 'Retention', test: 'Under 30% of this month\'s revenue from someone who bought before? They buy once and never come back.' },
  { key: 'awareness', label: 'Awareness', test: 'If 100 ideal customers showed up tomorrow, would they convert? If yes — and reach is genuinely the gap — it\'s this one.' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={fieldWrap}>
      <div style={labelStyle}>{label}{hint && <span style={{ color: 'var(--text-tertiary)' }}> — {hint}</span>}</div>
      {children}
    </div>
  );
}

/** The Item 2 brief form — every field here is one of Marketing 101's own
 *  diagnostic questions or a direct campaign-framing need, not an invented
 *  shape. Saves per-field on blur (same pattern as the rest of this app's
 *  forms), so there's no separate "save" step to forget. */
export default function MarketingBriefForm({ brief, onUpdate, onDelete, onClose, onBuildWithNova }: Props) {
  const [draft, setDraft] = useState(brief);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = <K extends keyof MarketingBrief>(key: K, value: MarketingBrief[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const save = <K extends keyof MarketingBrief>(key: K) => onUpdate({ [key]: draft[key] } as MarketingBriefPatch);
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['draft', 'ready'] as const).map((s) => (
            <div
              key={s}
              onClick={() => { set('status', s); onUpdate({ status: s }); }}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-tiny)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                border: `1px solid ${draft.status === s ? (s === 'ready' ? 'var(--success)' : 'var(--text)') : 'var(--border)'}`,
                color: draft.status === s ? (s === 'ready' ? 'var(--success)' : 'var(--text)') : 'var(--text-tertiary)',
              }}
            >
              {s}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={ghostBtn} onClick={onClose}>Close</span>
          {confirmingDelete ? (
            <>
              <span style={{ ...ghostBtn, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={onDelete}>Confirm delete</span>
              <span style={ghostBtn} onClick={() => setConfirmingDelete(false)}>Cancel</span>
            </>
          ) : (
            <span style={ghostBtn} onClick={() => setConfirmingDelete(true)}>Delete brief</span>
          )}
        </div>
      </div>

      {onBuildWithNova && (
        <div style={{ ...primaryBtn, marginTop: 16, display: 'inline-block' }} onClick={onBuildWithNova}>Build this with Nova</div>
      )}

      <div style={subhead}>Which leak is this fixing?</div>
      <div style={subheadNote}>Diagnose first — the doc's own rule. Pick the one whose test actually matches this client.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {LEAKS.map((l) => (
          <div
            key={l.key}
            onClick={() => { set('primary_leak', l.key); onUpdate({ primary_leak: l.key }); }}
            style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: `1px solid ${draft.primary_leak === l.key ? 'var(--text)' : 'var(--border)'}`,
              background: draft.primary_leak === l.key ? '#F5F6F71a' : 'transparent',
            }}
          >
            <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: draft.primary_leak === l.key ? 'var(--text)' : 'var(--text-secondary)' }}>{l.label}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{l.test}</div>
          </div>
        ))}
      </div>

      <div style={subhead}>Campaign</div>
      <Field label="Goal" hint="specific, not vague — '15 more catering bookings a month,' not 'more customers'">
        <input style={inputStyle} defaultValue={draft.goal ?? ''} onChange={(e) => set('goal', e.target.value)} onBlur={() => save('goal')} />
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <Field label="Budget">
            <input
              style={inputStyle} type="number" placeholder="$"
              defaultValue={draft.budget_amount ?? ''}
              onChange={(e) => set('budget_amount', num(e.target.value))}
              onBlur={() => save('budget_amount')}
            />
          </Field>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <Field label="Per">
            <select
              style={inputStyle}
              value={draft.budget_period ?? ''}
              onChange={(e) => { const v = (e.target.value || null) as MarketingBrief['budget_period']; set('budget_period', v); onUpdate({ budget_period: v }); }}
            >
              <option value="">—</option>
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>
      </div>
      <Field label="Budget notes" hint="e.g. 'flexible if it pays back fast,' 'not sure yet'">
        <input style={inputStyle} defaultValue={draft.budget_notes ?? ''} onChange={(e) => set('budget_notes', e.target.value)} onBlur={() => save('budget_notes')} />
      </Field>
      <Field label="Timeline" hint="a real deadline, or 'ongoing'">
        <input style={inputStyle} defaultValue={draft.timeline ?? ''} onChange={(e) => set('timeline', e.target.value)} onBlur={() => save('timeline')} />
      </Field>

      <div style={subhead}>Diagnostic — the numbers</div>
      <div style={subheadNote}>Marketing 101's own questions. Blank is fine if they don't know — that's information too.</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Field label="Average transaction value">
            <input
              style={inputStyle} type="number" placeholder="$"
              defaultValue={draft.avg_transaction_value ?? ''}
              onChange={(e) => set('avg_transaction_value', num(e.target.value))}
              onBlur={() => save('avg_transaction_value')}
            />
          </Field>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Field label="% of customers who come back" hint="under 30% is a retention leak">
            <input
              style={inputStyle} type="number" min={0} max={100} placeholder="%"
              defaultValue={draft.repeat_customer_pct ?? ''}
              onChange={(e) => set('repeat_customer_pct', num(e.target.value))}
              onBlur={() => save('repeat_customer_pct')}
            />
          </Field>
        </div>
      </div>
      <Field label="What a customer spends with them over a year">
        <input style={inputStyle} defaultValue={draft.customer_ltv_notes ?? ''} onChange={(e) => set('customer_ltv_notes', e.target.value)} onBlur={() => save('customer_ltv_notes')} />
      </Field>
      <Field label="Where their business comes from today, ranked">
        <input style={inputStyle} defaultValue={draft.revenue_sources ?? ''} onChange={(e) => set('revenue_sources', e.target.value)} onBlur={() => save('revenue_sources')} />
      </Field>
      <Field label="What they charge, and when they last raised it">
        <input style={inputStyle} defaultValue={draft.last_price_change ?? ''} onChange={(e) => set('last_price_change', e.target.value)} onBlur={() => save('last_price_change')} />
      </Field>
      <Field label="Gross margin">
        <input style={inputStyle} defaultValue={draft.gross_margin ?? ''} onChange={(e) => set('gross_margin', e.target.value)} onBlur={() => save('gross_margin')} />
      </Field>
      <Field label="Closest competitor, and why people pick them over it">
        <input style={inputStyle} defaultValue={draft.competitor_diff ?? ''} onChange={(e) => set('competitor_diff', e.target.value)} onBlur={() => save('competitor_diff')} />
      </Field>
      <Field label="% of people who contact them who become customers">
        <input style={inputStyle} defaultValue={draft.contact_to_customer_rate ?? ''} onChange={(e) => set('contact_to_customer_rate', e.target.value)} onBlur={() => save('contact_to_customer_rate')} />
      </Field>
      <Field label="Could they serve double the customers tomorrow?" hint="marketing a business that can't fulfill is malpractice">
        <input style={inputStyle} defaultValue={draft.capacity_constraint ?? ''} onChange={(e) => set('capacity_constraint', e.target.value)} onBlur={() => save('capacity_constraint')} />
      </Field>
      <Field label="Single biggest constraint on growth right now" hint="the question that reveals whether marketing is even the answer">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          defaultValue={draft.biggest_constraint ?? ''}
          onChange={(e) => set('biggest_constraint', e.target.value)}
          onBlur={() => save('biggest_constraint')}
        />
      </Field>

      <div style={subhead}>Audience & positioning</div>
      <Field label="Target audience">
        <input style={inputStyle} defaultValue={draft.target_audience ?? ''} onChange={(e) => set('target_audience', e.target.value)} onBlur={() => save('target_audience')} />
      </Field>
      <Field label="Positioning statement" hint="the one-sentence test">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          placeholder="We're the [category] for [specific customer] who want [specific outcome], unlike [alternative] which [limitation]."
          defaultValue={draft.positioning_statement ?? ''}
          onChange={(e) => set('positioning_statement', e.target.value)}
          onBlur={() => save('positioning_statement')}
        />
      </Field>
      <Field label="Must-avoid" hint="brand constraints, things they don't want">
        <input style={inputStyle} defaultValue={draft.must_avoid ?? ''} onChange={(e) => set('must_avoid', e.target.value)} onBlur={() => save('must_avoid')} />
      </Field>

      <div style={{ marginTop: 8 }}>
        <span style={primaryBtn} onClick={onClose}>Done for now</span>
      </div>
    </div>
  );
}
