import type { ChangeEvent, KeyboardEvent } from 'react';
import type { NovaMessage } from '../types';
import Icon from '../Icon';
import { isSpeechRecognitionSupported } from '../lib/speech';

const SPACING = 20;

interface Props {
  isMobile: boolean;
  /** Extra bottom offset (px) to stack above RemindersBox on mobile when
   *  they'd otherwise collide side by side. 0 on desktop, where they sit in
   *  opposite corners with room to spare. */
  stackBottomOffset: number;
  /** On mobile, Nova aligns to RemindersBox's actual left edge instead of
   *  the default corner spacing, per the "same left edge" stacking spec.
   *  null on desktop, where Nova keeps its own bottom-left corner. */
  stackLeft: number | null;
  assistantName: string;
  messages: NovaMessage[];
  input: string;
  thinking: boolean;
  listening: boolean;
  onClose: (e: React.SyntheticEvent) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onMicClick: () => void;
}

export default function NovaPanel({
  isMobile, stackBottomOffset, stackLeft, assistantName, messages, input, thinking, listening,
  onClose, onInputChange, onKeyDown, onSend, onMicClick,
}: Props) {
  const micSupported = isSpeechRecognitionSupported();
  return (
    <div
      style={{
        // Fixed to Stage's bottom-left corner — no longer anchored to the
        // draggable trigger circle's position. `env(safe-area-inset-*)` keeps
        // it clear of notches/home indicators when running as an installed PWA.
        position: 'absolute',
        left: stackLeft != null ? stackLeft : `calc(${SPACING}px + env(safe-area-inset-left))`,
        bottom: `calc(${SPACING + stackBottomOffset}px + env(safe-area-inset-bottom))`,
        width: isMobile ? 270 : 320, height: isMobile ? 330 : 400,
        background: '#101114', border: '1px solid #22262B', borderRadius: 16, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'bubbleFade 0.18s ease', zIndex: 45, overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1c1e23', fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Icon name="sparkle" style={{ marginRight: 8 }} color="#F5F6F7" />
          {assistantName}
        </div>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', padding: 4 }} onClick={onClose}>
          <Icon name="x" color="#565b64" />
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start',
              background: msg.from === 'user' ? '#F5F6F7' : '#1a1c21',
              color: msg.from === 'user' ? '#0A0B0D' : '#e9e9ed',
              padding: '9px 13px', borderRadius: 14, fontSize: 13, maxWidth: '85%', lineHeight: 1.4,
            }}
          >
            {msg.text}
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', background: '#1a1c21', color: '#8A8F98', padding: '9px 13px', borderRadius: 14, fontSize: 13 }}>
            …
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #1c1e23' }}>
        <input
          style={{ flex: 1, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 999, padding: '9px 14px', color: '#F5F6F7', fontSize: 13, outline: 'none' }}
          placeholder={listening ? 'Listening…' : `Talk to ${assistantName}...`}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
        />
        {micSupported && (
          <div
            title={listening ? 'Stop listening' : 'Speak instead of typing'}
            style={{
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              background: listening ? '#c47a7a' : 'transparent',
              border: listening ? 'none' : '1px solid #2b2f36',
              animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
            onClick={onMicClick}
          >
            <Icon name="microphone" color={listening ? '#F5F6F7' : '#8A8F98'} size={16} />
          </div>
        )}
        <div
          style={{ width: 34, height: 34, borderRadius: '50%', background: '#F5F6F7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A0B0D', cursor: 'pointer', flexShrink: 0 }}
          onClick={onSend}
        >
          <Icon name="arrow-up" color="#0A0B0D" />
        </div>
      </div>
    </div>
  );
}
