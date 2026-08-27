import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AnswerConfidence, AuditQuestion } from '../../data/types';

interface Props {
  businessName: string;
  questions: AuditQuestion[];
  auditId: string;
  initialAnswers: Record<string, string>;
  initialConfidence: Record<string, AnswerConfidence>;
  saveAnswers: (auditId: string, answers: Record<string, string>) => Promise<void>;
  saveConfidence: (auditId: string, confidence: Record<string, AnswerConfidence>, quiet?: boolean) => Promise<void>;
  onExit: () => void;
}

const shell: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg)',
  display: 'flex', flexDirection: 'column', padding: 'env(safe-area-inset-top) 0 env(safe-area-inset-bottom)',
};
const bigInput: CSSProperties = {
  width: '100%', flex: 1, minHeight: 160, background: 'var(--surface-4)', border: '1px solid var(--border-2)',
  borderRadius: 'var(--radius-xl)', padding: '18px 20px', color: 'var(--text)', fontSize: 19, lineHeight: 1.55,
  outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const navBtn = (primary: boolean): CSSProperties => ({
  padding: '15px 26px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-subhead)', fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--border-2)',
  background: primary ? 'var(--text)' : 'transparent',
  color: primary ? 'var(--bg)' : 'var(--text-secondary)',
  userSelect: 'none', textAlign: 'center',
});

/** Part 1c — live capture. Built for holding a phone or iPad during an
 *  actual discovery call: one question at a time, a field big enough to
 *  type into without aiming, and an autosave on every pause rather than
 *  only on submit. A dropped call or a backgrounded app loses at most the
 *  last ~600ms of typing, never the whole session. */
export default function LiveCaptureView({
  businessName, questions, auditId, initialAnswers, initialConfidence,
  saveAnswers, saveConfidence, onExit,
}: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [confidence, setConfidence] = useState<Record<string, AnswerConfidence>>(initialConfidence);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  latest.current = answers;

  const q = questions[step];
  const isLast = step === questions.length - 1;

  // Debounced per-field autosave. The ref holds the newest answers so a
  // flush that fires mid-typing writes current state, not the closure's.
  const queueSave = (next: Record<string, string>) => {
    setAnswers(next);
    latest.current = next;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveAnswers(auditId, latest.current);
      setSaveState('saved');
    }, 600);
  };

  // Flush on unmount and whenever the app is backgrounded — on iOS a
  // swipe away or an incoming call can suspend the page before a pending
  // debounce fires, which is exactly the case this mode exists to survive.
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      saveAnswers(auditId, latest.current);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [auditId, saveAnswers]);

  // Focus the field on every question change so he can keep typing
  // without reaching for the screen between questions.
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const go = async (delta: number) => {
    if (timer.current) clearTimeout(timer.current);
    await saveAnswers(auditId, latest.current);
    setSaveState('saved');
    setStep((s) => Math.min(Math.max(s + delta, 0), questions.length - 1));
  };

  const setTag = (tag: AnswerConfidence) => {
    const next = { ...confidence };
    if (next[q.key] === tag) delete next[q.key];
    else next[q.key] = tag;
    setConfidence(next);
    saveConfidence(auditId, next, true);
  };

  if (!q) {
    return (
      <div style={shell}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 'var(--text-head)', color: 'var(--text-secondary)' }}>No active questions in the bank.</div>
          <div style={{ ...navBtn(true), marginTop: 16, display: 'inline-block' }} onClick={onExit}>Close</div>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{businessName}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {step + 1} of {questions.length} · {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Autosaves as you type'}
          </div>
        </div>
        <div style={{ ...navBtn(false), padding: '10px 18px', fontSize: 'var(--text-body-lg)', flexShrink: 0 }} onClick={onExit}>Done</div>
      </div>

      <div style={{ height: 3, background: 'var(--border)', margin: '0 20px', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((step + 1) / questions.length) * 100}%`, background: 'var(--text)', transition: 'width 200ms ease' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 20px 0', minHeight: 0 }}>
        <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{q.category}</div>
        <div style={{ fontSize: 23, fontWeight: 600, color: 'var(--text)', margin: '10px 0 16px', lineHeight: 1.35 }}>{q.prompt}</div>

        <textarea
          ref={inputRef}
          style={bigInput}
          value={answers[q.key] ?? ''}
          placeholder="Type what they say…"
          onChange={(e) => queueSave({ ...answers, [q.key]: e.target.value })}
        />

        {/* The "do you know that for sure, or is that a rough guess?"
            probe, captured at the moment it's asked. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Is that number solid?</span>
          {(['confirmed', 'estimated'] as AnswerConfidence[]).map((tag) => (
            <div
              key={tag}
              onClick={() => setTag(tag)}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                border: `1px solid ${confidence[q.key] === tag ? 'transparent' : 'var(--border-2)'}`,
                background: confidence[q.key] === tag ? (tag === 'confirmed' ? 'var(--success)' : 'var(--warning)') : 'transparent',
                color: confidence[q.key] === tag ? '#0A0B0D' : 'var(--text-secondary)',
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {q.helper_text && (
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 12, fontStyle: 'italic', lineHeight: 1.5 }}>{q.helper_text}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px 20px 22px' }}>
        <div style={{ ...navBtn(false), flex: '0 0 auto', opacity: step === 0 ? 0.4 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }} onClick={() => go(-1)}>Back</div>
        <div style={{ ...navBtn(true), flex: 1 }} onClick={() => (isLast ? onExit() : go(1))}>{isLast ? 'Finish' : 'Next'}</div>
      </div>
    </div>
  );
}
