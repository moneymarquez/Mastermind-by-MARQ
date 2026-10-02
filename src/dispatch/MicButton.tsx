import { useEffect, useRef, useState } from 'react';
import { useCapture, startCapture, stopCapture, lockCapture } from './capture';
import { MicIcon, StopIcon } from './bits';

// Hold to talk; a quick tap locks it hands-free, tap again to stop
// (spec 15 §2.1). Keyboard: hold Space to talk, Enter toggles the lock.
// Screen readers: double-tap activates = lock/stop (§5).

const TAP_MS = 350;

export function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!startedAt) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [startedAt]);
  if (!startedAt) return '';
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function MicButton({ size = 'lg', variant = 'round', label }: { size?: 'lg' | 'sm'; variant?: 'round' | 'pill'; label?: string }) {
  const c = useCapture();
  const downAt = useRef(0);
  const pressed = useRef(false);
  const busy = c.phase === 'transcribing' || c.phase === 'extracting';
  const rec = c.phase === 'recording';
  const state = rec ? 'recording' : c.phase === 'countdown' ? 'countdown' : 'idle';

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || busy) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pressed.current = true;
    if (rec || c.phase === 'countdown') { void stopCapture(); pressed.current = false; return; }
    downAt.current = Date.now();
    void startCapture();
  };
  const onUp = () => {
    if (!pressed.current) return;
    pressed.current = false;
    if (Date.now() - downAt.current < TAP_MS) lockCapture();
    else void stopCapture();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !e.repeat) { e.preventDefault(); if (rec) { void stopCapture(); return; } downAt.current = Date.now(); pressed.current = true; void startCapture(); }
  };
  const onKeyUp = (e: React.KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); onUp(); } };
  // Click with no pointer (Enter, assistive tech): toggle a locked session.
  const onClick = (e: React.MouseEvent) => {
    if (e.detail !== 0 || busy) return;
    if (rec || c.phase === 'countdown') void stopCapture(); else void startCapture({ locked: true });
  };

  const aria = rec ? (c.locked ? 'Recording, locked. Activate to stop.' : 'Recording. Release to stop.') : 'Hold to talk. Double-tap to lock.';
  const common = {
    type: 'button' as const, 'data-state': state, 'aria-label': aria, 'aria-pressed': rec, disabled: busy,
    onPointerDown: onDown, onPointerUp: onUp, onPointerCancel: onUp, onKeyDown, onKeyUp, onClick,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  if (variant === 'pill') {
    return (
      <button {...common} className="dp-holdpill">
        <span className="dot" style={{ transform: rec ? `scale(${1 + c.level * 0.25})` : undefined }}>{rec ? <StopIcon /> : <span style={{ width: 22, height: 22, display: 'inline-flex' }}><MicIcon /></span>}</span>
        {rec ? (c.locked ? 'Tap to stop' : 'Release to stop') : label ?? 'Hold to talk'}
      </button>
    );
  }

  const R = size === 'lg' ? 78 : 42; const W = size === 'lg' ? 168 : 92;
  const square = false;
  const perimeter = square ? 8 * R : 2 * Math.PI * R;
  const ring = (p: React.SVGProps<SVGCircleElement & SVGRectElement>) => square
    ? <rect x={W / 2 - R} y={W / 2 - R} width={2 * R} height={2 * R} fill="none" {...(p as React.SVGProps<SVGRectElement>)} />
    : <circle cx={W / 2} cy={W / 2} r={R} fill="none" transform={`rotate(-90 ${W / 2} ${W / 2})`} {...(p as React.SVGProps<SVGCircleElement>)} />;
  return (
    <div className={`dp-micwrap${size === 'sm' ? ' sm' : ''}`}>
      <svg className="dp-ring" viewBox={`0 0 ${W} ${W}`} aria-hidden="true">
        {ring({ stroke: 'var(--mm-line)', strokeWidth: 4 })}
        {rec && ring({ stroke: 'var(--dp-p1)', strokeWidth: 5, strokeLinecap: square ? 'butt' : 'round', strokeDasharray: perimeter, strokeDashoffset: perimeter * (1 - Math.min(1, 0.06 + c.level)) })}
      </svg>
      <button {...common} className="dp-mic">
        {c.phase === 'countdown' ? c.countdown : rec ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  );
}
