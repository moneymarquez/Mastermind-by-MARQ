import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSobriety } from '../../data/useSobriety';
import type { useBender } from '../../data/useBender';
import { askClaude, AiError } from '../../lib/ai';
import { checkSobrietyPattern, explainDependencyVsModerateUse } from '../../lib/sobrietyIntelligence';
import type { SobrietyCheckin } from '../../data/types';
import BenderButton from '../BenderButton';
import { useNovaPreferences } from '../../data/useNovaPreferences';
import CrisisResourceBanner from '../CrisisResourceBanner';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  bender: ReturnType<typeof useBender>;
}

async function reflectOnSobriety(checkins: SobrietyCheckin[]): Promise<string> {
  const recent = checkins.slice(0, 10).map((c) => {
    const flags = [c.drank && 'drank', c.weed && 'weed', c.nicotine && 'nicotine'].filter(Boolean).join(', ');
    return `${c.checkin_date}: ${flags || 'nothing logged'}${c.note ? ` — "${c.note}"` : ''}`;
  }).join('\n');
  return askClaude({
    system:
      "You are Nova, a supportive but honest presence inside Cristopher's tracker. This is not a sobriety/abstinence " +
      'tool — the goal is harm reduction and feeling better, not quitting, so never moralize or push abstinence. ' +
      'Look at his recent history and give a short, genuine reflection — acknowledge what\'s actually happening, no ' +
      'generic platitudes. Plain text, 2-4 sentences. ' +
      'If anything in his notes suggests he may be in crisis or thinking about harming himself, set the rest of ' +
      'this aside: say so directly, and give him the 988 Suicide & Crisis Lifeline (call or text 988) and the ' +
      "Crisis Text Line (text HOME to 741741) in your reply — don't bury it, don't just imply support. This takes " +
      'priority over everything else in this prompt.',
    messages: [{ role: 'user', content: `Recent check-ins:\n${recent}` }],
    maxTokens: 300,
  });
}

const toggleStyle = (active: boolean): CSSProperties => ({
  flex: 1, textAlign: 'center', padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
  background: active ? 'var(--text)' : 'transparent',
  color: active ? 'var(--bg)' : 'var(--text-quaternary)',
  fontSize: 13, fontWeight: 600,
});
const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginTop: 24, maxWidth: 480 };
const linkStyle: CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' };

