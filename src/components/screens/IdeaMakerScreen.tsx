import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useIdeaMaker } from '../../data/useIdeaMaker';
import { useNovaPreferences } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  flex: 1, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-pill)', padding: '10px 16px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 'var(--radius-pill)',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

export default function IdeaMakerScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { sessions, messages, activeSessionId, setActiveSessionId, loading, thinking, startSession, sendMessage } = useIdeaMaker();
  const { assistantName } = useNovaPreferences();
  const [ideaInput, setIdeaInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  if (!activeSessionId) {
    return (
      <div>
        <div style={homeHeadStyle}>Idea Maker</div>
        <div style={homeSubStyle}>Drop a raw idea — {assistantName} takes a first pass, then digs in with you.</div>
        <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 14, maxWidth: 560, lineHeight: 1.5 }}>
          Real {assistantName}, pressure-testing your idea back and forth — not a script.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, maxWidth: 640 }}>
          <input
            style={inputStyle}
            placeholder="What's the idea?"
            value={ideaInput}
            onChange={(e) => setIdeaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ideaInput.trim()) {
                startSession(ideaInput.trim());
                setIdeaInput('');
              }
            }}
          />
          <div
            style={primaryBtn}
            onClick={() => {
              if (!ideaInput.trim()) return;
              startSession(ideaInput.trim());
              setIdeaInput('');
            }}
          >
            Start
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', maxWidth: 640 }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{ padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)' }}
            >
              {s.idea_text}
            </div>
          ))}
          {!loading && sessions.length === 0 && (
            <div style={{ padding: 18, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No ideas explored yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-body)', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveSessionId(null)}>
        ← New idea
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginBottom: 18 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.from_role === 'user' ? 'flex-end' : 'flex-start',
              background: m.from_role === 'user' ? 'var(--text)' : 'var(--surface)',
              color: m.from_role === 'user' ? 'var(--bg)' : '#e9e9ed',
              border: m.from_role === 'nova' ? '1px solid var(--border)' : 'none',
              padding: '12px 16px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--text-body-lg)', maxWidth: '85%', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}
          >
            {m.text}
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--text-body-lg)' }}>
            …
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <input
          style={inputStyle}
          placeholder={`Reply to ${assistantName}...`}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && chatInput.trim() && !thinking) {
              sendMessage(chatInput.trim());
              setChatInput('');
            }
          }}
        />
        <div
          style={{ ...primaryBtn, opacity: thinking ? 0.6 : 1, pointerEvents: thinking ? 'none' : 'auto' }}
          onClick={() => {
            if (!chatInput.trim() || thinking) return;
            sendMessage(chatInput.trim());
            setChatInput('');
          }}
        >
          Send
        </div>
      </div>
    </div>
  );
}
