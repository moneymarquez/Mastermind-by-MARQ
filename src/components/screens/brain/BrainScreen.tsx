import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useBrain, readDraft, writeDraft } from '../../../data/useBrain';
import type { Answers, Choice, Disc, RegionId } from '../../../data/brain';
import {
  QUESTIONS, DISCLAIMER, REGIONS, TYPE_NAME, TYPE_WORD, EXERCISES,
  answeredCount, isComplete, breakdown, regionRead, exercisesFor, weeklyExercises, computePatterns, missedHourRun, tendency,
} from '../../../data/brain';
import { useContacts } from '../../../data/useContacts';
import { useCallOutcomes } from '../../../data/useCallOutcomes';
import { useCallsToday } from '../../../data/useCallsToday';
import { useDailyPlan } from '../../../data/useDailyPlan';
import { dateStr, timeToMinutes } from '../../../data/time';
import { minutesNow } from '../../../lib/dialClock';
import BrainVisual from './BrainVisual';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onNavigate: (screen: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', border: 'none' };
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', fontWeight: 500, cursor: 'pointer', background: 'transparent' };
const labelStyle: CSSProperties = { fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' };
const sectionTitle: CSSProperties = { fontSize: 'var(--text-head)', fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 10 };
const TONE: Record<string, string> = { 'Runs hot': 'var(--warning)', 'Runs steady': 'var(--success)', 'Underused': 'var(--text-tertiary)' };

function weekSeed(): number { const d = new Date(); return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000)); }

