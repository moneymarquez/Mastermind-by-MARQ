import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { prefersReducedMotion } from '../../lib/motion';
import { onCelebrate } from '../../lib/fxEvents';

/** Confetti, for the one moment worth being loud about: a closed client.
 *
 *  Imperative — call celebrate() (lib/fxEvents) where the deal closes; the
 *  mounted <Celebration /> host fires. Kept rare on purpose; a burst on
 *  every routine entry is what makes celebrations stop landing. */
const COLORS = ['var(--success)', 'var(--accent)', 'var(--warning)', 'var(--text)', 'var(--danger)'];

export default function Celebration() {
  const [burst, setBurst] = useState(0);
  useEffect(() => onCelebrate(() => setBurst((b) => b + 1)), []);
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(0), 1700);
    return () => window.clearTimeout(t);
  }, [burst]);

  if (!burst || prefersReducedMotion()) return null;
  // Deterministic scatter so a re-render mid-burst doesn't reshuffle.
  const pieces = Array.from({ length: 70 }, (_, i) => {
    const angle = (i / 70) * Math.PI * 2 + (i % 3) * 0.3;
    const dist = 140 + ((i * 37) % 160);
    return {
      cx: `${Math.cos(angle) * dist}px`,
      cy: `${Math.sin(angle) * dist * 0.6 + 260}px`,
      cr: `${((i * 97) % 720) + 360}deg`,
      cd: `${1100 + (i * 53) % 500}ms`,
      bg: COLORS[i % COLORS.length],
      delay: `${(i % 7) * 25}ms`,
    };
  });
  return (
    <div key={burst} aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="fx-confetti" style={{ background: p.bg, animationDelay: p.delay, '--cx': p.cx, '--cy': p.cy, '--cr': p.cr, '--cd': p.cd } as CSSProperties} />
      ))}
    </div>
  );
}
