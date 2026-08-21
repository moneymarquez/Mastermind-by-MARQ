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

const textareaStyle: CSSProperties = {
  width: '100%', minHeight: 96, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8,
  padding: '12px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
};

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

  const flagStyle: CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14, maxWidth: 560, lineHeight: 1.5 };

  if (!active) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={homeHeadStyle}>{title}</div>
              {badge && (
                <div style={{ padding: '3px 10px', borderRadius: 999, background: '#C9A24B22', border: '1px solid #C9A24B55', color: '#C9A24B', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  {badge}
                </div>
              )}
            </div>
            <div style={homeSubStyle}>{subtitle}</div>
          </div>
          <div style={primaryBtn} onClick={start}>+ {newLabel}</div>
        </div>
        <div style={flagStyle}>{flagNote}</div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              onClick={() => setActiveId(row.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{itemLabel(row)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {row.status === 'complete' ? 'Complete' : `In progress · step ${Object.keys(row.answers).length + 1} of ${questions.length}`}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }} onClick={(e) => { e.stopPropagation(); remove(row.id); }}>Delete</span>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>Nothing started yet.</div>
          )}
        </div>
      </div>
    );
  }

  const text = getText(active);
  if (active.status === 'complete' && text) {
    return (
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveId(null)}>
          ← Back to list
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, maxWidth: 680 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace" }}>{text}</div>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveId(null)}>
        ← Back to list
      </div>
      <div style={homeSubStyle}>Step {step + 1} of {questions.length}</div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, marginTop: 10, marginBottom: 24, maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((step + 1) / questions.length) * 100}%`, background: 'var(--text)' }} />
      </div>

      {q.phase && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{q.phase}</span>
          {q.priority && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px' }}>
              {q.priority}
            </span>
          )}
        </div>
      )}
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 14, maxWidth: 560 }}>{q.prompt}</div>
      <textarea style={{ ...textareaStyle, maxWidth: 560 }} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      {q.insight && (
        <div style={{ marginTop: 14, maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>{q.insight}</div>
          {q.study && <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 6 }}>Study: {q.study}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
        {step > 0 && (
          <div
            style={{ ...ghostBtn, pointerEvents: generating ? 'none' : 'auto', opacity: generating ? 0.5 : 1 }}
            onClick={async () => { await saveAnswer(active.id, q.key, draft); setStep(step - 1); }}
          >
            Back
          </div>
        )}
        <div
          style={{ ...primaryBtn, pointerEvents: generating ? 'none' : 'auto', opacity: generating ? 0.6 : 1 }}
          onClick={async () => {
            await saveAnswer(active.id, q.key, draft);
            if (isLast) {
              setGenerating(true);
              setGenError('');
              const merged = { ...active.answers, [q.key]: draft };
              try {
                const text = await generate(merged);
                await complete(active.id, text);
              } catch {
                setGenError("Nova couldn't generate this — try again in a moment.");
              } finally {
                setGenerating(false);
              }
            } else {
              setStep(step + 1);
            }
          }}
        >
          {isLast ? (generating ? 'Generating…' : 'Generate') : 'Next'}
        </div>
        {genError && <span style={{ fontSize: 12.5, color: '#c47a7a' }}>{genError}</span>}
      </div>
    </div>
  );
}
