import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Screen } from '../types';
import { useDemo, setDemo, stopDemo, SPEED_FACTOR } from './state';
import type { DemoSpeed } from './state';
import { DEMO_STEPS } from './script';
import type { StepHelpers } from './script';
import { DemoScene } from './scenes';
import { logDemo } from './analytics';
import './demo.css';

/** Demo Mode's tour (13-demo-mode-spec §1, §4): drives the real app screen
 *  by screen, spotlights the feature, and narrates it. Small and internal —
 *  no tour library. Mounted by Stage only while the demo is on. */
export default function DemoTour({ navigate }: { navigate: (screen: string) => void }) {
  const demo = useDemo();
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [montageIdx, setMontageIdx] = useState(0);
  const step = DEMO_STEPS[demo.step];
  const factor = SPEED_FACTOR[demo.speed];
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const token = useRef(0);
  const touchX = useRef<number | null>(null);

  // ── Helpers the script's steps use to drive the real UI ────────────
  const helpers = useMemo<StepHelpers>(() => {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const waitFor = async (sel: string, ms = 4000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const el = document.querySelector(sel); if (el) return el; await sleep(80); }
      return null;
    };
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; };
    const clickText = async (text: string | RegExp, within?: string) => {
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        const scope = within ? [...document.querySelectorAll(within)] : [document.querySelector('[data-demo-content]') ?? document.body, document.body];
        const els = scope.flatMap((s) => [...s.querySelectorAll('button, [role="button"], a, div, span, li')]).filter(visible);
        const match = els.filter((el) => { const t = (el.textContent ?? '').trim(); return typeof text === 'string' ? t === text : text.test(t); });
        // The innermost match is the control itself, not a wrapper.
        const el = match.find((m) => !match.some((o) => o !== m && m.contains(o))) ?? match[0];
        if (el) { (el as HTMLElement).click(); return true; }
        await sleep(100);
      }
      return false;
    };
    const click = async (sel: string) => { const el = await waitFor(sel); if (el) { (el as HTMLElement).click(); return true; } return false; };
    const scrollTo = async (sel: string) => { const el = await waitFor(sel, 2500); if (el) { const tall = el.getBoundingClientRect().height > innerHeight * 0.5; if (tall) (el as HTMLElement).style.scrollMarginTop = '96px'; el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: reduced ? 'auto' : 'smooth' }); } await sleep(reduced ? 50 : 450); };
    const go = async (screen: Screen) => { navigate(screen); await sleep(60); await waitFor('[data-demo-content] > *', 5000); await sleep(250); };
    return { go, clickText, click, waitFor, sleep, scrollTo };
  }, [navigate, reduced]);

  // ── Record mode: 3-2-1 before the first step ───────────────────────
  useEffect(() => {
    if (!demo.record || demo.step !== 0) return;
    let n = 3; setCountdown(n); setPaused(true);
    const t = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(t); setCountdown(null); setPaused(false); } else setCountdown(n); }, 800);
    return () => clearInterval(t);
  }, [demo.record, demo.run]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { logDemo('demo_started', { record: demo.record, speed: demo.speed }); }, [demo.run]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enter a step: navigate, run its actions, then reveal ───────────
  useEffect(() => {
    const my = ++token.current;
    setReady(false); setRect(null); setMontageIdx(0);
    if (demo.record && demo.step > 0) whoosh();
    (async () => {
      if (step.screen) await helpers.go(step.screen);
      if (step.montage) await helpers.go(step.montage[0]);
      if (step.prepare) await step.prepare(helpers).catch(() => {});
      if (my !== token.current) return;
      setReady(true);
      if (step.stagger && !reduced) stagger(step.target);
    })();
  }, [demo.step, demo.run]); // eslint-disable-line react-hooks/exhaustive-deps

  // Montage: the step's screens back to back.
  useEffect(() => {
    if (!ready || !step.montage) return;
    const per = (step.seconds * 1000 * factor) / step.montage.length;
    let i = 0;
    const t = setInterval(() => { i += 1; if (i < step.montage!.length) { setMontageIdx(i); navigate(step.montage![i]); } else clearInterval(t); }, per);
    return () => clearInterval(t);
  }, [ready, demo.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spotlight follows the target while it animates, scrolls or resizes.
  useEffect(() => {
    if (!ready || !step.target) { setRect(null); return; }
    const measure = () => { const el = document.querySelector(step.target!); setRect(el ? el.getBoundingClientRect() : null); };
    measure();
    const t = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, [ready, demo.step, montageIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    if (demo.step >= DEMO_STEPS.length - 1) { logDemo('demo_completed', { record: demo.record }); if (!demo.record) exit(); return; }
    setDemo({ step: demo.step + 1 });
  }, [demo.step, demo.record]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useCallback(() => { if (demo.step > 0) setDemo({ step: demo.step - 1 }); }, [demo.step]);
  const exit = useCallback(() => { if (demo.step < DEMO_STEPS.length - 1) logDemo('demo_exited', { step: demo.step, id: step.id }); stopDemo(); }, [demo.step, step.id]);

  // Auto-advance on the step's timing.
  useEffect(() => {
    if (!ready || !demo.auto || paused || countdown !== null) return;
    const last = demo.step >= DEMO_STEPS.length - 1;
    if (last && !demo.record) return; // the end card waits for Replay / Exit
    const t = setTimeout(next, step.seconds * 1000 * factor);
    return () => clearTimeout(t);
  }, [ready, demo.auto, paused, countdown, demo.step, factor, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // Record mode ends by itself a beat after the end card.
  useEffect(() => {
    if (!demo.record || !ready || demo.step !== DEMO_STEPS.length - 1) return;
    const t = setTimeout(() => stopDemo(), step.seconds * 1000 * factor + 400);
    return () => clearTimeout(t);
  }, [demo.record, ready, demo.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: space / → / Enter next, ← back, Esc exit.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.key === 'Escape') { e.preventDefault(); exit(); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [next, back, exit]);

  const fullScene = step.scene === 'intro' || step.scene === 'reel' || step.scene === 'end';
  // The intro and end card carry their own headline; every other step
  // (the reel included) narrates in the card.
  const showCard = step.scene !== 'intro' && step.scene !== 'end';

  return (
    <div className={`demo-root${reduced ? ' demo-reduced' : ''}${demo.record ? ' demo-record' : ''}`}>
      {rect && !fullScene && <Spotlight rect={rect} />}
      {ready && step.scene && <DemoScene scene={step.scene} step={step} factor={factor} record={demo.record} onReplay={() => setDemo({ step: 0 })} onExit={exit} />}

      {!demo.record && (
        <div className="demo-bar" role="toolbar" aria-label="Demo controls">
          <span className="demo-badge">Demo</span>
          <button type="button" onClick={() => setDemo({ auto: !demo.auto })} aria-pressed={demo.auto}>{demo.auto ? '⏸ Auto' : '▶ Auto'}</button>
          <select aria-label="Speed" value={demo.speed} onChange={(e) => setDemo({ speed: e.target.value as DemoSpeed })}>
            <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
          </select>
          <button type="button" onClick={() => setDemo({ record: true, step: 0, auto: true })}>● Record</button>
          <button type="button" onClick={exit}>Exit</button>
        </div>
      )}

      {showCard && (
        <div className={`demo-card${ready ? ' demo-card-in' : ''}${fullScene ? ' demo-card-scene' : ''}`}
          onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) next(); }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (dx > 50) back(); else if (dx < -50) next(); }}>
          <div aria-live="polite" aria-atomic="true">
            <div className="demo-headline">{step.headline}</div>
            <div className="demo-body">{step.body}</div>
          </div>
          {!demo.record && (
            <div className="demo-foot">
              <div className="demo-dots" aria-label={`Step ${demo.step + 1} of ${DEMO_STEPS.length}`}>
                {DEMO_STEPS.map((s, i) => <span key={s.id} className={i === demo.step ? 'on' : i < demo.step ? 'done' : ''} />)}
              </div>
              <button type="button" className="demo-ghost" onClick={back} disabled={demo.step === 0} aria-label="Back">‹</button>
              <button type="button" className="demo-next" onClick={next}>{demo.step === DEMO_STEPS.length - 1 ? 'Done' : 'Next'}</button>
            </div>
          )}
          {ready && demo.auto && !demo.record && <div className="demo-timer" style={{ animationDuration: `${step.seconds * factor}s` }} key={`${demo.step}-${demo.speed}`} />}
        </div>
      )}
      {countdown !== null && <div className="demo-countdown" aria-live="assertive"><span key={countdown}>{countdown}</span></div>}
    </div>
  );
}

function Spotlight({ rect }: { rect: DOMRect }) {
  const pad = 8, r = 18;
  const x = Math.max(4, rect.left - pad), y = Math.max(4, rect.top - pad);
  const w = Math.min(window.innerWidth - 8, rect.width + pad * 2), h = Math.min(window.innerHeight - y - 4, rect.height + pad * 2);
  // Outer rectangle plus a rounded hole, even-odd: everything but the
  // feature is dimmed and softly blurred.
  const W = window.innerWidth, H = window.innerHeight;
  const path = `M0 0H${W}V${H}H0Z M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  const style: CSSProperties = { clipPath: `path(evenodd, '${path}')` };
  return (
    <>
      <div className="demo-dim" style={style} aria-hidden="true" />
      <div className="demo-ring" aria-hidden="true" style={{ left: x, top: y, width: w, height: h, borderRadius: r }} />
    </>
  );
}

/** Cards "fan out": the target's direct children fade and rise in, 60 ms apart. */
function stagger(sel?: string) {
  const root = sel ? document.querySelector(sel) : null;
  const kids = root ? [...root.querySelectorAll(':scope > *, :scope > * > *')].slice(0, 14) : [];
  kids.forEach((k, i) => {
    (k as HTMLElement).animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
  });
}

let audio: AudioContext | null = null;
/** Record mode's step transition: a soft filtered-noise whoosh + a haptic tick. */
function whoosh() {
  try {
    navigator.vibrate?.(8);
    audio ??= new AudioContext();
    const ctx = audio, len = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(400, ctx.currentTime); bp.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.3);
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(bp).connect(g).connect(ctx.destination); src.start();
  } catch { /* no audio — silent is fine */ }
}
