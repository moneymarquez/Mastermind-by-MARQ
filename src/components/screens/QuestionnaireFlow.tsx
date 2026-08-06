import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Question } from '../../data/scalingPlannerQuestions';
import type { QuestionnaireStatus } from '../../data/types';

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
  generate: (answers: Record<string, string>) => string;
  getText: (row: T) => string | null;
  itemLabel: (row: T) => string;
  newLabel: string;
}

const textareaStyle: CSSProperties = {
  width: '100%', minHeight: 96, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
  padding: '12px 14px', color: '#F5F6F7', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  border: '1px solid #22262B', color: '#8A8F98', fontSize: 13, cursor: 'pointer',
};

export default function QuestionnaireFlow<T extends Row>({
  homeHeadStyle, homeSubStyle, title, subtitle, flagNote, questions, rows, loading,
  active, activeId, setActiveId, start, saveAnswer, complete, remove, generate, getText, itemLabel, newLabel,
}: Props<T>) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setStep(0);
  }, [activeId]);

  useEffect(() => {
    if (active) setDraft(active.answers[questions[step]?.key] ?? '');
  }, [active, step, questions]);

  const flagStyle: CSSProperties = { fontSize: 12, color: '#565b64', marginTop: 14, maxWidth: 560, lineHeight: 1.5 };

  if (!active) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={homeHeadStyle}>{title}</div>
            <div style={homeSubStyle}>{subtitle}</div>
          </div>
          <div style={primaryBtn} onClick={start}>+ {newLabel}</div>
        </div>
        <div style={flagStyle}>{flagNote}</div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              onClick={() => setActiveId(row.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{itemLabel(row)}</div>
                <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 2 }}>
                  {row.status === 'complete' ? 'Complete' : `In progress · step ${Object.keys(row.answers).length + 1} of ${questions.length}`}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#565b64' }} onClick={(e) => { e.stopPropagation(); remove(row.id); }}>Delete</span>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>Nothing started yet.</div>
          )}
        </div>
      </div>
    );
  }

  const text = getText(active);
  if (active.status === 'complete' && text) {
    return (
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: '#8A8F98', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveId(null)}>
          ← Back to list
        </div>
        <div style={{ background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 28, maxWidth: 680 }}>
          <div style={{ fontSize: 13.5, color: '#F5F6F7', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace" }}>{text}</div>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: '#8A8F98', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveId(null)}>
        ← Back to list
      </div>
      <div style={homeSubStyle}>Step {step + 1} of {questions.length}</div>
      <div style={{ height: 4, background: '#22262B', borderRadius: 999, marginTop: 10, marginBottom: 24, maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((step + 1) / questions.length) * 100}%`, background: '#F5F6F7' }} />
      </div>

      <div style={{ fontSize: 20, fontWeight: 600, color: '#F5F6F7', marginBottom: 14, maxWidth: 560 }}>{q.prompt}</div>
      <textarea style={{ ...textareaStyle, maxWidth: 560 }} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        {step > 0 && (
          <div style={ghostBtn} onClick={async () => { await saveAnswer(active.id, q.key, draft); setStep(step - 1); }}>Back</div>
        )}
        <div
          style={primaryBtn}
          onClick={async () => {
            await saveAnswer(active.id, q.key, draft);
            if (isLast) {
              const merged = { ...active.answers, [q.key]: draft };
              await complete(active.id, generate(merged));
            } else {
              setStep(step + 1);
            }
          }}
        >
          {isLast ? 'Generate' : 'Next'}
        </div>
      </div>
    </div>
  );
}
