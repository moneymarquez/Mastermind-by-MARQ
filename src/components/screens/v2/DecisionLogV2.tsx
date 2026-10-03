import { useEffect, useMemo, useState } from 'react';
import { useDecisions, getDecisionContext } from '../../../data/useDecisions';
import type { Decision, DecisionContext, DecisionMode, OutcomeRating } from '../../../data/useDecisions';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Donut } from '../../mm/charts';
import { Empty } from '../../mm/States';
import ModuleDash from '../../mm/ModuleDash';
import type { SplitRow } from '../../mm/ModuleDash';
import { Page, Sheet, Field, field, area, useModule, useAi, AiOffCard, NovaMark, ChoiceRow } from '../../mm/Page';
import { ymd, shortDate, addDays, usd } from './util';

const RATING: Record<OutcomeRating, { l: string; k: ChipKind }> = { good: { l: 'Good call', k: 'good' }, mixed: { l: 'Mixed', k: 'warn' }, bad: { l: 'Bad call', k: 'bad' } };
const MODE: Record<DecisionMode, string> = { analytical: 'Analytical', emotional: 'Emotional', mixed: 'Mixed' };
const stamp = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
/** Logged between 10 PM and 4 AM, local time. Pure. */
export const lateNight = (iso: string) => { const h = new Date(iso).getHours(); return h >= 22 || h < 4; };

function status(d: Decision, today: string): { c: string; k: ChipKind } {
  if (d.status === 'reviewed' && d.outcome_rating) return { c: RATING[d.outcome_rating].l, k: RATING[d.outcome_rating].k };
  if (d.review_date <= today) return { c: d.review_date === today ? 'Review due' : `Review due ${shortDate(d.review_date)}`, k: 'warn' };
  return { c: `Review ${shortDate(d.review_date)}`, k: 'neutral' };
}

