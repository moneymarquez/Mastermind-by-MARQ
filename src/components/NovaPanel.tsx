import type { ChangeEvent, CSSProperties, KeyboardEvent } from 'react';
import type { NovaMessage } from '../types';
import Icon from '../Icon';
import { isSpeechRecognitionSupported } from '../lib/speech';

const SPACING = 20;

interface Props {
  isMobile: boolean;
  /** Desktop only — the trigger circle's live position/size and the
   *  stage's dimensions, so the panel can anchor itself right next to
   *  wherever the (draggable) circle actually is instead of a fixed
   *  corner. null on mobile, which keeps its own full-width bottom sheet. */
  anchor: { cx: number; cy: number; circleSize: number; stageWidth: number; stageHeight: number } | null;
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

const PANEL_W = 320;
const PANEL_H = 400;

/** Where the panel sits relative to the (draggable) trigger circle:
 *  immediately to its left, top-aligned with it, clamped so it never runs
 *  off any edge of the stage — including flipping to the circle's RIGHT
 *  if it's been dragged too close to the left edge for the panel to fit. */
function anchoredPanelStyle(a: { cx: number; cy: number; circleSize: number; stageWidth: number; stageHeight: number }): CSSProperties {
  const gap = 14;
  const fitsLeft = a.cx - gap - PANEL_W >= 0;
  const left = fitsLeft ? a.cx - gap - PANEL_W : Math.min(a.cx + a.circleSize + gap, a.stageWidth - PANEL_W - SPACING);
  const top = Math.min(Math.max(a.cy, SPACING), a.stageHeight - PANEL_H - SPACING);
  return { left, top };
}

export default function NovaPanel({
  isMobile, anchor, assistantName, messages, input, thinking, listening,
  onClose, onInputChange, onKeyDown, onSend, onMicClick,
}: Props) {
  const micSupported = isSpeechRecognitionSupported();

  // Mobile gets a real bottom sheet, fixed to the true viewport edges (not
  // absolute within Stage, which is what let it float over stat cards at
  // whatever scroll position the page happened to be at) and full-width.
  // Desktop pops up right next to the trigger circle wherever it's been
  // dragged, rather than a fixed corner disconnected from it.
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
        position: 'absolute',
        ...(anchor ? anchoredPanelStyle(anchor) : { left: SPACING, top: SPACING }),
        width: PANEL_W, height: PANEL_H,
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
              background: listening ? 'var(--danger)' : 'transparent',
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
