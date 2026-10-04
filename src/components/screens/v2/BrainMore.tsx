import { useMemo, useState } from 'react';
import { useBrain, readDraft, writeDraft } from '../../../data/useBrain';
import { QUESTIONS, answeredCount, isComplete, breakdown, tendency, weeklyExercises, computePatterns, TYPE_NAME, TYPE_WORD, REGIONS, DISCLAIMER } from '../../../data/brain';
import type { Answers, Choice, Disc } from '../../../data/brain';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { useModule } from '../../mm/Page';
import { ymd, shortDate } from './util';

type Ex = { id: string; name: string; region: string; trains: string; how: string; minutes: number; difficulty: number };
const STRENGTH: [Choice, string][] = [['a', 'Clearly A'], ['a_lean', 'Leans A'], ['both', 'Both'], ['b_lean', 'Leans B'], ['b', 'Clearly B']];

function Exercise({ e, showRegion }: { e: Ex; showRegion?: boolean }) {
  const [open, setOpen] = useState(false);
  const region = REGIONS.find((r) => r.id === e.region);
  return (
    <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{e.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{e.minutes ? `${e.minutes} min` : 'no time'} · {'●'.repeat(e.difficulty)}{'○'.repeat(3 - e.difficulty)}</span>
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.trains}{showRegion && region ? ` · ${region.handles.toLowerCase()}` : ''}</span>
      {open && <span className="mm-rise" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginTop: 4 }}>{e.how}</span>}
    </button>
  );
}

/** The 4-minute assessment: one either/or at a time, five strengths. */
export function BrainAssessment({ onDone }: { onDone: () => void }) {
  const brain = useBrain();
  const [draft, setDraft] = useState<Answers>(readDraft);
  const [saving, setSaving] = useState(false);
  const n = answeredCount(draft), next = QUESTIONS.find((q) => !draft[q.id]);
  const pct = Math.round((n / QUESTIONS.length) * 100);
  const answer = (id: string, c: Choice) => { const d = { ...draft, [id]: c }; setDraft(d); writeDraft(d); };
  const back = () => { const prev = next ? QUESTIONS[QUESTIONS.indexOf(next) - 1] : QUESTIONS[QUESTIONS.length - 1]; if (prev) { const d = { ...draft }; delete d[prev.id]; setDraft(d); writeDraft(d); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}><span>{n} of {QUESTIONS.length}</span><span>{pct}%</span></div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width .24s ease' }} /></div>
      </div>
      {next ? (
        <Card key={next.id} title={`Question ${QUESTIONS.indexOf(next) + 1}`} meta="Go with your first answer" style={{ animation: 'mmRise .3s ease both' }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: 'var(--text)' }}>{next.scenario}</p>
          {(['a', 'b'] as const).map((c) => (
            <button key={c} onClick={() => answer(next.id, c)} style={{ display: 'flex', gap: 12, padding: '14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, background: 'var(--accent-wash)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.toUpperCase()}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{next[c].text}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{next[c].hint}</span>
              </span>
            </button>
          ))}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Or say how strongly</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6 }}>
            {STRENGTH.map(([c, l]) => <button key={c} className="mm-btn" onClick={() => answer(next.id, c)} style={{ height: 44, padding: '0 4px', fontSize: 12.5, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'normal', borderStyle: c === 'both' ? 'dashed' : 'solid' }}>{l}</button>)}
          </div>
          {n > 0 && <button className="mm-btn" style={{ alignSelf: 'flex-start', height: 34, fontSize: 13 }} onClick={back}>Change the last answer</button>}
        </Card>
      ) : (
        <Card title="That's all of them">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Your answers are saved as given; the scoring can be revised later without asking you again.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 46 }} disabled={saving || !isComplete(draft)} onClick={async () => { setSaving(true); const a = await brain.saveAssessment(draft); setSaving(false); if (a) { setDraft({}); onDone(); } }}>{saving ? 'Scoring…' : 'See my results'}</button>
            <button className="mm-btn" style={{ height: 46 }} onClick={back}>Back</button>
          </div>
        </Card>
      )}
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Progress is saved on this device. Leave and come back any time. It's a questionnaire about your patterns; it doesn't scan or diagnose anything.</span>
    </div>
  );
}

/** The full read: what you are, where it helps and costs, what the app does
 *  about it, this week's exercises, and the check-in patterns + history. */
