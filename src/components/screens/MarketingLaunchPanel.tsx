import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingPlay, MarketingPlayPatch } from '../../data/useMarketingPlays';
import { generateLaunchOptions, isLaunchComplete, suggestedCheckpointDate, PRIMARY_METRIC_OPTIONS } from '../../data/marketingLaunchEngine';
import type { LaunchOption } from '../../data/marketingLaunchEngine';

interface Props {
  play: MarketingPlay;
  onUpdate: (patch: MarketingPlayPatch) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const subCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 14 };
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

const GUARDS = [
  "Don't buy traffic before the destination (site, booking flow, phone line) actually converts.",
  "Don't spend where the result can't be attributed back to this play.",
  'Raise spend in weekly increments, not monthly — a bad week is cheap to notice and stop.',
  "Know what's next before launching this — check the parked alternates in the channel slate above so a kill isn't a scramble.",
];

function OptionCard({ option, selected, onPick }: { option: LaunchOption; selected: boolean; onPick: () => void }) {
  return (
    <div
      onClick={onPick}
      style={{
        ...subCard, cursor: 'pointer',
        border: `1px solid ${selected ? 'var(--text)' : 'var(--border-2)'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{option.label}</div>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 700, color: 'var(--text)' }}>{option.budget}</div>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>{option.rationale}</div>
      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 6, textTransform: 'uppercase', fontWeight: 700 }}>Checkpoint in {option.checkpoint_days} days</div>
    </div>
  );
}

/** The launch panel — metric, kill threshold, checkpoint date, and
 *  expected result, plus the 2-3 launch options that help pick a real
 *  budget instead of an arbitrary one. Rule 1 in practice: nothing here
 *  predicts an outcome, it only fixes the terms of the test in advance
 *  so the checkpoint (item 6) has something honest to check against. */
export default function MarketingLaunchPanel({ play, onUpdate }: Props) {
  const options = generateLaunchOptions(play);
  const [selectedKey, setSelectedKey] = useState<LaunchOption['key']>(options[0].key);
  const [metric, setMetric] = useState(play.primary_metric ?? '');
  const [customMetric, setCustomMetric] = useState(!play.primary_metric || !(PRIMARY_METRIC_OPTIONS as readonly string[]).includes(play.primary_metric) ? play.primary_metric ?? '' : '');
  const [usingCustomMetric, setUsingCustomMetric] = useState(!!play.primary_metric && !(PRIMARY_METRIC_OPTIONS as readonly string[]).includes(play.primary_metric));
  const [killThreshold, setKillThreshold] = useState(play.kill_threshold ?? '');
  const [checkpointDate, setCheckpointDate] = useState(play.checkpoint_date ?? suggestedCheckpointDate(options[0].checkpoint_days));
  const [expectedResult, setExpectedResult] = useState(play.expected_result ?? '');
  const [editing, setEditing] = useState(!isLaunchComplete(play));

  const selectedOption = options.find((o) => o.key === selectedKey) ?? options[0];
  const finalMetric = usingCustomMetric ? customMetric.trim() : metric;
  const canConfirm = !!finalMetric && !!killThreshold.trim() && !!checkpointDate && !!expectedResult.trim();

  const confirm = () => {
    if (!canConfirm) return;
    onUpdate({
      primary_metric: finalMetric,
      kill_threshold: killThreshold.trim(),
      checkpoint_date: checkpointDate,
      expected_result: expectedResult.trim(),
      cost_estimate: selectedOption.budget,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Launched</div>
          <span style={ghostBtn} onClick={() => setEditing(true)}>Edit</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <div style={{ fontSize: 'var(--text-body-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>Budget: </span><span style={{ color: 'var(--text)' }}>{play.cost_estimate}</span></div>
          <div style={{ fontSize: 'var(--text-body-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>Metric: </span><span style={{ color: 'var(--text)' }}>{play.primary_metric}</span></div>
          <div style={{ fontSize: 'var(--text-body-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>Checkpoint: </span><span style={{ color: 'var(--text)' }}>{play.checkpoint_date}</span></div>
          <div style={{ fontSize: 'var(--text-body-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>Kill if: </span><span style={{ color: 'var(--text)' }}>{play.kill_threshold}</span></div>
          <div style={{ fontSize: 'var(--text-body-sm)' }}><span style={{ color: 'var(--text-tertiary)' }}>Expected: </span><span style={{ color: 'var(--text)' }}>{play.expected_result}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Launch small</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, padding: '12px 14px', background: 'var(--surface-4)', borderRadius: 'var(--radius-lg)' }}>
        {GUARDS.map((g, i) => <div key={i} style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>• {g}</div>)}
      </div>

      <div style={{ ...labelStyle, textTransform: 'uppercase', fontWeight: 700 }}>Pick a budget shape</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 16 }}>
        {options.map((o) => (
          <OptionCard
            key={o.key}
            option={o}
            selected={o.key === selectedKey}
            onPick={() => { setSelectedKey(o.key); setCheckpointDate(suggestedCheckpointDate(o.checkpoint_days)); }}
          />
        ))}
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Primary metric — the one number, money-adjacent, never impressions or follows</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRIMARY_METRIC_OPTIONS.map((opt) => (
            <div
              key={opt}
              onClick={() => { setUsingCustomMetric(false); setMetric(opt); }}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
                border: `1px solid ${!usingCustomMetric && metric === opt ? 'var(--text)' : 'var(--border)'}`,
                color: !usingCustomMetric && metric === opt ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {opt}
            </div>
          ))}
          <div
            onClick={() => setUsingCustomMetric(true)}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-small)', cursor: 'pointer',
              border: `1px solid ${usingCustomMetric ? 'var(--text)' : 'var(--border)'}`,
              color: usingCustomMetric ? 'var(--text)' : 'var(--text-secondary)',
            }}
          >
            Other
          </div>
        </div>
        {usingCustomMetric && (
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            placeholder="A real, money-adjacent number — not impressions, reach, or followers"
            value={customMetric}
            onChange={(e) => setCustomMetric(e.target.value)}
          />
        )}
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Kill threshold — decided now, not after</div>
        <input style={inputStyle} placeholder="e.g. 'Fewer than 5 calls by the checkpoint date'" value={killThreshold} onChange={(e) => setKillThreshold(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Checkpoint date</div>
        <input style={inputStyle} type="date" value={checkpointDate} onChange={(e) => setCheckpointDate(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Expected result — written now, checked against reality at the checkpoint</div>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          placeholder="What do you actually expect to happen by the checkpoint?"
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
        />
      </div>

      <div style={{ ...primaryBtn, display: 'inline-block', opacity: canConfirm ? 1 : 0.5, pointerEvents: canConfirm ? 'auto' : 'none' }} onClick={confirm}>
        Confirm launch
      </div>
    </div>
  );
}
