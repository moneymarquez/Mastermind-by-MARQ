import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useMentalHealth } from '../../data/useMentalHealth';
import { useMentalHealthProfile } from '../../data/useMentalHealthProfile';
import { MENTAL_HEALTH_PROFILE } from '../../data/mentalHealthQuestions';
import type { BenderSession, Mood } from '../../data/types';
import { askClaude } from '../../lib/ai';
import MentalHealthProfileView from './MentalHealthProfileView';
import CrisisResourceBanner from '../CrisisResourceBanner';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  activeBender: BenderSession | null;
}

// Condenses the profile into Q&A lines for the prompt — only answered
// questions, so an in-progress profile still contributes what's there
// instead of waiting for all ~50 to be filled.
function profileContext(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const cat of MENTAL_HEALTH_PROFILE) {
    for (const q of cat.questions) {
      const a = answers[q.key];
      if (a?.trim()) lines.push(`${q.prompt} — ${a.trim()}`);
    }
  }
  if (lines.length === 0) return '';
  return `\n\nWhat you know about him from his profile (use this to make your response land accurately, not generically — don't quote it back verbatim):\n${lines.join('\n')}`;
}

async function reflectOnCheckin(mood: Mood, note: string, activeBender: BenderSession | null, profileAnswers: Record<string, string>): Promise<string> {
  const benderContext = activeBender
    ? `\n\nContext: a bender has been active since ${new Date(activeBender.started_at).toLocaleDateString()}${activeBender.description ? ` (${activeBender.description})` : ''}. Read his mood/energy in that context — don't treat lower energy or a rough mood as unusual or alarming right now, and don't bring up the bender itself unprompted unless it's clearly relevant to what he wrote.`
    : '';
  return askClaude({
    system:
      "You are Nova, a warm, grounded presence inside Cristopher's mental health check-in tracker. He just logged " +
      "how he's feeling. Respond with a short, genuine reflection — not therapy, not a script, just something a " +
      "thoughtful friend who knows him would say. If the mood is rough or bad, take it seriously and offer one " +
      'small, concrete thing that might help right now. Plain text, 2-3 sentences. ' +
      'If anything in what he wrote suggests he may be in crisis or thinking about harming himself, set the rest ' +
      'of this aside: say so directly, and give him the 988 Suicide & Crisis Lifeline (call or text 988) and the ' +
      "Crisis Text Line (text HOME to 741741) in your reply — don't bury it, don't just imply support. This " +
      'takes priority over everything else in this prompt.' +
      benderContext +
      profileContext(profileAnswers),
    messages: [{ role: 'user', content: `Mood: ${mood}${note ? `\nNote: ${note}` : ''}` }],
    maxTokens: 250,
  });
}

const MOODS: { key: Mood; label: string }[] = [
  { key: 'great', label: 'Great' },
  { key: 'good', label: 'Good' },
  { key: 'okay', label: 'Okay' },
  { key: 'rough', label: 'Rough' },
  { key: 'bad', label: 'Bad' },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function MentalHealthScreen({ homeHeadStyle, homeSubStyle, activeBender }: Props) {
  const { checkins, loading, addCheckin, saveInsight } = useMentalHealth();
  const profile = useMentalHealthProfile();
  const [tab, setTab] = useState<'checkin' | 'profile'>('checkin');
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [thinking, setThinking] = useState(false);

  const submit = async () => {
    if (!mood) return;
    const savedMood = mood;
    const savedNote = note;
    const inserted = await addCheckin(savedMood, savedNote);
    setMood(null);
    setNote('');
    if (inserted) {
      setThinking(true);
      try {
        const insight = await reflectOnCheckin(savedMood, savedNote, activeBender, profile.answers);
        await saveInsight(inserted.id, insight);
      } catch {
        // Silent — the check-in itself already saved; the reflection is a bonus.
      } finally {
        setThinking(false);
      }
    }
  };

  return (
    <div>
      <div style={homeHeadStyle}>Mental Health</div>
      <div style={homeSubStyle}>Check in whenever — it's just for you.</div>
      <CrisisResourceBanner />

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 600, border: `1px solid ${tab === 'checkin' ? 'var(--text)' : 'var(--border)'}`, color: tab === 'checkin' ? 'var(--text)' : 'var(--text-tertiary)' }}
          onClick={() => setTab('checkin')}
        >
          Check-in
        </div>
        <div
          style={{ padding: '9px 18px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 600, border: `1px solid ${tab === 'profile' ? 'var(--text)' : 'var(--border)'}`, color: tab === 'profile' ? 'var(--text)' : 'var(--text-tertiary)' }}
          onClick={() => setTab('profile')}
        >
          Profile {!profile.loading && `(${profile.answeredCount})`}
        </div>
      </div>

      {tab === 'profile' && <MentalHealthProfileView profile={profile} />}

      {tab === 'checkin' && (
      <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, marginTop: 24, maxWidth: 520 }}>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 10 }}>How are you feeling right now?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MOODS.map((m) => (
            <div
              key={m.key}
              onClick={() => setMood(m.key)}
              style={{
                padding: '9px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500,
                border: `1px solid ${mood === m.key ? 'var(--text)' : 'var(--border)'}`,
                background: mood === m.key ? 'var(--text)' : 'transparent',
                color: mood === m.key ? 'var(--bg)' : 'var(--text-quaternary)',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's going on? (optional)"
          style={{ width: '100%', marginTop: 14, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none' }}
        />
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', marginTop: 14, padding: '10px 18px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--text)', color: mood ? 'var(--text)' : 'var(--text-tertiary)', fontSize: 'var(--text-body)', cursor: mood ? 'pointer' : 'default',
            opacity: mood ? 1 : 0.5,
          }}
          onClick={submit}
        >
          Log check-in
        </div>
        {thinking && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 10 }}>Nova is reflecting on that…</div>}
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', maxWidth: 520 }}>
        {checkins.map((c) => (
          <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{c.mood}</span>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
            </div>
            {c.note && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>{c.note}</div>}
            {c.ai_insight && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--surface-3)' }}>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{c.ai_insight}</div>
              </div>
            )}
          </div>
        ))}
        {!loading && checkins.length === 0 && (
          <div style={{ padding: '18px', fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No check-ins yet.</div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
