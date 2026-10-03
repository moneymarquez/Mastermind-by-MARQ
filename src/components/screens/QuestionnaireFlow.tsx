import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Question } from '../../data/scalingPlannerQuestions';
import type { QuestionnaireStatus } from '../../data/types';
import { Page, useModule, useAi, AiOffCard, NovaMark, area } from '../mm/Page';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import { Empty } from '../mm/States';

interface Row {
  id: string;
  status: QuestionnaireStatus;
  answers: Record<string, string>;
  created_at: string;
}

interface Props<T extends Row> {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  title: string;
  subtitle: string;
  flagNote: string;
  badge?: string;
  questions: Question[];
  rows: T[];
  loading: boolean;
  active: T | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  start: () => Promise<void>;
  saveAnswer: (id: string, key: string, value: string) => Promise<void>;
  complete: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  generate: (answers: Record<string, string>) => Promise<string>;
  getText: (row: T) => string | null;
  itemLabel: (row: T) => string;
  newLabel: string;
}


export default function QuestionnaireFlow<T extends Row>({
  homeHeadStyle, homeSubStyle, title, subtitle, flagNote, badge, questions, rows, loading,
  active, activeId, setActiveId, start, saveAnswer, complete, remove, generate, getText, itemLabel, newLabel,
}: Props<T>) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => {
    setStep(0);
  }, [activeId]);

  useEffect(() => {
    if (active) setDraft(active.answers[questions[step]?.key] ?? '');
  }, [active, step, questions]);

  const { device } = useModule();
  const phone = device === 'phone';
  const ai = useAi();
  void homeHeadStyle; void homeSubStyle;
  const sub = badge ? `${subtitle} · ${badge}` : subtitle;

  if (!active) {
    return (
      <Page title={title} sub={sub} fab={{ t: newLabel, onClick: () => void start() }}>
        {ai === false && <AiOffCard text="Answers save as you go. Nova writes the result once AI is connected." />}
        {!loading && rows.length === 0 ? <Empty text={flagNote} cta={newLabel} onCta={() => void start()} /> : (
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--text-tertiary)', maxWidth: 640 }}>{flagNote}</p>
            <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : 'repeat(auto-fill,minmax(280px,1fr))', gap: phone ? 12 : 16 }}>
              {rows.map((row) => {
                const n = Object.values(row.answers).filter((v) => v?.trim()).length;
                const done = row.status === 'complete';
                return (
                  <section key={row.id} role="button" tabIndex={0} onClick={() => setActiveId(row.id)} onKeyDown={(e) => { if (e.key === 'Enter') setActiveId(row.id); }}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, minWidth: 0 }}>{itemLabel(row)}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${done ? 100 : (n / questions.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <Chip k={done ? 'good' : 'warn'}>{done ? 'Complete' : `${n} of ${questions.length} answered`}</Chip>
                      <button className="mm-btn" style={{ height: 30, fontSize: 12.5, color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete ${itemLabel(row)}?`)) void remove(row.id); }}>Delete</button>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </Page>
    );
  }

  const text = getText(active);
  if (active.status === 'complete' && text) {
    return (
      <Page title={itemLabel(active)} sub={title} menu={[{ t: 'Delete', danger: true, onClick: () => { if (window.confirm('Delete this?')) { void remove(active.id); setActiveId(null); } } }]}>
        <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setActiveId(null)}>‹ All</button>
        <Card wide={!phone}>
          <NovaMark title="Written by Nova from your answers" />
          <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text)', whiteSpace: 'pre-wrap', maxWidth: 720 }}>{text}</div>
        </Card>
      </Page>
    );
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const next = async () => {
    await saveAnswer(active.id, q.key, draft);
    if (!isLast) { setStep(step + 1); return; }
    setGenerating(true);
    setGenError('');
    try {
      const out = await generate({ ...active.answers, [q.key]: draft });
      await complete(active.id, out);
    } catch {
      setGenError(ai === false ? 'Your answers are saved. Nova writes this once AI is connected.' : "Nova couldn't write this. Try again in a moment.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Page title={itemLabel(active)} sub={`${title} · step ${step + 1} of ${questions.length}`}>
      <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setActiveId(null)}>‹ All</button>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', maxWidth: 720 }}><div style={{ width: `${((step + 1) / questions.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 24, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
        {q.phase && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{q.phase}</span>{q.priority && <Chip k={/crit/i.test(q.priority) ? 'warn' : 'neutral'}>{q.priority[0].toUpperCase() + q.priority.slice(1).toLowerCase()}</Chip>}</div>}
        <span style={{ color: 'var(--text)', fontSize: phone ? 19 : 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.3 }}>{q.prompt}</span>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus style={{ ...area, height: 140, fontSize: 16 }} />
        {q.insight && (
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{q.insight}</span>
            {q.study && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Study: {q.study}</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {step > 0 && <button className="mm-btn" style={{ height: 44 }} disabled={generating} onClick={async () => { await saveAnswer(active.id, q.key, draft); setStep(step - 1); }}>Back</button>}
          <button className="mm-btn mm-btn--primary" style={{ height: 44, minWidth: 120 }} disabled={generating} onClick={() => void next()}>{isLast ? (generating ? 'Writing…' : 'Finish') : 'Next'}</button>
          {genError && <span style={{ fontSize: 13, color: ai === false ? 'var(--text-secondary)' : 'var(--danger)' }}>{genError}</span>}
        </div>
      </section>
    </Page>
  );
}
