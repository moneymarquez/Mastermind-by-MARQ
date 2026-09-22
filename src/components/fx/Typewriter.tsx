import { useEffect, useState } from 'react';
import { useSkin } from '../../data/useTheme';
import { prefersReducedMotion } from '../../lib/motion';

/** Terminal-style typing for AI replies, Cyberpunk only.
 *
 *  Only the NEWEST assistant message types out (`live`); older ones render
 *  whole, so reopening the panel doesn't re-type the whole history. Fast —
 *  ~600 chars/sec — so a long answer never becomes a wait. Tapping the
 *  bubble finishes it instantly. Simple and reduced-motion: plain text. */
export default function Typewriter({ text, live }: { text: string; live: boolean }) {
  const skin = useSkin();
  const animate = live && skin === 'cyberpunk' && !prefersReducedMotion();
  const [n, setN] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 120)); // ~120 frames max
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, 12);
    return () => window.clearInterval(id);
  }, [text, animate]);

  const done = n >= text.length;
  return (
    <span className={animate && !done ? 'fx-caret' : undefined} onClick={() => setN(text.length)} style={{ whiteSpace: 'pre-wrap' }}>
      {text.slice(0, n)}
    </span>
  );
}
