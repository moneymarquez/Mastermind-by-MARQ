import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSkin } from '../../data/useTheme';
import { prefersReducedMotion, blip, haptic } from '../../lib/motion';

/** A goal progress bar that charges.
 *
 *  Cyberpunk: arcs of electricity crawl the filled portion, concentrated
 *  at the leading edge — where progress stops, which is where the eye goes.
 *  Intensity scales with PERCENTAGE FILLED, not elapsed time: a bar at 25%
 *  for a month never gets brighter by standing still.
 *    ~25%  one faint arc
 *    ~75%  three, visibly alive
 *    100%  a full discharge burst — ONCE, then still. Tap to replay.
 *
 *  Simple: identical logic with a quieter skin — a glow whose strength is
 *  the fill percentage, and a brief flash on completion instead of arcs.
 *
 *  The completion burst also overshoots the fill by a few percent and
 *  settles, fires the (opt-in) blip and a heavier haptic. All of that is
 *  keyed on the bar CROSSING 100 while mounted, not on rendering at 100,
 *  so opening a screen with finished goals on it is quiet. */
export default function ProgressBar({ pct, height = 8, style, trackColor, fillColor }: {
  pct: number;
  height?: number;
  style?: CSSProperties;
  trackColor?: string;
  fillColor?: string;
}) {
  const skin = useSkin();
  const reduced = prefersReducedMotion();
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const complete = clamped >= 100;
  const [burstKey, setBurstKey] = useState(0);
  const prevComplete = useRef<boolean | null>(null);

  useEffect(() => {
    // First observation just records the state; only a real transition
    // into 100% fires. Reduced motion still gets the sound/haptic — those
    // aren't motion — but no burst animation.
    if (prevComplete.current === null) { prevComplete.current = complete; return; }
    if (complete && !prevComplete.current) {
      setBurstKey((k) => k + 1);
      blip('complete');
      haptic('complete');
    }
    prevComplete.current = complete;
  }, [complete]);

  const replay = () => { if (complete) setBurstKey((k) => k + 1); };

  // Arc count by fill, not time. Deterministic per bar so re-renders don't
  // reshuffle the bolts.
  const arcs = useMemo(() => {
    const n = clamped >= 100 ? 4 : clamped >= 75 ? 3 : clamped >= 50 ? 2 : clamped >= 20 ? 1 : 0;
    return Array.from({ length: n }, (_, i) => ({
      // Each arc is a jagged polyline hugging the leading edge: x in the
      // last ~14% of the fill, y bouncing across the bar's height.
      points: Array.from({ length: 7 }, (_, k) => {
        const x = 100 - (6 - k) * 2.3 - (i * 1.7) % 4;
        const y = k % 2 === 0 ? 10 + ((i * 37 + k * 23) % 30) : 60 + ((i * 19 + k * 41) % 30);
        return `${x},${y}`;
      }).join(' '),
      period: 1900 - i * 260 - Math.round(clamped * 6),
      delay: i * 330,
      opacity: 0.45 + Math.min(0.55, clamped / 130),
    }));
  }, [clamped]);

  const track: CSSProperties = {
    position: 'relative', height, background: trackColor ?? 'var(--border)', borderRadius: 'var(--radius-pill)',
    overflow: 'visible', cursor: complete ? 'pointer' : undefined, ...style,
  };
  const fillBase: CSSProperties = {
    height: '100%', width: `${clamped}%`, background: fillColor ?? 'var(--text)', borderRadius: 'var(--radius-pill)',
    transition: reduced ? undefined : 'width 520ms cubic-bezier(0.22, 1, 0.36, 1)', position: 'relative',
  };

  if (skin !== 'cyberpunk') {
    return (
      <div style={track} onClick={replay} title={complete ? 'Tap to replay' : undefined}>
        <div
          key={burstKey}
          className={`fx-glow-fill${burstKey > 0 ? ' fx-glow-burst fx-overshoot' : ''}`}
          style={{ ...fillBase, background: complete ? 'var(--success)' : fillBase.background, '--fill-pct': clamped } as CSSProperties}
        />
      </div>
    );
  }

  return (
    <div style={{ ...track, background: trackColor ?? 'var(--mm-track)', borderRadius: 2 }} onClick={replay} title={complete ? 'Tap to replay the discharge' : undefined}>
      <div
        key={burstKey}
        className={burstKey > 0 ? 'fx-discharge fx-overshoot' : undefined}
        style={{
          ...fillBase, borderRadius: 2,
          background: complete ? 'var(--neon-green)' : 'linear-gradient(90deg, var(--neon-blue) 0%, var(--neon-blue) 70%, var(--neon-green) 100%)',
          boxShadow: complete ? '0 0 10px var(--neon-green-soft)' : undefined,
        }}
      >
        {arcs.length > 0 && !reduced && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: -height * 0.9, width: `calc(100% + ${height * 1.8}px)`, height: `calc(100% + ${height * 1.8}px)`, overflow: 'visible', pointerEvents: 'none' }}>
            {arcs.map((a, i) => (
              <polyline
                key={i}
                className="fx-arc"
                points={a.points}
                fill="none"
                stroke="var(--neon-green)"
                strokeWidth={1.6}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ '--arc-period': `${a.period}ms`, '--arc-delay': `${a.delay}ms`, opacity: a.opacity } as CSSProperties}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
