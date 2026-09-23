import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { OnboardingAnswers } from '../data/useOnboardingProgress';
import { ROLE_OPTIONS, INDUSTRY_SUGGESTIONS } from '../data/brain';

interface Props {
  initial: OnboardingAnswers;
  onComplete: (answers: OnboardingAnswers) => Promise<void>;
}

const chipStyle = (active: boolean): CSSProperties => ({
  padding: '10px 16px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body)', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? 'var(--tint-active)' : 'var(--surface)',
  color: active ? 'var(--text)' : 'var(--text-secondary)',
});
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '11px 14px', color: 'var(--text)', fontSize: 'var(--text-label)', outline: 'none', boxSizing: 'border-box',
};
const q: CSSProperties = { fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)', marginBottom: 10 };

/** Five questions, no more. They set defaults (which modules start
 *  ticked, what Nova knows on day one). The personality assessment lives
 *  in the Brain tab, after the product is in front of them. */
export default function CurationQuestions({ initial, onComplete }: Props) {
  const [industry, setIndustry] = useState(initial.industry ?? '');
  const [role, setRole] = useState(initial.role ?? '');
  const [side, setSide] = useState(initial.side_hustle ?? '');
  const [ninety, setNinety] = useState(initial.ninety_day ?? '');
  const [win, setWin] = useState(initial.week_win ?? '');
  const [submitting, setSubmitting] = useState(false);

  const canContinue = industry.trim() && role && ninety.trim() && win.trim();

  const submit = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    await onComplete({ industry: industry.trim(), role, side_hustle: side.trim() || undefined, ninety_day: ninety.trim(), week_win: win.trim() });
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--bg)', padding: '48px 24px 60px', display: 'flex', justifyContent: 'center' } as CSSProperties}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 'var(--text-stat)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 2 }}>Masterminds by MARQ</div>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, color: 'var(--text)', marginTop: 24, marginBottom: 6 }}>Five quick questions</div>
        <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
          Just enough to set the defaults. The real assessment waits until you've seen the app.
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={q}>What industry are you in?</div>
          <input style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. home services, food truck, salon" />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {INDUSTRY_SUGGESTIONS.map((s) => <div key={s} style={{ ...chipStyle(industry === s), padding: '6px 12px', fontSize: 'var(--text-caption)' }} onClick={() => setIndustry(s)}>{s}</div>)}
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={q}>What's your role?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ROLE_OPTIONS.map((o) => <div key={o} style={chipStyle(role === o)} onClick={() => setRole(o)}>{o}</div>)}
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={q}>Anything you run on the side? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>optional</span></div>
          <input style={inputStyle} value={side} onChange={(e) => setSide(e.target.value)} placeholder="A second business, a stream, a rental…" />
        </div>

        <div style={{ marginBottom: 26 }}>
          <div style={q}>What are you trying to hit in the next 90 days?</div>
          <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={ninety} onChange={(e) => setNinety(e.target.value)} placeholder="A number and a date beats a feeling" />
        </div>

        <div style={{ marginBottom: 36 }}>
          <div style={q}>What would make this week a win?</div>
          <input style={inputStyle} value={win} onChange={(e) => setWin(e.target.value)} placeholder="One thing" />
        </div>

        <button
          onClick={submit}
          disabled={!canContinue || submitting}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
            fontSize: 'var(--text-body-lg)', fontWeight: 600, cursor: !canContinue || submitting ? 'default' : 'pointer', opacity: !canContinue || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