export default function DecisionLogV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const D = useDecisions();
  const [adding, setAdding] = useState(false);
  const [review, setReview] = useState<{ d: Decision; r: OutcomeRating | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const today = ymd(new Date());

  const due = D.decisions.filter((d) => d.status !== 'reviewed' && d.review_date <= today);
  const reviewed = D.decisions.filter((d) => d.status === 'reviewed');
  const recent = useMemo(() => [...D.decisions].sort((a, b) => b.created_at.localeCompare(a.created_at)), [D.decisions]);
  const year = String(new Date().getFullYear());
  const good = reviewed.filter((d) => d.outcome_rating === 'good').length;
  const late = reviewed.filter((d) => lateNight(d.created_at));
  const lateBad = late.filter((d) => d.outcome_rating === 'bad').length;
  const day = reviewed.filter((d) => !lateNight(d.created_at));
  const dayBad = day.filter((d) => d.outcome_rating === 'bad').length;
  const donut = (['good', 'mixed', 'bad'] as const).map((r) => ({ name: RATING[r].l, value: reviewed.filter((d) => d.outcome_rating === r).length })).filter((x) => x.value);
  const lateNote = late.length >= 2 ? `Decisions logged after 10 PM went badly ${lateBad} of ${late.length} times. Daytime ones: ${dayBad} of ${day.length}.` : null;

  if (!D.loading && D.decisions.length === 0) {
    return (
      <Page title="Decision Log" sub="Decisions, reasoning, and how they turned out">
        <Empty text="No decisions logged. Write down a call you're making and why, then review it in 30 days." cta="Log a decision" onCta={() => setAdding(true)} />
        {ai === false && <AiOffCard text="Nova's pattern notes are off. Your log, reviews, and outcome chart still work." />}
        {adding && <NewSheet onClose={() => setAdding(false)} add={D.addDecision} />}
      </Page>
    );
  }

  const first = due[0];
  const reviewHero = first && (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Ready to review{due.length > 1 ? ` · 1 of ${due.length}` : ''}</span><Chip k="warn">{first.review_date === today ? 'Due today' : `Due ${shortDate(first.review_date)}`}</Chip></div>
      <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{first.title}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: 14, lineHeight: 1.4, color: 'var(--text)' }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Why</span><span>{first.reasoning}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Expected</span><span>{first.expected_outcome}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Decided</span><span>{stamp(first.created_at)}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>How did it turn out?</span>
      <ChoiceRow options={['Good call', 'Mixed', 'Bad call']} onPick={(o) => setReview({ d: first, r: (Object.keys(RATING) as OutcomeRating[]).find((k) => RATING[k].l === o)! })} />
    </section>
  );
  const outcomes = reviewed.length > 0 && (
    <Card title="How they turned out" meta={`${reviewed.length} reviewed`} wide={!phone}>
      <Donut rows={donut} pre="" center="Reviewed" />
      {lateNote && <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-3)', fontSize: 14, lineHeight: 1.45, color: 'var(--text)' }}>{lateNote}</div>}
    </Card>
  );
  const pattern = ai === false
    ? <AiOffCard text="Nova's pattern notes are off. Your log, reviews, and outcome chart still work." />
    : (
      <Card title="How you decide" meta={D.pattern ? `From ${D.pattern.basedOnCount} reviews` : 'Pattern read'} wide={!phone}>
        <NovaMark />
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{D.pattern?.text ?? (reviewed.length < 3 ? `Review ${3 - reviewed.length} more ${3 - reviewed.length === 1 ? 'decision' : 'decisions'} and Nova can read how you actually decide.` : 'Ready for a read on how you actually decide.')}</p>
        {D.patternError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{D.patternError}</span>}
        {reviewed.length >= 3 && <button className="mm-btn" style={{ alignSelf: 'flex-start' }} disabled={D.generatingPattern} onClick={() => void D.refreshPattern()}>{D.generatingPattern ? 'Reading…' : D.pattern ? 'Refresh' : 'Read my pattern'}</button>}
      </Card>
    );

  const splitRows: SplitRow[] = recent.map((d) => {
    const s = status(d, today);
    return {
      id: d.id, n: d.title, ini: 'DL', m: shortDate(ymd(new Date(d.created_at))), c: s.c, k: s.k, a: d.review_date <= today && d.status !== 'reviewed' ? 'Today' : shortDate(ymd(new Date(d.created_at))),
      fields: [['Decided', stamp(d.created_at)], [d.status === 'reviewed' ? 'Reviewed' : 'Review on', d.status === 'reviewed' && d.reviewed_at ? shortDate(ymd(new Date(d.reviewed_at))) : shortDate(d.review_date)], ['Confidence', d.confidence != null ? `${d.confidence} of 5` : '—'], ['Felt', d.mode ? MODE[d.mode] : '—']],
      body: [`Why: ${d.reasoning}`, `Expected: ${d.expected_outcome}`, ...(d.actual_outcome ? [`What happened: ${d.actual_outcome}`] : [])],
      note: d.status !== 'reviewed' && lateNote ? (lateNight(d.created_at) ? `This one was logged at ${new Date(d.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. ${lateNote}` : undefined) : undefined,
      actions: d.status !== 'reviewed'
        ? [{ t: 'Good call', onClick: () => setReview({ d, r: 'good' }) }, { t: 'Mixed', onClick: () => setReview({ d, r: 'mixed' }) }, { t: 'Bad call', onClick: () => setReview({ d, r: 'bad' }) }, { t: 'Delete', onClick: () => { if (window.confirm('Delete this decision?')) void D.removeDecision(d.id); } }]
        : [{ t: 'Delete', onClick: () => { if (window.confirm('Delete this decision?')) void D.removeDecision(d.id); } }],
    };
  });
  const stats = [
    <Stat key="a" label="Logged" value={String(D.decisions.filter((d) => d.created_at.startsWith(year)).length)} pill="This year" />,
    <Stat key="b" label="Good calls" value={`${good} of ${reviewed.length}`} pill="Reviewed" k={reviewed.length ? 'good' : 'neutral'} />,
    <Stat key="c" label="Late-night calls" value={late.length ? `${lateBad} of ${late.length} bad` : '0'} pill="After 10 PM" k={lateBad ? 'bad' : 'neutral'} />,
    <Stat key="d" label="Due for review" value={String(due.length)} pill={due.length ? 'Today' : 'None'} k={due.length ? 'warn' : 'good'} />,
  ];
  const openD = D.decisions.find((d) => d.id === openId) ?? null;

  return (
    <Page title="Decision Log" sub={`${D.decisions.length} ${D.decisions.length === 1 ? 'decision' : 'decisions'}`} fab={phone ? { t: 'Log decision', onClick: () => setAdding(true) } : undefined}>
      {phone ? (
        <>
          {reviewHero}
          {outcomes}
          <Card title="Recent" flush>
            <div>{recent.slice(0, 8).map((d, i) => { const s = status(d, today); return <Row key={d.id} first={i === 0} name={d.title} meta={shortDate(ymd(new Date(d.created_at)))} chip={s.c} k={s.k} onClick={() => setOpenId(d.id)} />; })}</div>
          </Card>
          {pattern}
        </>
      ) : (
        <>
          <ModuleDash device={device} novaOpen={novaOpen} spec={{ split: { search: 'Search decisions', add: { t: 'Log decision', onClick: () => setAdding(true) }, rows: splitRows } }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{outcomes}{pattern}</div>
        </>
      )}
      {adding && <NewSheet onClose={() => setAdding(false)} add={D.addDecision} />}
      {review && <ReviewSheet d={review.d} initial={review.r} onClose={() => setReview(null)} onSave={D.reviewDecision} />}
      {openD && (
        <Sheet title={openD.title} onClose={() => setOpenId(null)}>
          <Chip k={status(openD, today).k}>{status(openD, today).c}</Chip>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: 14, lineHeight: 1.4, color: 'var(--text)' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Why</span><span>{openD.reasoning}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>Expected</span><span>{openD.expected_outcome}</span>
            {openD.actual_outcome && <><span style={{ color: 'var(--text-tertiary)' }}>Actual</span><span>{openD.actual_outcome}</span></>}
            <span style={{ color: 'var(--text-tertiary)' }}>Decided</span><span>{stamp(openD.created_at)}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>Confidence</span><span>{openD.confidence != null ? `${openD.confidence} of 5` : '—'}{openD.mode ? ` · ${MODE[openD.mode]}` : ''}</span>
          </div>
          {openD.status !== 'reviewed' && <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => { setOpenId(null); setReview({ d: openD, r: null }); }}>Review it now</button>}
          <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={async () => { if (window.confirm('Delete this decision?')) { await D.removeDecision(openD.id); setOpenId(null); } }}>Delete</button>
        </Sheet>
      )}
    </Page>
  );
}

