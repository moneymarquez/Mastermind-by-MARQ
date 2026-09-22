import { useEffect, useState } from 'react';

/** The daily cold open (Cyberpunk; first open of each calendar day).
 *
 *    "Good morning, Marq"  →  glitch  →  a line  →  glitch  →  Overview
 *
 *  Two seconds, tap to skip. Quotes come from a fixed list rotated by day
 *  of year — the open question of pulling them from active goals instead
 *  is left to the user; swapping the source is a one-line change here. */
const QUOTES = [
  'Thirty-five dials. Everything else is commentary.',
  'The pipeline is a mirror. Fill it.',
  'Nobody is coming. Pick up the phone.',
  'Today is a rep. Do the rep.',
  'You do not rise to your goals. You fall to your systems.',
  'A closed client is thirty-five conversations away.',
  'Discipline is choosing what you want most over what you want now.',
  'The money is in the follow-up.',
  'Streaks are built in the mornings you did not feel like it.',
  'Hard days are the price. Pay it early.',
  'Boring work, done daily, compounds into a different life.',
  'Make the calls. Log the calls. Sleep well.',
  'One city, one list, one hour. Then the next.',
  'Sober, trained, dialed in. In that order.',
];

function greeting(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

export default function ColdOpen({ name, onDone }: { name: string; onDone: () => void }) {
  const [phase, setPhase] = useState<'greet' | 'g1' | 'quote' | 'g2' | 'out'>('greet');
  const now = new Date();
  const quote = QUOTES[dayOfYear(now) % QUOTES.length];

  useEffect(() => {
    const t = [
      window.setTimeout(() => setPhase('g1'), 700),
      window.setTimeout(() => setPhase('quote'), 900),
      window.setTimeout(() => setPhase('g2'), 1750),
      window.setTimeout(() => setPhase('out'), 1900),
      window.setTimeout(onDone, 2050),
    ];
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glitch = phase === 'g1' || phase === 'g2';
  const showQuote = phase === 'quote' || phase === 'g2';
  return (
    <div className={`fx-intro-overlay${phase === 'out' ? ' fx-intro-out' : ''}`} onClick={onDone} role="presentation">
      <div className={glitch ? 'fx-hard-glitch' : undefined}>
        {showQuote ? (
          <div key="q" className="fx-cold-line fx-cold-quote">“{quote}”</div>
        ) : (
          <div key="g" className="fx-cold-line">{greeting(now.getHours())}, <em style={{ fontStyle: 'normal', color: 'var(--neon-blue)' }}>{name}</em></div>
        )}
      </div>
      <div style={{ position: 'absolute', bottom: 'calc(28px + env(safe-area-inset-bottom))', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mm-faint)', fontFamily: 'var(--font-mono)' }}>tap to skip</div>
    </div>
  );
}
