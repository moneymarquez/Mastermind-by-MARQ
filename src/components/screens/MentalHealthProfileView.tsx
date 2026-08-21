import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMentalHealthProfile } from '../../data/useMentalHealthProfile';
import { MENTAL_HEALTH_PROFILE, TOTAL_PROFILE_QUESTIONS } from '../../data/mentalHealthQuestions';

interface Props {
  profile: ReturnType<typeof useMentalHealthProfile>;
}

const textareaStyle: CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
  color: 'var(--text)', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit', minHeight: 56,
};

function categoryCompletion(catId: string, answers: Record<string, string>): { done: number; total: number } {
  const cat = MENTAL_HEALTH_PROFILE.find((c) => c.id === catId)!;
  const done = cat.questions.filter((q) => answers[q.key]?.trim()).length;
  return { done, total: cat.questions.length };
}

export default function MentalHealthProfileView({ profile }: Props) {
  const { answers, completedAt, answeredCount, loading, saveAnswers } = profile;
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const openFor = (catId: string) => {
    const cat = MENTAL_HEALTH_PROFILE.find((c) => c.id === catId)!;
    const initial: Record<string, string> = {};
    for (const q of cat.questions) initial[q.key] = answers[q.key] ?? '';
    setDrafts(initial);
    setOpenCategory(catId);
  };

  const saveCategory = async () => {
    await saveAnswers(drafts);
    setOpenCategory(null);
  };

  if (loading) return null;

  if (openCategory) {
    const cat = MENTAL_HEALTH_PROFILE.find((c) => c.id === openCategory)!;
    return (
      <div style={{ marginTop: 20, maxWidth: 560 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{cat.label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {cat.questions.map((q) => (
            <div key={q.key}>
              <div style={{ fontSize: 13, color: 'var(--text-quaternary)', marginBottom: 6, lineHeight: 1.4 }}>{q.prompt}</div>
              <textarea
                style={textareaStyle}
                value={drafts[q.key] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [q.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <div style={{ padding: '10px 16px', borderRadius: 999, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }} onClick={() => setOpenCategory(null)}>Cancel</div>
          <div style={{ padding: '10px 24px', borderRadius: 999, background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={saveCategory}>
            Save & back
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, maxWidth: 560 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        A real profile of who you are — personality, stress patterns, what drains/recharges you, communication
        style, history, triggers, coping mechanisms, goals, relationships — so day-to-day check-ins land accurately
        instead of generically. Fill it in over as many sessions as you want; nothing here is one-and-done.
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (answeredCount / TOTAL_PROFILE_QUESTIONS) * 100)}%`, height: '100%', background: 'var(--text)' }} />
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{answeredCount} / {TOTAL_PROFILE_QUESTIONS}</span>
      </div>
      {completedAt && <div style={{ fontSize: 11.5, color: '#4CAF7D', marginTop: 6 }}>Complete — edit any section anytime.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {MENTAL_HEALTH_PROFILE.map((cat) => {
          const { done, total } = categoryCompletion(cat.id, answers);
          return (
            <div
              key={cat.id}
              onClick={() => openFor(cat.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{cat.label}</span>
              <span style={{ fontSize: 11.5, color: done === total ? '#4CAF7D' : 'var(--text-tertiary)' }}>{done}/{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
