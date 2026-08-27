import type { ChangeEvent, CSSProperties, KeyboardEvent } from 'react';
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

  // Mobile gets a real bottom sheet, fixed to the true viewport edges (not
  // absolute within Stage, which is what let it float over stat cards at
  // whatever scroll position the page happened to be at) and full-width
  // (not anchored to RemindersBox's narrow left edge, which is what pushed
  // a 270px-wide panel past the right edge of the screen). Desktop keeps
  // its original corner-stacked absolute positioning untouched.
  const panelStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0, right: 0, bottom: 0, width: '100%',
        height: 'min(72vh, 480px)',
        borderRadius: '20px 20px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.55)', animation: 'sheetSlideUp 0.2s ease', zIndex: 60, overflow: 'hidden',
      }
    : {
        // Fixed to Stage's bottom-left corner — no longer anchored to the
        // draggable trigger circle's position. `env(safe-area-inset-*)` keeps
        // it clear of notches/home indicators when running as an installed PWA.
        position: 'absolute',
        left: stackLeft != null ? stackLeft : `calc(${SPACING}px + env(safe-area-inset-left))`,
        bottom: `calc(${SPACING + stackBottomOffset}px + env(safe-area-inset-bottom))`,
        width: 320, height: 400,
        background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-2xl)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'bubbleFade 0.18s ease', zIndex: 45, overflow: 'hidden',
      };

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 59, animation: 'bubbleFade 0.18s ease' }}
        />
      )}
      <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--surface-3)', fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Icon name="sparkle" style={{ marginRight: 8 }} color="var(--text)" />
          {assistantName}
        </div>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', padding: 4 }} onClick={onClose}>
          <Icon name="x" color="var(--text-tertiary)" />
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start',
              background: msg.from === 'user' ? 'var(--text)' : 'var(--surface-4)',
              color: msg.from === 'user' ? 'var(--bg)' : '#e9e9ed',
              padding: '9px 13px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--text-body)', maxWidth: '85%', lineHeight: 1.4,
            }}
          >
            {msg.text}
          </div>
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--surface-4)', color: 'var(--text-secondary)', padding: '9px 13px', borderRadius: 'var(--radius-xl)', fontSize: 'var(--text-body)' }}>
            …
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--surface-3)' }}>
        <input
          style={{ flex: 1, background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-pill)', padding: '9px 14px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none' }}
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
              border: listening ? 'none' : '1px solid var(--border-2)',
              animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
            onClick={onMicClick}
          >
            <Icon name="microphone" color={listening ? 'var(--text)' : 'var(--text-secondary)'} size={16} />
          </div>
        )}
        <div
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', cursor: 'pointer', flexShrink: 0 }}
          onClick={onSend}
        >
          <Icon name="arrow-up" color="var(--bg)" />
        </div>
      </div>
      </div>
    </>
  );
}
