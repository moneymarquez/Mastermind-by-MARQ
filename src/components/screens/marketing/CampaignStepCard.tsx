import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CampaignContext, StepAnswer, StepDef } from '../../../data/campaignBuilder';

export const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
export const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box',
};
export const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', border: 'none' };
export const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', fontWeight: 500, cursor: 'pointer', background: 'transparent' };
export const labelStyle: CSSProperties = { fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' };

interface Props {
  step: StepDef;
  ctx: CampaignContext;
  answer: StepAnswer | undefined;
  saving: boolean;
  /** Which step numbers can be opened (gating), for the back/forward hints. */
  isLast: boolean;
  onSave: (answer: StepAnswer) => void | Promise<void>;
  onBack?: () => void;
}

/** One builder step, the same shape every time: what this is and why,
 *  one worked example, 3–4 choices each with its "why this fits", a free-
 *  text alternative, and any structured fields the step needs (dates,
 *  amounts, a target). Choice OR text is enough; both is fine. */
export default function CampaignStepCard({ step, ctx, answer, saving, isLast, onSave, onBack }: Props) {
  const options = step.options(ctx);
  const [choices, setChoices] = useState<string[]>(answer?.choices ?? (answer?.choice ? [answer.choice] : []));
  const [custom, setCustom] = useState<string>(answer?.custom ?? step.prefill?.(ctx) ?? '');
  const [data, setData] = useState<Record<string, string | number | null>>(() => {
    const d: Record<string, string | number | null> = { ...(answer?.data ?? {}) };
    for (const f of step.fields ?? []) if (d[f.key] === undefined || d[f.key] === null || d[f.key] === '') d[f.key] = f.default ? f.default(ctx) : '';
    return d;
  });
  const [error, setError] = useState('');
  const prefilled = !answer?.custom && !!step.prefill?.(ctx) || !!answer?.prefilled;

  // A different step mounted into the same card: reset the form.
  useEffect(() => {
    setChoices(answer?.choices ?? (answer?.choice ? [answer.choice] : []));
    setCustom(answer?.custom ?? step.prefill?.(ctx) ?? '');
    const d: Record<string, string | number | null> = { ...(answer?.data ?? {}) };
    for (const f of step.fields ?? []) if (d[f.key] === undefined || d[f.key] === null || d[f.key] === '') d[f.key] = f.default ? f.default(ctx) : '';
    setData(d);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const toggle = (id: string) => {
    setError('');
    if (step.multi) {
      setChoices((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : cur.length >= (step.multi ?? 1) ? [...cur.slice(1), id] : [...cur, id]));
    } else {
      setChoices((cur) => (cur[0] === id ? [] : [id]));
    }
  };

  const submit = () => {
    if (choices.length === 0 && !custom.trim()) { setError('Pick one, or say it in your own words.'); return; }
    for (const f of step.fields ?? []) {
      const v = data[f.key];
      if (v === undefined || v === null || v === '' || (f.type === 'number' && Number.isNaN(Number(v)))) { setError(`${f.label} is needed.`); return; }
    }
    const cleaned: Record<string, string | number | null> = {};
    for (const f of step.fields ?? []) cleaned[f.key] = f.type === 'number' ? Number(data[f.key]) : String(data[f.key]);
    const next: StepAnswer = {
      ...(step.multi ? { choices } : { choice: choices[0] }),
      custom: custom.trim() || undefined,
      data: step.fields ? cleaned : undefined,
      ai_summary: answer?.custom === custom.trim() ? answer?.ai_summary : undefined,
      prefilled: false,
      done_at: new Date().toISOString(),
    };
    onSave(next);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)' }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Step {step.n} of 10 · </span>{step.title}
        </div>
        {answer?.done_at && <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)' }}>Done — editing</span>}
      </div>

      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 10 }}>{step.explain}</div>

      <div style={{ marginTop: 14, padding: '10px 14px', borderLeft: '3px solid var(--border-2)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>Example</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5 }}>{step.example(ctx)}</div>
      </div>

      <div style={{ ...labelStyle, marginTop: 18, marginBottom: 8 }}>{step.multi ? `Pick up to ${step.multi}` : 'Pick one'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((o) => {
          const on = choices.includes(o.id);
          return (
            <div
              key={o.id}
              onClick={() => toggle(o.id)}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-lg)', cursor: 'pointer', border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--surface-2)' : 'transparent' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: step.multi ? 4 : '50%', border: `2px solid ${on ? 'var(--text)' : 'var(--border-2)'}`, background: on ? 'var(--text)' : 'transparent', flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{o.label}</div>
                  {typeof o.score === 'number' && (
                    <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: o.score >= 4 ? 'var(--success)' : o.score >= 3 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      fit {o.score}/5
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{o.why}</div>
              </div>
            </div>
          );
        })}
      </div>

      {step.fields && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {step.fields.map((f) => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130, flex: '1 1 130px' }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{f.label}</span>
              {f.type === 'select' ? (
                <select style={inputStyle} value={String(data[f.key] ?? '')} onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}>
                  {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  style={inputStyle}
                  type={f.type}
                  value={data[f.key] === null || data[f.key] === undefined ? '' : String(data[f.key])}
                  placeholder={f.placeholder}
                  onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div style={{ ...labelStyle, marginTop: 18, marginBottom: 6 }}>{step.customLabel}</div>
      {prefilled && custom && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 6 }}>Prefilled from what the CRM already knows — edit or keep.</div>
      )}
      <textarea
        style={{ ...inputStyle, width: '100%', minHeight: 64, resize: 'vertical' }}
        placeholder={step.customPlaceholder}
        value={custom}
        onChange={(e) => { setCustom(e.target.value); setError(''); }}
      />
      {answer?.ai_summary && answer.custom === custom.trim() && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6 }}><span style={{ fontWeight: 700 }}>Nova read:</span> {answer.ai_summary}</div>
      )}

      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : isLast ? (choices[0] === 'hold' ? 'Save plan' : 'Launch campaign') : 'Save & continue →'}
        </button>
        {onBack && <button style={ghostBtn} onClick={onBack}>← Back</button>}
      </div>
    </div>
  );
}