function ReviewSheet({ d, initial, onClose, onSave }: { d: Decision; initial: OutcomeRating | null; onClose: () => void; onSave: (id: string, actual: string, r: OutcomeRating) => Promise<void> }) {
  const [rating, setRating] = useState<OutcomeRating | null>(initial);
  const [actual, setActual] = useState('');
  const [ctx, setCtx] = useState<DecisionContext | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getDecisionContext(d.created_at).then(setCtx); }, [d.created_at]);
  return (
    <Sheet title="How did it turn out?" onClose={onClose}>
      <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600 }}>{d.title}</span>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Expected: {d.expected_outcome}</span>
      {ctx && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Since you logged it: {usd(ctx.netBudgetChange)} net in Budgeting, sobriety streak {ctx.sobrietyStreakHeld ? 'held' : 'broke'}, {ctx.callsLogged} calls logged.</span>}
      <ChoiceRow options={['Good call', 'Mixed', 'Bad call']} value={rating ? RATING[rating].l : null} onPick={(o) => setRating((Object.keys(RATING) as OutcomeRating[]).find((k) => RATING[k].l === o)!)} />
      <Field l="What actually happened?"><textarea value={actual} onChange={(e) => setActual(e.target.value)} style={area} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !rating || !actual.trim()} onClick={async () => { setBusy(true); await onSave(d.id, actual.trim(), rating!); onClose(); }}>{busy ? 'Saving…' : 'Log outcome'}</button>
    </Sheet>
  );
}

function NewSheet({ onClose, add }: { onClose: () => void; add: ReturnType<typeof useDecisions>['addDecision'] }) {
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [expected, setExpected] = useState('');
  const [conf, setConf] = useState('3');
  const [mode, setMode] = useState<DecisionMode>('analytical');
  const [review, setReview] = useState(addDays(ymd(new Date()), 30));
  const [busy, setBusy] = useState(false);
  const ok = title.trim() && why.trim() && expected.trim() && review;
  return (
    <Sheet title="Log a decision" onClose={onClose}>
      <Field l="What did you decide?"><input value={title} onChange={(e) => setTitle(e.target.value)} style={field} placeholder="Raise Ridgeline to $2,400" /></Field>
      <Field l="Why"><textarea value={why} onChange={(e) => setWhy(e.target.value)} style={area} /></Field>
      <Field l="What you expect to happen"><textarea value={expected} onChange={(e) => setExpected(e.target.value)} style={{ ...area, height: 72 }} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field l="Confidence"><select value={conf} onChange={(e) => setConf(e.target.value)} style={field}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} of 5</option>)}</select></Field>
        <Field l="Felt"><select value={mode} onChange={(e) => setMode(e.target.value as DecisionMode)} style={field}>{(Object.keys(MODE) as DecisionMode[]).map((m) => <option key={m} value={m}>{MODE[m]}</option>)}</select></Field>
      </div>
      <Field l="Review on"><input type="date" value={review} onChange={(e) => setReview(e.target.value)} style={field} /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || !ok} onClick={async () => { setBusy(true); await add({ title: title.trim(), reasoning: why.trim(), expected_outcome: expected.trim(), confidence: Number(conf), mode, review_date: review }); onClose(); }}>{busy ? 'Saving…' : 'Save decision'}</button>
    </Sheet>
  );
}