export default function BrainScreen({ homeHeadStyle, homeSubStyle, onNavigate }: Props) {
  const brain = useBrain();
  const [mode, setMode] = useState<'landing' | 'assess' | 'results' | 'home'>('landing');
  const [draft, setDraft] = useState<Answers>(readDraft);
  const [saving, setSaving] = useState(false);
  const [activeRegion, setActiveRegion] = useState<RegionId | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Cross-module reads: today's dials, the history Dialing keeps, the goal
  // and the plan's calling hour. Nothing tracked here that isn't tracked
  // already.
  const { contacts } = useContacts();
  const dialingContacts = useMemo(() => contacts.filter((c) => c.source === 'dialing'), [contacts]);
  const { history } = useCallOutcomes(dialingContacts);
  const { callsToday, loading: callsLoading } = useCallsToday();
  const { plan } = useDailyPlan();
  const callBlock = plan?.blocks.find((b) => b.source === 'dials-calls');
  const callStart = callBlock ? timeToMinutes(callBlock.time) : 16 * 60;
  const today = dateStr(new Date());
  const hourOver = minutesNow() >= callStart + 60;

  useEffect(() => {
    if (brain.loading) return;
    if (brain.assessment) setMode((m) => (m === 'landing' ? 'home' : m));
    else if (answeredCount(draft) > 0) setMode('assess');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brain.loading, brain.assessment?.id]);

  const answer = (id: string, c: Choice) => {
    const next = { ...draft, [id]: c };
    setDraft(next);
    writeDraft(next);
  };
  const submit = async () => {
    if (!isComplete(draft) || saving) return;
    setSaving(true);
    const a = await brain.saveAssessment(draft);
    setSaving(false);
    if (a) { setDraft({}); setMode('results'); }
  };

  const a = brain.assessment;
  const scores = a?.scores ?? null;
  const primary: Disc = a?.primary_type ?? 'D';
  const secondary: Disc = a?.secondary_type ?? 'I';
  const bd = scores ? breakdown(primary, secondary, scores) : null;
  const patterns = useMemo(() => computePatterns(brain.checkins, today), [brain.checkins, today]);
  const missed = useMemo(() => missedHourRun(history.map((h) => ({ date: h.date, total: h.total })), today, hourOver), [history, today, hourOver]);
  const todayCheckin = brain.checkins.find((c) => c.date === today) ?? null;
  const weekly = scores ? weeklyExercises(scores, primary, weekSeed()) : [];

  // ── A: not assessed ──
  if (!brain.loading && !a && mode === 'landing') {
    return (
      <div>
        <div style={homeHeadStyle}>Brain</div>
        <div style={homeSubStyle}>How you work, and what to do about it.</div>
        <div style={{ ...cardStyle, marginTop: 24, maxWidth: 640 }}>
          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>Take the assessment</div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8 }}>
            Twenty-eight quick either/or questions, about four minutes. You get a plain-language read on how you sell and follow through, the places it helps you, the places it costs you, and what this app will do about each one. Then a daily one-question check-in tied to the calling hour, which over time is the useful part.
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 10 }}>
            It is a questionnaire about your patterns. It does not scan, diagnose, or find anything you don't already know about yourself.
          </div>
          <button style={{ ...primaryBtn, marginTop: 16 }} onClick={() => setMode('assess')}>Take the assessment</button>
        </div>
      </div>
    );
  }

  // ── B: in progress ──
  if (mode === 'assess') {
    const n = answeredCount(draft);
    const next = QUESTIONS.find((q) => !draft[q.id]);
    const pct = Math.round((n / QUESTIONS.length) * 100);
    return (
      <div>
        <div style={homeHeadStyle}>Assessment</div>
        <div style={homeSubStyle}>Which is more like you, most days at work. Go with the first answer.</div>
        <div style={{ marginTop: 18, maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>
            <span>{n} of {QUESTIONS.length}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--radius-pill)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--text)', transition: 'width 240ms ease' }} />
          </div>
          {next ? (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={labelStyle}>Question {QUESTIONS.indexOf(next) + 1}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {(['a', 'b'] as const).map((c) => (
                  <div key={c} onClick={() => answer(next.id, c)} style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-body)', color: 'var(--text)', lineHeight: 1.45 }}>
                    {next[c].text}
                  </div>
                ))}
                <div onClick={() => answer(next.id, 'both')} style={{ padding: '10px 16px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                  Both, about equally — I honestly can't split them
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5 }}>
                Pick the one that's more true, even by a little — that's where the signal is. "Both" scores half to each side, so use it only when they really are a tie.
              </div>
              {n > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { const prev = QUESTIONS[QUESTIONS.indexOf(next) - 1]; if (prev) { const d = { ...draft }; delete d[prev.id]; setDraft(d); writeDraft(d); } }}>← Change the last answer</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>That's all of them.</div>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6 }}>Your answers are saved as given; the scoring can be revised later without asking you again.</div>
              <button style={{ ...primaryBtn, marginTop: 14, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={submit}>{saving ? 'Scoring…' : 'See my results'}</button>
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>Progress is saved on this device — leave and come back any time.</div>
        </div>
      </div>
    );
  }

  if (brain.loading || !a || !scores || !bd) return <div style={homeSubStyle}>Loading…</div>;

  // ── Shared pieces for C and D ──
  const regionPanel = activeRegion && (() => {
    const r = REGIONS.find((x) => x.id === activeRegion)!;
    const read = regionRead(r.id, scores, primary);
    return (
      <div style={{ ...cardStyle, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{r.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {r.handles.toLowerCase()}</span></div>
          <span style={{ ...labelStyle, color: TONE[read.label] }}>{read.label} · tendency {read.level}/5</span>
        </div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>{r.plain}</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5, marginTop: 8 }}><span style={{ fontWeight: 600 }}>From your assessment:</span> {read.relate}</div>
        <div style={{ ...labelStyle, marginTop: 14, marginBottom: 6 }}>Exercises</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercisesFor(r.id).slice(0, 4).map((e) => <ExerciseRow key={e.id} e={e} />)}
        </div>
      </div>
    );
  })();

  const visual = (
    <div>
      <div style={sectionTitle}>Your patterns, mapped</div>
      <div style={{ ...cardStyle, padding: 14 }}>
        <BrainVisual scores={scores} primary={primary} active={activeRegion} onSelect={(id) => setActiveRegion((cur) => (cur === id ? null : id))} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {(['Runs hot', 'Runs steady', 'Underused'] as const).map((l) => <span key={l} style={{ ...labelStyle, color: TONE[l] }}>● {l}</span>)}
          <span style={{ ...labelStyle, color: 'var(--text-tertiary)' }}>numbers are tendency 1–5, not a measurement</span>
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 10 }}>{DISCLAIMER}</div>
        {!activeRegion && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 6 }}>Tap a region.</div>}
      </div>
      {regionPanel}
    </div>
  );

  const hookCard = missed >= 3 && (
    <div style={{ ...cardStyle, marginTop: 20, borderColor: 'var(--warning)' }}>
      <div style={labelStyle}>Pattern</div>
      <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>The calling hour hasn't happened for {missed} weekdays running.</div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6 }}>
        That's read straight from the dial log, not a guess. Three misses is where a habit stops being a habit. One exercise, aimed at the part of you that decides whether the hour starts:
      </div>
      <div style={{ marginTop: 10 }}><ExerciseRow e={EXERCISES.find((e) => e.id === (regionRead('amygdala', scores, primary).level >= 4 ? 'first-dial-cold' : 'protected-hour'))!} /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={primaryBtn} onClick={() => onNavigate('dialing')}>Open Dialing</button>
        <button style={ghostBtn} onClick={() => onNavigate('daily-plan')}>Open Daily Plan</button>
      </div>
    </div>
  );

  const checkinCard = (
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <div style={labelStyle}>Today's check-in</div>
      {todayCheckin ? (
        <div style={{ marginTop: 8, fontSize: 'var(--text-body-sm)', color: 'var(--text)' }}>
          Logged: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{todayCheckin.score}/5</span>{todayCheckin.note ? ` — ${todayCheckin.note}` : ''}
          <span style={{ color: 'var(--text-tertiary)' }}> · {todayCheckin.hour_happened ? `hour happened, ${todayCheckin.dials} dials` : 'no dials logged today'}</span>
        </div>
      ) : (
        <CheckinForm
          hourHappened={callsToday > 0}
          dials={callsToday}
          loading={callsLoading}
          onSave={(score, note) => brain.saveCheckin({ date: today, score, note, hour_happened: callsToday > 0, dials: callsToday })}
        />
      )}
    </div>
  );

  const patternsCard = patterns.count >= 7 ? (
    <div style={{ ...cardStyle, marginTop: 12 }}>
      <div style={labelStyle}>Patterns · {patterns.count} check-ins</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 10 }}>
        <Stat label="Best day" value={patterns.bestDay ? `${patterns.bestDay.day.slice(0, 3)} · ${patterns.bestDay.avg.toFixed(1)}` : '—'} />
        <Stat label="Worst day" value={patterns.worstDay ? `${patterns.worstDay.day.slice(0, 3)} · ${patterns.worstDay.avg.toFixed(1)}` : '—'} />
        <Stat label="Check-in streak" value={`${patterns.checkinStreak}d`} />
        <Stat label="Calling-hour streak" value={patterns.hourStreak ? `${patterns.hourStreak}d` : patterns.hourStreakBroken ? 'broken' : '0'} tone={patterns.hourStreakBroken ? 'var(--danger)' : undefined} />
      </div>
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5, marginTop: 12 }}>
        {patterns.correlationRead}{patterns.correlation !== null && <span style={{ color: 'var(--text-tertiary)' }}> (r = {patterns.correlation.toFixed(2)})</span>}
      </div>
    </div>
  ) : (
    <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 10 }}>{patterns.count} of 7 check-ins before the patterns card appears — best and worst days, whether good hours are high-dial hours, and your streaks.</div>
  );

  const historyList = brain.checkins.length > 0 && (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(showAll ? brain.checkins : brain.checkins.slice(0, 7)).map((c) => (
          <div key={c.date} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', width: 70, flexShrink: 0 }}>{c.date.slice(5)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', width: 34, flexShrink: 0 }}>{c.score}/5</span>
            <span style={{ width: 90, flexShrink: 0, color: c.hour_happened ? 'var(--success)' : 'var(--text-tertiary)' }}>{c.hour_happened ? `${c.dials} dials` : 'no hour'}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.note ?? ''}</span>
          </div>
        ))}
      </div>
      {brain.checkins.length > 7 && <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `Show all ${brain.checkins.length}`}</span>}
    </div>
  );

  const weeklyCard = (
    <div>
      <div style={sectionTitle}>This week's exercises</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weekly.map((e) => <ExerciseRow key={e.id} e={e} showRegion />)}
      </div>
    </div>
  );

  // ── C: results (first read after the assessment) ──
  if (mode === 'results') {
    const t = (tr: 'D' | 'I' | 'S' | 'C' | 'CON' | 'STAB') => tendency(tr, scores);
    return (
      <div>
        <div style={homeHeadStyle}>{bd.title}</div>
        <div style={homeSubStyle}>{TYPE_WORD[primary]} first, {TYPE_WORD[secondary].toLowerCase()} second.</div>
        <div style={{ ...cardStyle, marginTop: 20, maxWidth: 720 }}>
          <div style={labelStyle}>What you are</div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text)', lineHeight: 1.6, marginTop: 6 }}>{bd.what}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
            {(['D', 'I', 'S', 'C'] as const).map((k) => (
              <div key={k} style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{t(k)}</span>/5 {TYPE_NAME[k].toLowerCase()}
              </div>
            ))}
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{t('CON')}</span>/5 follow-through</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{t('STAB')}</span>/5 steady under pressure</div>
          </div>
        </div>
        <Bullets title="Where this helps you" items={bd.helps} />
        <Bullets title="Where this costs you" items={bd.costs} />
        <div style={{ ...cardStyle, marginTop: 12, maxWidth: 720 }}>
          <div style={labelStyle}>What Masterminds will do about it</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {bd.product.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--success)', flexShrink: 0 }}>▸</span>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>{p.text} <span style={{ color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onNavigate(p.screen)}>Open →</span></div>
              </div>
            ))}
          </div>
        </div>
        {visual}
        {weeklyCard}
        <div style={{ marginTop: 20 }}><button style={primaryBtn} onClick={() => setMode('home')}>Done — go to check-ins</button></div>
      </div>
    );
  }

  // ── D: returning ──
  return (
    <div>
      <div style={homeHeadStyle}>Brain</div>
      <div style={homeSubStyle}>{bd.title} · {TYPE_WORD[secondary].toLowerCase()} second. <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setMode('results')}>Read the breakdown</span> · <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setDraft({}); setMode('assess'); }}>Retake</span></div>
      {hookCard}
      {checkinCard}
      {patternsCard}
      {historyList}
      {weeklyCard}
      {visual}
      <div style={{ marginTop: 24, fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', lineHeight: 1.5, maxWidth: 640 }}>
        Nothing on this tab is a scan, a diagnosis, or a read of anything you haven't told it. It is your answers and your own check-ins, surfaced back.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: tone ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ ...cardStyle, marginTop: 12, maxWidth: 720 }}>
      <div style={labelStyle}>{title}</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5 }}>{it}</li>)}
      </ul>
    </div>
  );
}

