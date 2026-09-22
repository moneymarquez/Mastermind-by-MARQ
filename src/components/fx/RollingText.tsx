import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

/** The slot-machine number.
 *
 *  Every digit in `text` becomes a column with a 0–9 strip that slides to
 *  the target; everything that isn't a digit ("/", "$", "kcal") renders
 *  as-is. Fires on first mount and whenever the TEXT changes — never on a
 *  re-render with the same value, which is the rule that keeps it from
 *  becoming noise. Ceiling ~400ms. prefers-reduced-motion skips straight to
 *  the final value.
 *
 *  Theme-independent: Simple gets the plain roll; Cyberpunk's stylesheet
 *  adds a glow trail via .roll-digit.rolling while the strip is moving.
 *
 *  `delay` staggers the start (Overview cascades tile by tile). `onRoll`
 *  reports each real roll so the parent can sweep a scanline over the card. */
export default function RollingText({ text, delay = 0, duration = 380, style, className, onRoll }: {
  text: string;
  delay?: number;
  duration?: number;
  style?: CSSProperties;
  className?: string;
  onRoll?: () => void;
}) {
  const reduced = prefersReducedMotion();
  // Digits shown right now. Starts at "0" for each digit so the first
  // paint rolls up from zero; after that, rolls from the previous value.
  const [shown, setShown] = useState<string>(() => (reduced ? text : text.replace(/\d/g, '0')));
  const [rolling, setRolling] = useState(false);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === text) return; // same value: do nothing (the rule)
    prev.current = text;
    if (reduced) { setShown(text); return; }
    const t = window.setTimeout(() => {
      setShown(text);
      setRolling(true);
      onRoll?.();
      window.setTimeout(() => setRolling(false), duration + 60);
    }, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Keep the column count aligned with the target so a value growing from
  // 9 to 10 doesn't leave a stale column behind.
  const chars = text.split('');
  const shownChars = shown.length === text.length ? shown.split('') : text.replace(/\d/g, '0').split('');

  return (
    <span className={className} style={{ ...style, display: 'inline-flex', alignItems: 'baseline', '--roll-ms': `${duration}ms` } as CSSProperties}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} style={{ whiteSpace: 'pre' }}>{ch}</span>;
        const target = Number(/\d/.test(shownChars[i]) ? shownChars[i] : '0');
        // Later digits get a hair more delay so the settle reads left-to-right.
        const perDigit = `${duration + i * 35}ms`;
        return (
          <span key={i} className={`roll-digit${rolling ? ' rolling' : ''}`} aria-hidden="true">
            <span className="roll-strip" style={{ transform: `translateY(-${target}em)`, transitionDuration: perDigit }}>
              {Array.from({ length: 10 }, (_, d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        );
      })}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{text}</span>
    </span>
  );
}
