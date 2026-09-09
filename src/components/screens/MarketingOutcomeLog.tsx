import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingPlay } from '../../data/useMarketingPlays';
import type { LogOutcomeInput, OutcomeVerdict, ReasonCode } from '../../data/usePlayOutcomes';

interface Props {
  play: MarketingPlay;
  onLog: (play: MarketingPlay, input: LogOutcomeInput) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 14 };
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

const VERDICTS: { key: OutcomeVerdict; label: string }[] = [
  { key: 'worked', label: 'Worked' },
  { key: 'didnt_work', label: "Didn't work" },
  { key: 'inconclusive', label: 'Inconclusive' },
];

const REASON_CODES: { key: ReasonCode; label: string }[] = [
  { key: 'wrong_channel', label: 'Wrong channel' },
  { key: 'weak_offer', label: 'Weak offer' },
  { key: 'bad_creative', label: 'Bad creative' },
  { key: 'too_early', label: 'Too early' },
];

/** Build order item 7's outcome log — the retrospective close-out, ~30
 *  seconds per the build prompt. Shown for a play that's reached a
 *  terminal moment (killed at the checkpoint, or the operator declaring
 *  a long-running active play a proven winner) but hasn't been logged
 *  yet. Deliberately short: verdict, days to first result, what
 *  happened, what to change — nothing here predicts anything, it only
 *  records what already happened. */
export default function MarketingOutcomeLog({ play, onLog }: Props) {
  const [verdict, setVerdict] = useState<OutcomeVerdict>('worked');
  const [days, setDays] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [reasonCode, setReasonCode] = useState<ReasonCode | null>(null);
  const [whatToChange, setWhatToChange] = useState('');

  const needsReason = verdict === 'didnt_work';
  const canLog = !!actualResult.trim() && (!needsReason || !!reasonCode);

  const submit = () => {
    if (!canLog) return;
    onLog(play, {
      verdict,
      days_to_first_result: days.trim() ? Number(days) : null,
      actual_result: actualResult,
      reason_code: needsReason ? reasonCode : null,
      what_to_change: whatToChange,
    });
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Log the outcome — {play.title}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
        30 seconds. This is worthless as a ranking signal for the first ~10 entries — that's expected, not a sign anything's broken. It gets more useful every time.
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>What actually happened</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {VERDICTS.map((v) => (
            <div
              key={v.key}
              onClick={() => { setVerdict(v.key); if (v.key !== 'didnt_work') setReasonCode(null); }}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
                border: `1px solid ${verdict === v.key ? 'var(--text)' : 'var(--border)'}`,
                color: verdict === v.key ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {needsReason && (
        <div style={fieldWrap}>
          <div style={labelStyle}>Why</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {REASON_CODES.map((r) => (
              <div
                key={r.key}
                onClick={() => setReasonCode(r.key)}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
                  border: `1px solid ${reasonCode === r.key ? 'var(--text)' : 'var(--border)'}`,
                  color: reasonCode === r.key ? 'var(--text)' : 'var(--text-secondary)',
                }}
              >
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={fieldWrap}>
        <div style={labelStyle}>Days to first result</div>
        <input style={inputStyle} type="number" min={0} placeholder="e.g. 4" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>What actually happened — the real number, compared to what you expected: "{play.expected_result}"</div>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={actualResult} onChange={(e) => setActualResult(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>What to change next time (optional)</div>
        <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={whatToChange} onChange={(e) => setWhatToChange(e.target.value)} />
      </div>

      <div style={{ ...primaryBtn, display: 'inline-block', opacity: canLog ? 1 : 0.5, pointerEvents: canLog ? 'auto' : 'none' }} onClick={submit}>
        Log outcome
      </div>
    </div>
  );
}