export default function SobrietyScreen({ homeHeadStyle, homeSubStyle, bender }: Props) {
  const { assistantName } = useNovaPreferences();
  const { checkins, todayCheckin, streak, loading, saveToday, saveInsight } = useSobriety();
  const [note, setNote] = useState(todayCheckin?.note ?? '');
  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState('');

  const [patternThinking, setPatternThinking] = useState(false);
  const [patternText, setPatternText] = useState('');
  const [patternError, setPatternError] = useState('');

  const [explainerThinking, setExplainerThinking] = useState(false);
  const [explainerText, setExplainerText] = useState('');

  const [journalDraft, setJournalDraft] = useState('');

  const getInsight = async () => {
    if (!todayCheckin) return;
    setThinking(true);
    setAiError('');
    try {
      const text = await reflectOnSobriety(checkins);
      await saveInsight(todayCheckin.id, text);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not get a reflection — try again.');
    } finally {
      setThinking(false);
    }
  };

  const runPatternCheck = async () => {
    setPatternThinking(true);
    setPatternError('');
    try {
      setPatternText(await checkSobrietyPattern(checkins));
    } catch (err) {
      setPatternError(err instanceof AiError ? err.message : 'Could not check patterns — try again.');
    } finally {
      setPatternThinking(false);
    }
  };

  const runExplainer = async () => {
    setExplainerThinking(true);
    try {
      setExplainerText(await explainDependencyVsModerateUse());
    } catch {
      setExplainerText('Could not load that explanation — try again.');
    } finally {
      setExplainerThinking(false);
    }
  };

  const submitJournal = async () => {
    if (!journalDraft.trim()) return;
    await bender.addJournalEntry(journalDraft.trim());
    setJournalDraft('');
  };

  const drank = todayCheckin?.drank ?? false;
  const weed = todayCheckin?.weed ?? false;
  const nicotine = todayCheckin?.nicotine ?? false;
  const heavy = todayCheckin?.heavy ?? false;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={homeHeadStyle}>Sobriety</div>
          <div style={homeSubStyle}>Drinking, weed, and nicotine — logged daily. Harm reduction, not abstinence.</div>
        </div>
        <BenderButton activeBender={bender.activeBender} onStart={bender.startBender} onEnd={bender.endBender} />
      </div>
      <CrisisResourceBanner />

      <div style={cardStyle}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 600, color: 'var(--text)' }}>
          {loading ? '—' : streak} <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>day{streak === 1 ? '' : 's'} clean</span>
        </div>

        {heavy && (
          <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #B7690C', color: '#B7690C', fontSize: 12.5 }}>
            Heavy day flagged — multiple substances logged today.
          </div>
        )}
        {bender.activeBender && (
          <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #B7690C', color: '#e0a35c', fontSize: 12.5 }}>
            Bender mode is active — tap the button above to check context or end it.
          </div>
        )}

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 20, marginBottom: 8 }}>Today</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={toggleStyle(drank)} onClick={() => saveToday({ drank: !drank })}>Drank</div>
          <div style={toggleStyle(weed)} onClick={() => saveToday({ weed: !weed })}>Weed</div>
          <div style={toggleStyle(nicotine)} onClick={() => saveToday({ nicotine: !nicotine })}>Nicotine</div>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => saveToday({ note: note || null })}
          placeholder="Note (optional)"
          style={{ width: '100%', marginTop: 12, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
              background: thinking || !todayCheckin ? 'var(--border)' : 'var(--text)', color: thinking || !todayCheckin ? 'var(--text-secondary)' : 'var(--bg)',
              fontSize: 12.5, fontWeight: 600, cursor: thinking || !todayCheckin ? 'default' : 'pointer',
            }}
            onClick={() => !thinking && todayCheckin && getInsight()}
          >
            {thinking ? 'Thinking…' : `✨ ${assistantName}'s take`}
          </div>
          <span style={linkStyle} onClick={() => !patternThinking && runPatternCheck()}>
            {patternThinking ? 'Checking…' : 'Check my patterns'}
          </span>
          <span style={linkStyle} onClick={() => !explainerThinking && runExplainer()}>
            {explainerThinking ? 'Loading…' : 'Dependency vs. moderate use?'}
          </span>
        </div>
        {aiError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}
        {todayCheckin?.ai_insight && (
          <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{todayCheckin.ai_insight}</div>
          </div>
        )}
        {patternError && <div style={{ fontSize: 12, color: '#c47a7a', marginTop: 8 }}>{patternError}</div>}
        {patternText && (
          <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{patternText}</div>
          </div>
        )}
        {explainerText && (
          <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{explainerText}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 480 }}>
        {checkins.slice(0, 14).map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-quaternary)' }}>{c.checkin_date}</span>
            <span style={{ fontSize: 12, color: c.drank || c.weed || c.nicotine ? '#B7690C' : 'var(--text-secondary)' }}>
              {c.drank || c.weed || c.nicotine
                ? [c.drank && 'Drank', c.weed && 'Weed', c.nicotine && 'Nicotine'].filter(Boolean).join(', ')
                : 'Nothing logged'}
            </span>
          </div>
        ))}
        {!loading && checkins.length === 0 && (
          <div style={{ padding: '18px', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No check-ins logged yet.</div>
        )}
      </div>

      <div style={{ marginTop: 28, fontSize: 14, fontWeight: 600, color: 'var(--text)', maxWidth: 480 }}>Journal</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 480 }}>
        Bender starts/stops log here automatically. Add anything else worth remembering.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 480 }}>
        <input
          value={journalDraft}
          onChange={(e) => setJournalDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitJournal()}
          placeholder="Add a journal note…"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
        />
        <div
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--text)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          onClick={submitJournal}
        >
          Add
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxWidth: 480 }}>
        {bender.journal.slice(0, 20).map((j) => (
          <div key={j.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-quaternary)' }}>{j.entry_text}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{j.entry_date}</div>
          </div>
        ))}
        {!bender.loading && bender.journal.length === 0 && (
          <div style={{ padding: '18px', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>Nothing in the journal yet.</div>
        )}
      </div>
    </div>
  );
}
