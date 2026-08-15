import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDecisions, getDecisionContext } from '../../data/useDecisions';
import type { Decision, DecisionMode, DecisionContext, OutcomeRating } from '../../data/useDecisions';
import { dateStr } from '../../data/time';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 700, color: '#F5F6F7', marginTop: 36, marginBottom: 14 };
const MODE_LABEL: Record<DecisionMode, string> = { emotional: 'Emotional', analytical: 'Analytical', mixed: 'Mixed' };
const RATING_LABEL: Record<OutcomeRating, string> = { good: 'Good call', mixed: 'Mixed', bad: 'Bad call' };
const RATING_COLOR: Record<OutcomeRating, string> = { good: '#8fae8f', mixed: '#C9A24B', bad: '#c47a7a' };

function NewDecisionForm({ onAdd }: { onAdd: (input: { title: string; reasoning: string; expected_outcome: string; confidence: number | null; mode: DecisionMode | null; review_date: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [expected, setExpected] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [mode, setMode] = useState<DecisionMode>('analytical');
  const [reviewDate, setReviewDate] = useState('');

  const submit = async () => {
    if (!title.trim() || !reasoning.trim() || !expected.trim() || !reviewDate) return;
    await onAdd({ title: title.trim(), reasoning: reasoning.trim(), expected_outcome: expected.trim(), confidence, mode, review_date: reviewDate });
    setTitle(''); setReasoning(''); setExpected(''); setReviewDate(''); setConfidence(3); setMode('analytical'); setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ ...cardStyle, cursor: 'pointer', textAlign: 'center', color: '#8A8F98', fontSize: 13 }} onClick={() => setOpen(true)}>
        + Log a decision
      </div>
    );
  }
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input style={inputStyle} placeholder="What did you decide? (short title)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Your reasoning — why this, why now" value={reasoning} onChange={(e) => setReasoning(e.target.value)} />
        <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} placeholder="What you expect to happen" value={expected} onChange={(e) => setExpected(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, color: '#8A8F98', display: 'block', marginBottom: 4 }}>Confidence (1-5)</label>
            <input type="number" min={1} max={5} style={{ ...inputStyle, width: 70 }} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#8A8F98', display: 'block', marginBottom: 4 }}>Felt like</label>
            <select style={{ ...inputStyle, width: 140 }} value={mode} onChange={(e) => setMode(e.target.value as DecisionMode)}>
              {(['analytical', 'emotional', 'mixed'] as const).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#8A8F98', display: 'block', marginBottom: 4 }}>Review on</label>
            <input type="date" style={inputStyle} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div style={{ padding: '9px 18px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} onClick={submit}>Save</div>
          <div style={{ padding: '9px 18px', borderRadius: 999, fontSize: 12.5, color: '#565b64', cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ decision, onReview }: { decision: Decision; onReview: (id: string, actual: string, rating: OutcomeRating) => Promise<void> }) {
  const [context, setContext] = useState<DecisionContext | null>(null);
  const [actual, setActual] = useState('');
  const [rating, setRating] = useState<OutcomeRating>('mixed');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDecisionContext(decision.created_at).then(setContext);
  }, [decision.created_at]);

  const submit = async () => {
    if (!actual.trim()) return;
    setSaving(true);
    await onReview(decision.id, actual.trim(), rating);
    setSaving(false);
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{decision.title}</div>
      <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 6 }}>Expected: {decision.expected_outcome}</div>
      {context && (
        <div style={{ fontSize: 11, color: '#565b64', marginTop: 8, lineHeight: 1.6 }}>
          Since you logged this: {context.netBudgetChange >= 0 ? '+' : ''}{context.netBudgetChange.toFixed(0)} net budget change,
          sobriety streak {context.sobrietyStreakHeld ? 'held' : 'broke'}, {context.callsLogged} calls logged.
        </div>
      )}
      <textarea style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical', marginTop: 12, boxSizing: 'border-box' }} placeholder="What actually happened?" value={actual} onChange={(e) => setActual(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['good', 'mixed', 'bad'] as const).map((r) => (
          <div key={r} onClick={() => setRating(r)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${rating === r ? RATING_COLOR[r] : '#22262B'}`, color: rating === r ? RATING_COLOR[r] : '#565b64' }}>
            {RATING_LABEL[r]}
          </div>
        ))}
        <div style={{ padding: '7px 16px', borderRadius: 999, background: '#F5F6F7', color: '#0A0B0D', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, marginLeft: 'auto' }} onClick={() => !saving && submit()}>
          {saving ? 'Saving…' : 'Log outcome'}
        </div>
      </div>
    </div>
  );
}

export default function DecisionLogScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { decisions, loading, pattern, generatingPattern, patternError, addDecision, reviewDecision, removeDecision, refreshPattern } = useDecisions();
  const today = dateStr(new Date());

  const dueForReview = decisions.filter((d) => d.status === 'pending' && d.review_date <= today);
  const upcoming = decisions.filter((d) => d.status === 'pending' && d.review_date > today);
  const reviewed = decisions.filter((d) => d.status === 'reviewed').sort((a, b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''));

  return (
    <div>
      <div style={homeHeadStyle}>Decision Log</div>
      <div style={homeSubStyle}>Log the call, the reasoning, and what you expected — then see what actually happened.</div>

      <div style={{ ...cardStyle, marginTop: 24, borderColor: pattern ? '#C9A24B55' : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Pattern read</div>
          <div style={{ fontSize: 12, color: generatingPattern ? '#565b64' : '#8A8F98', cursor: generatingPattern ? 'default' : 'pointer' }} onClick={() => !generatingPattern && refreshPattern()}>
            {generatingPattern ? 'Reading…' : pattern ? 'Refresh' : 'Generate'}
          </div>
        </div>
        {pattern ? (
          <>
            <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 10, lineHeight: 1.6 }}>{pattern.text}</div>
            <div style={{ fontSize: 10.5, color: '#565b64', marginTop: 8 }}>Based on {pattern.basedOnCount} reviewed decision{pattern.basedOnCount === 1 ? '' : 's'}.</div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: '#565b64', marginTop: 8 }}>Review a few decisions below, then generate a read on how you actually decide.</div>
        )}
        {patternError && <div style={{ fontSize: 11.5, color: '#c47a7a', marginTop: 8 }}>{patternError}</div>}
      </div>

      {dueForReview.length > 0 && (
        <>
          <div style={sectionTitle}>Due for review</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dueForReview.map((d) => <ReviewCard key={d.id} decision={d} onReview={reviewDecision} />)}
          </div>
        </>
      )}

      <div style={sectionTitle}>Log a new decision</div>
      <NewDecisionForm onAdd={addDecision} />

      {upcoming.length > 0 && (
        <>
          <div style={sectionTitle}>Awaiting review date</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map((d) => (
              <div key={d.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{d.title}</div>
                    <div style={{ fontSize: 11.5, color: '#8A8F98', marginTop: 4 }}>Review on {new Date(d.review_date + 'T00:00:00').toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#565b64', cursor: 'pointer' }} onClick={() => removeDecision(d.id)}>Delete</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={sectionTitle}>History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reviewed.map((d) => (
          <div key={d.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{d.title}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: RATING_COLOR[d.outcome_rating!], border: `1px solid ${RATING_COLOR[d.outcome_rating!]}`, borderRadius: 999, padding: '2px 10px' }}>
                {RATING_LABEL[d.outcome_rating!]}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 6 }}>Expected: {d.expected_outcome}</div>
            <div style={{ fontSize: 12, color: '#C7CAD1', marginTop: 4 }}>Actual: {d.actual_outcome}</div>
          </div>
        ))}
        {!loading && reviewed.length === 0 && <div style={{ fontSize: 12.5, color: '#565b64' }}>No reviewed decisions yet.</div>}
      </div>
    </div>
  );
}
