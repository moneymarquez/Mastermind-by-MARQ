import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

/** The PWA launch sequence (Cyberpunk, home-screen launches only).
 *
 *    0ms   "MASTERMINDS BY MARQ" welds in letter by letter, sparks flying
 *  ~600ms  the MARQ mark slams into place beside it
 *  ~1000ms hard glitch
 *  ~1150ms the mark snaps up to where the header's logo actually sits, so
 *          the intro lands on the app's real layout instead of cutting
 *  ~1400ms overlay fades; gone by 1.5s
 *
 *  All CSS — no video, no canvas. Any tap ends it immediately. Runs once
 *  per launch (sessionStorage), never on a plain browser tab, and never
 *  under prefers-reduced-motion. */
const TITLE = 'MASTERMINDS BY MARQ';
const SPARKS = [
  { at: 0.06, sx: '-14px', sy: '-26px', d: 40 }, { at: 0.16, sx: '10px', sy: '-30px', d: 120 }, { at: 0.28, sx: '-6px', sy: '-22px', d: 200 },
  { at: 0.4, sx: '16px', sy: '-18px', d: 260 }, { at: 0.52, sx: '-18px', sy: '-28px', d: 330 }, { at: 0.64, sx: '8px', sy: '-34px', d: 400 },
  { at: 0.76, sx: '-10px', sy: '-20px', d: 460 }, { at: 0.9, sx: '14px', sy: '-26px', d: 520 }, { at: 0.34, sx: '4px', sy: '-38px', d: 300 },
  { at: 0.58, sx: '-4px', sy: '-16px', d: 380 },
];

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'weld' | 'slam' | 'glitch' | 'snap' | 'out'>('weld');
  const [snap, setSnap] = useState<CSSProperties>({});

  useEffect(() => {
    const t: number[] = [];
    t.push(window.setTimeout(() => setPhase('slam'), 600));
    t.push(window.setTimeout(() => setPhase('glitch'), 1000));
    t.push(window.setTimeout(() => {
      // Where the header's own logo lives right now — the app is already
      // rendered under this overlay, so we can ask it.
      const home = document.querySelector<HTMLElement>('img[alt="MARQ"]');
      const mark = document.getElementById('fx-launch-mark');
      if (home && mark) {
        const a = mark.getBoundingClientRect();
        const b = home.getBoundingClientRect();
        setSnap({
          '--snap-x': `${b.left + b.width / 2 - (a.left + a.width / 2)}px`,
          '--snap-y': `${b.top + b.height / 2 - (a.top + a.height / 2)}px`,
          '--snap-s': `${b.width / a.width}`,
        } as CSSProperties);
      } else {
        setSnap({ '--snap-x': `${window.innerWidth / 2 - 40}px`, '--snap-y': `${-window.innerHeight / 2 + 40}px`, '--snap-s': '0.5' } as CSSProperties);
      }
      setPhase('snap');
    }, 1150));
    t.push(window.setTimeout(() => setPhase('out'), 1380));
    t.push(window.setTimeout(onDone, 1500));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMark = phase !== 'weld';
  return (
    <div className={`fx-intro-overlay${phase === 'out' ? ' fx-intro-out' : ''}`} onClick={onDone} role="presentation">
      <div className={phase === 'glitch' ? 'fx-hard-glitch' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 'clamp(18px, 4.6vw, 34px)', fontWeight: 700, letterSpacing: '0.18em', opacity: phase === 'snap' || phase === 'out' ? 0 : 1, transition: 'opacity 200ms ease' }}>
          {TITLE.split('').map((ch, i) => (
            <span key={i} className="fx-weld-char" style={{ '--weld-delay': `${i * 14}ms` } as CSSProperties}>{ch}</span>
          ))}
          {SPARKS.map((s, i) => (
            <span key={i} className="fx-spark" style={{ left: `${s.at * 100}%`, top: '30%', '--sx': s.sx, '--sy': s.sy, '--spark-delay': `${s.d}ms` } as CSSProperties} />
          ))}
        </div>
        <img
          id="fx-launch-mark"
          src="/marq-wordmark.png"
          alt=""
          className={phase === 'slam' || phase === 'glitch' ? 'fx-slam' : phase === 'snap' || phase === 'out' ? 'fx-snap' : undefined}
          style={{ width: 56, height: 56, objectFit: 'contain', filter: 'var(--mm-logo-filter)', mixBlendMode: 'var(--mm-logo-blend)' as CSSProperties['mixBlendMode'], opacity: showMark ? 1 : 0, ...snap }}
        />
      </div>
    </div>
  );
}
