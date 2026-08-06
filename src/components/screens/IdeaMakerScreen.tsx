import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useIdeaMaker } from '../../data/useIdeaMaker';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const inputStyle: CSSProperties = {
  flex: 1, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 999, padding: '10px 16px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

export default function IdeaMakerScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { sessions, messages, activeSessionId, setActiveSessionId, loading, thinking, startSession, sendMessage } = useIdeaMaker();
  const [ideaInput, setIdeaInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  if (!activeSessionId) {
    return (
      <div>
        <div style={homeHeadStyle}>Idea Maker</div>
        <div style={homeSubStyle}>Drop a raw idea — Nova takes a first pass, then digs in with you.</div>
        <div style={{ fontSize: 12, color: '#565b64', marginTop: 14, maxWidth: 560, lineHeight: 1.5 }}>
          Real Nova, pressure-testing your idea back and forth — not a script.
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

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 640 }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{ padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114', cursor: 'pointer', fontSize: 13.5, color: '#C7CAD1' }}
            >
              {s.idea_text}
            </div>
          ))}
          {!loading && sessions.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>No ideas explored yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: '#8A8F98', cursor: 'pointer', marginBottom: 18 }} onClick={() => setActiveSessionId(null)}>
        ← New idea
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, marginBottom: 18 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.from_role === 'user' ? 'flex-end' : 'flex-start',
              background: m.from_role === 'user' ? '#F5F6F7' : '#14161A',
              color: m.from_role === 'user' ? '#0A0B0D' : '#e9e9ed',
              border: m.from_role === 'nova' ? '1px solid #22262B' : 'none',
              padding: '12px 16px', borderRadius: 14, fontSize: 13.5, maxWidth: '85%', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}
          >
            {m.text}
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', background: '#14161A', border: '1px solid #22262B', color: '#8A8F98', padding: '12px 16px', borderRadius: 14, fontSize: 13.5 }}>
            …
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
        <input
          style={inputStyle}
          placeholder="Reply to Nova..."
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
