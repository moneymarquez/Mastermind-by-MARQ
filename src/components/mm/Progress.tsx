/** A progress bar that visibly animates when it moves (brief Phase 6). */
export default function Progress({ pct, tone, label }: { pct: number; tone?: 'good' | 'warn'; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return <div className={`mm-progress${tone ? ` mm-progress--${tone}` : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}><span style={{ width: `${v}%` }} /></div>;
}

/** 🔥 N-day streak chip for modules with a daily action. */
export function Streak({ days, what }: { days: number; what: string }) {
  if (days < 2) return null;
  return <span className="mm-streak" title={`${days} days in a row with ${what}`}>🔥 {days}-day streak</span>;
}
