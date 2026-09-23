import { useEffect, useRef, useState } from 'react';
import type { Pace } from '../../lib/dialClock';

/** Thirty-five ticks, one per call — the signature element. Not a
 *  progress bar: each mark is a specific call, 4px wide, 2px apart. A
 *  newly lit tick flashes white for 200ms then settles. Lit colour
 *  follows pace: green on pace, amber behind; after a closed hour the
 *  unlit ticks take a 1px magenta edge. */
export default function TickBar({ total, lit, pace, height = 22 }: { total: number; lit: number; pace: Pace; height?: number }) {
  const count = Math.max(1, Math.round(total));
  const on = Math.max(0, Math.min(count, Math.round(lit)));
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    if (prev.current !== null && on > prev.current) {
      setFlash(on - 1);
      const t = window.setTimeout(() => setFlash(null), 240);
      prev.current = on;
      return () => window.clearTimeout(t);
    }
    prev.current = on;
  }, [on]);

  return (
    <div className="cp-ticks" data-pace={pace} role="img" aria-label={`${on} of ${count} calls`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`cp-tick${flash === i ? ' cp-flash' : ''}`} data-lit={i < on ? 'true' : 'false'} style={{ height }} />
      ))}
    </div>
  );
}
