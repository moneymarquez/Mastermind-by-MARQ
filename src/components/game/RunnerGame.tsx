import { useEffect, useRef, useState } from 'react';
import { W, H, GROUND, PLAYER_X, PLAYER, newGame, step, jump, readHi, saveHi } from './runnerLogic';
import type { Game, Obstacle } from './runnerLogic';

/** A little endless runner for the error screen. Original: the Masterminds "M" bot
 *  jumps over bugs, error boxes, spinners and a stray null. Canvas only, themed from
 *  CSS tokens, paused when the tab is hidden, and it never starts on its own when
 *  the person asked for reduced motion. */
export default function RunnerGame() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>(reduced ? 'idle' : 'run');
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState(readHi);
  const g = useRef<Game>(newGame());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const act = () => {
    if (phaseRef.current === 'run') jump(g.current);
    else { g.current = newGame(); setScore(0); setPhase('run'); }
  };

  useEffect(() => {
    const cv = ref.current; const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    const css = getComputedStyle(cv);
    const tok = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
    let raf = 0, last = 0, lastScore = -1;
    const draw = () => {
      const ink = tok('--text', '#111'), accent = tok('--accent', '#5266eb'), mute = tok('--text-tertiary', '#888');
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = mute; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
      const s = g.current;
      // The bot: an accent block with an "M" and little legs.
      ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(PLAYER_X, s.y, PLAYER.w, PLAYER.h - 4, 6); ctx.fill();
      ctx.fillStyle = ink; const leg = onGroundLeg(s);
      ctx.fillRect(PLAYER_X + 5, s.y + PLAYER.h - 4, 5, 4 + leg); ctx.fillRect(PLAYER_X + PLAYER.w - 10, s.y + PLAYER.h - 4, 5, 4 - leg);
      ctx.fillStyle = tok('--on-accent', '#fff'); ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', PLAYER_X + PLAYER.w / 2, s.y + 12);
      s.obstacles.forEach((o) => drawObstacle(ctx, o, ink, accent, s.t));
      ctx.fillStyle = mute; ctx.font = '600 13px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`HI ${String(hiRef.current).padStart(5, '0')}  ${String(s.score).padStart(5, '0')}`, W - 8, 8);
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? (t - last) / 1000 : 0; last = t;
      if (phaseRef.current === 'run') {
        step(g.current, dt);
        if (g.current.score !== lastScore) { lastScore = g.current.score; setScore(lastScore); }
        if (g.current.over) { const sc = g.current.score; if (sc > hiRef.current) { hiRef.current = sc; saveHi(sc); setHi(sc); } setPhase('over'); }
      }
      draw();
    };
    const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } };
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', vis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const hiRef = useRef(hi);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); act(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 'var(--text-caption, 12px)', color: 'var(--text-tertiary)', marginBottom: 6 }}>Play while it fixes itself</div>
      <div onPointerDown={(e) => { e.preventDefault(); act(); }} role="button" aria-label="Game: tap to jump" tabIndex={0}
        style={{ position: 'relative', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', border: '1px solid var(--border, #ddd)', borderRadius: 'var(--radius-md, 10px)', background: 'var(--surface-2, transparent)', overflow: 'hidden' }}>
        <canvas ref={ref} style={{ width: '100%', aspectRatio: `${W} / ${H}`, display: 'block' }} />
        {phase !== 'run' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, background: 'color-mix(in srgb, var(--bg, #fff) 70%, transparent)', color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
            {phase === 'over' ? <><span>Bug hit you · score {score}</span><span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>Tap to play again</span></> : <span>Tap to play</span>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Tap, click, space or ↑ to jump</div>
    </div>
  );
}
const onGroundLeg = (s: Game) => (s.y >= GROUND - PLAYER.h - 0.5 ? (Math.floor(s.t * 10) % 2 ? 1 : -1) : 0);

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, ink: string, accent: string, t: number) {
  const y = GROUND - o.h;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 2;
  if (o.kind === 'bug') {
    ctx.beginPath(); ctx.ellipse(o.x + 11, y + 12, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); for (const dx of [-6, 0, 6]) { ctx.moveTo(o.x + 11 + dx, y + 8); ctx.lineTo(o.x + 11 + dx - 3, y + 2); ctx.moveTo(o.x + 11 + dx, y + 16); ctx.lineTo(o.x + 11 + dx - 3, y + 21); } ctx.stroke();
  } else if (o.kind === 'box') {
    ctx.strokeRect(o.x + 1, y + 1, o.w - 2, o.h - 2); ctx.fillStyle = accent; ctx.font = '700 16px system-ui'; ctx.fillText('!', o.x + o.w / 2, y + o.h / 2 + 1);
  } else if (o.kind === 'spinner') {
    ctx.beginPath(); ctx.arc(o.x + 12, y + 12, 9, t * 6, t * 6 + Math.PI * 1.5); ctx.stroke();
  } else {
    ctx.font = '600 14px ui-monospace, monospace'; ctx.fillText('null', o.x + o.w / 2, y + o.h / 2);
  }
}
