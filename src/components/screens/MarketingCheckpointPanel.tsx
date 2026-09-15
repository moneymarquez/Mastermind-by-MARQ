import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MarketingPlay, MarketingPlayPatch } from '../../data/useMarketingPlays';
import { doubleBudget, suggestedCheckpointDate } from '../../data/marketingLaunchEngine';

type ReasonCode = 'wrong_channel' | 'weak_offer' | 'bad_creative' | 'too_early';

interface Props {
  play: MarketingPlay;
  onUpdate: (patch: MarketingPlayPatch) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const subCard: CSSProperties = { background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-lg)', padding: 16 };
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
const dangerBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--danger)', color: 'var(--danger)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};

const REASON_CODES: { key: ReasonCode; label: string }[] = [
  { key: 'wrong_channel', label: 'Wrong channel — right offer, wrong place' },
  { key: 'weak_offer', label: 'Weak offer — right channel, nothing to click for' },
  { key: 'bad_creative', label: 'Bad creative — right offer and channel, copy/image didn\'t land' },
  { key: 'too_early', label: 'Too early — hasn\'t had a real chance to show anything yet' },
];

function ReasonPicker({ value, onChange }: { value: ReasonCode | null; onChange: (v: ReasonCode) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {REASON_CODES.map((r) => (
        <div
          key={r.key}
          onClick={() => onChange(r.key)}
          style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${value === r.key ? 'var(--text)' : 'var(--border)'}`,
            fontSize: 'var(--text-body-sm)', color: value === r.key ? 'var(--text)' : 'var(--text-secondary)',
          }}
        >
          {r.label}
        </div>
      ))}
    </div>
  );
}

type Mode = 'closed' | 'win' | 'pivot' | 'kill';

/** Screen 5's tail end / build order item 6 — the checkpoint decision.
 *  Shows once a launched play's own checkpoint date arrives. Three
 *  calls, matching the build prompt exactly: kill, double (leave a
 *  winner alone and scale it), or change one variable and keep testing.
 *  The last two both require a reason_code — "pivot requires a
 *  reason_code" — and picking 'too_early' pushes back before letting
 *  either one through, since that's the most common real answer and
 *  usually means "wait," not "change something." */
export default function MarketingCheckpointPanel({ play, onUpdate }: Props) {
  const [mode, setMode] = useState<Mode>('closed');
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [confirmedDespitePushback, setConfirmedDespitePushback] = useState(false);
  const [nextCheckpoint, setNextCheckpoint] = useState(suggestedCheckpointDate(7));

  const showPushback = reason === 'too_early' && !confirmedDespitePushback;

  const reset = () => { setMode('closed'); setReason(null); setConfirmedDespitePushback(false); };

  const confirmDouble = () => {
    onUpdate({ cost_estimate: doubleBudget(play.cost_estimate), checkpoint_date: nextCheckpoint, checkpoint_reason_code: null });
    reset();
  };

  const confirmLeaveAlone = () => {
    onUpdate({ checkpoint_date: nextCheckpoint, checkpoint_reason_code: null });
    reset();
  };

  const confirmPivot = () => {
    if (!reason) return;
    onUpdate({ checkpoint_date: nextCheckpoint, checkpoint_reason_code: reason });
    reset();
  };

  const confirmKill = () => {
    if (!reason) return;
    onUpdate({ status: 'killed', checkpoint_reason_code: reason });
    reset();
  };

  if (mode === 'closed') {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Checkpoint day</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          Read <strong style={{ color: 'var(--text)' }}>{play.primary_metric}</strong> against the threshold you set: <em>"{play.kill_threshold}"</em>. You expected: <em>"{play.expected_result}"</em>. What's the honest call?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <span style={primaryBtn} onClick={() => setMode('win')}>It's working</span>
          <span style={ghostBtn} onClick={() => setMode('pivot')}>Change one variable, keep testing</span>
          <span style={dangerBtn} onClick={() => setMode('kill')}>Kill it</span>
        </div>
      </div>
    );
  }

  if (mode === 'win') {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>It's working — leave it alone</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>No reason code needed — this isn't a pivot. Keep it running as-is, or double the budget if it's clearly worth more.</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>Next checkpoint</div>
          <input style={inputStyle} type="date" value={nextCheckpoint} onChange={(e) => setNextCheckpoint(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={ghostBtn} onClick={confirmLeaveAlone}>Leave it running as-is</span>
          <span style={primaryBtn} onClick={confirmDouble}>Double the budget — {doubleBudget(play.cost_estimate)}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={ghostBtn} onClick={reset}>Back</span>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        {mode === 'kill' ? 'Kill this play' : 'Change one variable'}
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14 }}>Why — required either way.</div>
      <ReasonPicker value={reason} onChange={(r) => { setReason(r); setConfirmedDespitePushback(false); }} />

      {showPushback && (
        <div style={{ ...subCard, marginTop: 14, borderColor: 'var(--warning)' }}>
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>That's the most common real answer</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            "Too early" usually means the play needs more time, not a change. Consider extending the checkpoint instead of {mode === 'kill' ? 'killing this' : 'changing anything'} yet.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span style={primaryBtn} onClick={() => { setReason(null); setMode('closed'); onUpdate({ checkpoint_date: nextCheckpoint }); }}>Extend the checkpoint instead</span>
            <span style={ghostBtn} onClick={() => setConfirmedDespitePushback(true)}>I'm sure — proceed anyway</span>
          </div>
        </div>
      )}

      {!showPushback && reason && mode === 'pivot' && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 }}>New checkpoint date</div>
          <input style={inputStyle} type="date" value={nextCheckpoint} onChange={(e) => setNextCheckpoint(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span style={primaryBtn} onClick={confirmPivot}>Confirm — keep testing</span>
            <span style={ghostBtn} onClick={reset}>Cancel</span>
          </div>
        </div>
      )}

      {!showPushback && reason && mode === 'kill' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <span style={dangerBtn} onClick={confirmKill}>Confirm kill</span>
          <span style={ghostBtn} onClick={reset}>Cancel</span>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <span style={ghostBtn} onClick={reset}>Back</span>
      </div>
    </div>
  );
}

export function KilledPlayAlternates({ play, parkedAlternates, onPickAlternate }: { play: MarketingPlay; parkedAlternates: MarketingPlay[]; onPickAlternate: (id: string) => void }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{play.title} — killed</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>
        Reason: {REASON_CODES.find((r) => r.key === play.checkpoint_reason_code)?.label ?? play.checkpoint_reason_code}
      </div>
      {parkedAlternates.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 14 }}>
          No parked alternates left — back to the channel slate to generate more, or reconsider the diagnosis.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 14, marginBottom: 10 }}>Next up — ranked, not starting from zero:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {parkedAlternates.map((alt) => (
              <div key={alt.id} style={subCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{alt.title}</div>
                  <span style={ghostBtn} onClick={() => onPickAlternate(alt.id)}>Pick this instead</span>
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>{alt.rationale}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
