import type { ChangeEvent, KeyboardEvent, PointerEvent } from 'react';
import type { NovaMessage, Point } from '../types';
import Icon from '../Icon';

interface Props {
  isMobile: boolean;
  pos: Point;
  messages: NovaMessage[];
  input: string;
  thinking: boolean;
  onClose: (e: React.SyntheticEvent) => void;
  onDragPointerDown: (e: PointerEvent) => void;
  onDragPointerMove: (e: PointerEvent) => void;
  onDragPointerUp: () => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
}

export default function NovaPanel({
  isMobile, pos, messages, input, thinking, onClose, onDragPointerDown, onDragPointerMove, onDragPointerUp, onInputChange, onKeyDown, onSend,
}: Props) {
  return (
    <div
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: isMobile ? 270 : 320, height: isMobile ? 330 : 400,
        background: '#101114', border: '1px solid #22262B', borderRadius: 16, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'bubbleFade 0.18s ease', zIndex: 45, overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1c1e23', fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'grab', touchAction: 'none' }}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
        >
          <Icon name="sparkle" style={{ marginRight: 8 }} color="#F5F6F7" />
          Nova
        </div>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', padding: 4, zIndex: 2, position: 'relative' }} onClick={onClose}>
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
          placeholder="Talk to Nova..."
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
        />
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
