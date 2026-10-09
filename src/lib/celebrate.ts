// The completion moment (brief Phase 6): a check that pops where the tap
// was, plus a short haptic on phones that support it. Respects
// prefers-reduced-motion (CSS hides the burst) and does nothing on the server.

let lastAt = 0;
export function celebrate(at?: { clientX: number; clientY: number } | null): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastAt < 250) return; // a double tap is one moment
  lastAt = now;
  try { navigator.vibrate?.(14); } catch { /* not supported */ }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = 'mm-burst';
  el.textContent = '✓';
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${at?.clientX ?? window.innerWidth / 2}px`;
  el.style.top = `${at?.clientY ?? window.innerHeight / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

/** Consecutive days (ending today, or yesterday if today isn't done yet)
 *  that have at least one entry. Pure. */
export function streakDays(dates: string[], today: string): number {
  const set = new Set(dates.map((d) => d.slice(0, 10)));
  const step = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  let d = set.has(today) ? today : step(today);
  let n = 0;
  while (set.has(d)) { n++; d = step(d); }
  return n;
}
