/** Motion, sound and haptics — the small shared layer the fx components
 *  sit on. Nothing here renders; it answers "should this animate", "how
 *  loud", and "make the noise".
 *
 *  Sound is OFF by default and only ever fires on the two moments worth
 *  it (a closed client, a completed goal). Haptics use navigator.vibrate,
 *  which iOS Safari doesn't implement — on the phone this is a no-op, and
 *  that's stated in settings rather than pretended otherwise. */

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const SOUND_KEY = 'mm:sound-fx';

export function soundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}
export function setSoundEnabled(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

/** A short synth blip. Two notes for a completion, one for a press.
 *  WebAudio, so no asset; the context is created lazily on first use
 *  because browsers refuse to start one before a user gesture. */
let ctx: AudioContext | null = null;
export function blip(kind: 'complete' | 'close' = 'complete'): void {
  if (!soundEnabled() || typeof window === 'undefined') return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = kind === 'close' ? [660, 880, 1320] : [880, 1174];
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.08, t0 + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 0.12);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + i * 0.08);
      o.stop(t0 + i * 0.08 + 0.13);
    });
  } catch {
    // No audio device, or the context was refused — silence is fine.
  }
}

export function haptic(kind: 'tap' | 'complete'): void {
  try {
    navigator.vibrate?.(kind === 'tap' ? 8 : [20, 40, 30]);
  } catch {
    // Not supported (iOS), not granted, or not a user gesture.
  }
}

/** Per-day "already shown" flags for the cold open and the 4pm pulse. */
export function onceToday(key: string): boolean {
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  try {
    if (localStorage.getItem(`mm:once:${key}`) === stamp) return false;
    localStorage.setItem(`mm:once:${key}`, stamp);
    return true;
  } catch {
    return false;
  }
}