function ExerciseRow({ e, showRegion }: { e: { id: string; name: string; region: string; trains: string; how: string; minutes: number; difficulty: number }; showRegion?: boolean }) {
  const [open, setOpen] = useState(false);
  const region = REGIONS.find((r) => r.id === e.region);
  return (
    <div onClick={() => setOpen((v) => !v)} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{e.name}</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{e.minutes ? `${e.minutes} min` : 'no time'} · {'●'.repeat(e.difficulty)}{'○'.repeat(3 - e.difficulty)}{showRegion && region ? ` · ${region.handles.toLowerCase()}` : ''}</div>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>{e.trains}</div>
      {open && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5, marginTop: 8 }}>{e.how}</div>}
    </div>
  );
}

function CheckinForm({ hourHappened, dials, loading, onSave }: { hourHappened: boolean; dials: number; loading: boolean; onSave: (score: number, note: string | null) => Promise<void> }) {
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>How did that hour feel?</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>{loading ? 'Reading today\'s dials…' : hourHappened ? `${dials} dial${dials === 1 ? '' : 's'} logged today — the hour counts as happened.` : 'No dials logged yet today — this will be saved as a day the hour didn\'t happen. Log it anyway; the pattern is the point.'}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} onClick={() => setScore(n)} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 600, border: `1px solid ${score === n ? 'var(--text)' : 'var(--border)'}`, background: score === n ? 'var(--text)' : 'transparent', color: score === n ? 'var(--bg)' : 'var(--text)' }}>{n}</div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4, maxWidth: 252 }}><span>rough</span><span>good</span></div>
      <input style={{ marginTop: 10, width: '100%', maxWidth: 480, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body-sm)', outline: 'none', boxSizing: 'border-box' }} placeholder="One line, optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ marginTop: 10 }}>
        <button style={{ ...primaryBtn, opacity: score === null || busy ? 0.6 : 1 }} disabled={score === null || busy} onClick={async () => { if (score === null) return; setBusy(true); await onSave(score, note.trim() || null); setBusy(false); }}>{busy ? 'Saving…' : 'Save check-in'}</button>
      </div>
    </div>
  );
}