export function BrainProfile({ onRetake }: { onRetake: () => void }) {
  const { nav, device } = useModule();
  const phone = device === 'phone';
  const brain = useBrain();
  const [showAll, setShowAll] = useState(false);
  const a = brain.assessment, s = a?.scores ?? null;
  const primary: Disc = a?.primary_type ?? 'D', secondary: Disc = a?.secondary_type ?? 'I';
  const today = ymd(new Date());
  const patterns = useMemo(() => computePatterns(brain.checkins, today), [brain.checkins, today]);
  if (brain.loading) return <span style={{ color: 'var(--text-tertiary)' }}>Loading…</span>;
  if (!a || !s) return <BrainAssessment onDone={() => brain.reload()} />;
  const bd = breakdown(primary, secondary, s);
  const weekly = weeklyExercises(s, primary, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000)));
  const t = (k: 'D' | 'I' | 'S' | 'C' | 'CON' | 'STAB') => tendency(k, s);
  const list = (title: string, items: string[], tone: string) => (
    <Card title={title}>
      {items.map((it, i) => <div key={i} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: tone, flex: 'none', marginTop: 9 }} />{it}</div>)}
    </Card>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><div style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{bd.title}</div><div style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{TYPE_WORD[primary]} first, {TYPE_WORD[secondary].toLowerCase()} second · assessed {shortDate(a.created_at.slice(0, 10))}</div></div>
        <button className="mm-btn" onClick={onRetake}>Retake</button>
      </div>
      <Card title="What you are">
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}>{bd.what}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['D', 'I', 'S', 'C'] as const).map((k) => <Chip key={k} k={k === primary ? 'accent' : 'neutral'}>{TYPE_NAME[k]} {t(k)}/5</Chip>)}
          <Chip k="neutral">Follow-through {t('CON')}/5</Chip><Chip k="neutral">Under pressure {t('STAB')}/5</Chip>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {list('Where this helps you', bd.helps, 'var(--success)')}
        {list('Where this costs you', bd.costs, 'var(--warning)')}
      </div>
      <Card title="What Masterminds will do about it" flush>
        <div style={{ paddingBottom: 6 }}>{bd.product.map((p, i) => (
          <button key={i} onClick={() => nav(p.screen)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 0', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ flex: 1, fontSize: 15, lineHeight: 1.45, color: 'var(--text)' }}>{p.text}</span><span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Open ›</span>
          </button>
        ))}</div>
      </Card>
      <Card title="This week's exercises" meta="Tap one for how">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{weekly.map((e) => <Exercise key={e.id} e={e} showRegion />)}</div>
      </Card>
      <Card title="Check-in patterns" meta={`${patterns.count} check-ins`}>
        {patterns.count >= 7 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: 10 }}>
              <Stat label="Best day" value={patterns.bestDay ? `${patterns.bestDay.day.slice(0, 3)} ${patterns.bestDay.avg.toFixed(1)}` : '—'} />
              <Stat label="Worst day" value={patterns.worstDay ? `${patterns.worstDay.day.slice(0, 3)} ${patterns.worstDay.avg.toFixed(1)}` : '—'} />
              <Stat label="Check-in streak" value={`${patterns.checkinStreak}d`} />
              <Stat label="Calling-hour streak" value={patterns.hourStreak ? `${patterns.hourStreak}d` : patterns.hourStreakBroken ? 'Broken' : '0'} k={patterns.hourStreakBroken ? 'bad' : 'neutral'} />
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{patterns.correlationRead}{patterns.correlation !== null && ` (r = ${patterns.correlation.toFixed(2)})`}</p>
          </>
        ) : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{patterns.count} of 7 check-ins before patterns appear: best and worst days, whether good hours are high-dial hours, and your streaks.</span>}
        {brain.checkins.length > 0 && (
          <div>
            {(showAll ? brain.checkins : brain.checkins.slice(0, 7)).map((c, i) => (
              <div key={c.date} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : '1px solid var(--grid)' }}>
                <span style={{ width: 56, fontSize: 13, color: 'var(--text-tertiary)' }}>{shortDate(c.date)}</span>
                <Chip k={c.score >= 4 ? 'good' : c.score <= 2 ? 'warn' : 'neutral'}>{c.score}/5</Chip>
                <span style={{ fontSize: 13, color: c.hour_happened ? 'var(--success)' : 'var(--text-tertiary)' }}>{c.hour_happened ? `${c.dials} dials` : 'No hour'}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note ?? ''}</span>
              </div>
            ))}
            {brain.checkins.length > 7 && <button className="mm-btn" style={{ height: 32, fontSize: 13, marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `Show all ${brain.checkins.length}`}</button>}
          </div>
        )}
      </Card>
      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>{DISCLAIMER}</span>
    </div>
  );
}

/** The "More" view: full profile, or the assessment when retaking / not yet taken. */
export function BrainMoreView({ start }: { start: 'profile' | 'assess' }) {
  const brain = useBrain();
  const [mode, setMode] = useState<'profile' | 'assess'>(start === 'assess' || (!brain.loading && !brain.assessment) ? 'assess' : 'profile');
  return mode === 'assess' ? <BrainAssessment onDone={() => { brain.reload(); setMode('profile'); }} /> : <BrainProfile onRetake={() => setMode('assess')} />;
}
