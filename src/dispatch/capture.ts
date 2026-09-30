// Dispatch voice capture (spec 15 §2.1, §4). One controller for the whole
// app so the mic on the Dispatch screen and the one on the home widget are
// the same session: hold to talk, tap to lock, stop → Review.
//
// Three things run while recording:
//   • SpeechRecognition (live words, restarted across its silence cut-offs)
//   • an AnalyserNode on the mic for the level ring (smoothed ~100 ms)
//   • MediaRecorder, so the audio is kept — if live transcription fails or
//     the browser has none, the Worker's Whisper route transcribes it, and a
//     failed attempt can be retried without asking anyone to repeat it.
import { useSyncExternalStore } from 'react';

export type CapturePhase = 'idle' | 'countdown' | 'recording' | 'transcribing' | 'extracting' | 'review' | 'error' | 'typing';

export interface CaptureState {
  phase: CapturePhase;
  locked: boolean;
  startedAt: number | null;
  finalText: string;
  interim: string;
  level: number;
  countdown: number;
  error: string | null;
  /** 'denied' | 'no-speech' | 'transcribe' | 'extract' | … — drives the recovery UI. */
  errorKind: string | null;
  durationS: number | null;
  hasAudio: boolean;
  typed: boolean;
}

const initial: CaptureState = { phase: 'idle', locked: false, startedAt: null, finalText: '', interim: '', level: 0, countdown: 0, error: null, errorKind: null, durationS: null, hasAudio: false, typed: false };
let state: CaptureState = initial;
const subs = new Set<() => void>();
function set(patch: Partial<CaptureState>) { state = { ...state, ...patch }; subs.forEach((f) => f()); }
export function getCapture(): CaptureState { return state; }
export function useCapture(): CaptureState { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getCapture, getCapture); }
export function transcriptOf(s: CaptureState = state): string { return `${s.finalText}${s.interim ? `${s.finalText ? ' ' : ''}${s.interim}` : ''}`.trim(); }

// ── browser plumbing ──────────────────────────────────────────────────
interface Rec { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
type RecCtor = new () => Rec;
function recCtor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function canTranscribeLive(): boolean { return typeof window !== 'undefined' && !!recCtor(); }
export function canRecord(): boolean { return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia; }

let rec: Rec | null = null;
let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let raf = 0;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let audio: Blob | null = null;
let wantRec = false;
let liveFailed = false;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let onStopped: ((transcript: string) => void) | null = null;
let transcribeFn: ((b: Blob) => Promise<{ text?: string; error?: string }>) | null = null;

export function lastAudio(): Blob | null { return audio; }

function haptic(ms = 12) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }

function startLevel(s: MediaStream) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const src = ctx.createMediaStreamSource(s);
    const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let smooth = 0; let last = performance.now();
    const tick = (now: number) => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      // One-pole low-pass, time constant 100 ms, so the ring never jitters.
      const a = 1 - Math.exp(-(now - last) / 100); last = now;
      smooth += (rms - smooth) * a;
      if (Math.abs(smooth - state.level) > 0.01) set({ level: smooth });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch { /* level ring just stays still */ }
}

function startRecognition() {
  const C = recCtor();
  if (!C) { liveFailed = true; return; }
  try {
    const r = new C(); rec = r;
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let fin = ''; let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else interim += res[0].transcript;
      }
      set({ finalText: fin ? `${state.finalText} ${fin}`.replace(/\s+/g, ' ').trim() : state.finalText, interim: interim.trim() });
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { liveFailed = true; if (!stream) fail('denied', 'Microphone access is off for this site.'); return; }
      liveFailed = true; // network / audio-capture → the recording is transcribed on stop instead
    };
    // Browsers end a continuous session after a pause; keep it going while
    // we still want it.
    r.onend = () => { if (wantRec && !liveFailed) { try { r.start(); } catch { liveFailed = true; } } };
    r.start();
  } catch { liveFailed = true; }
}

function teardown() {
  wantRec = false;
  try { rec?.abort(); } catch { /* already stopped */ }
  rec = null;
  cancelAnimationFrame(raf);
  void ctx?.close().catch(() => {}); ctx = null;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
}

function fail(kind: string, message: string) {
  teardown();
  set({ phase: 'error', error: message, errorKind: kind, level: 0, interim: '' });
}

/** Wire the controller to the page's data layer: what to do with the
 *  finished words, and how to reach the server transcriber. */
export function configureCapture(opts: { onStopped: (transcript: string) => void; transcribe: (b: Blob) => Promise<{ text?: string; error?: string }> }) {
  onStopped = opts.onStopped; transcribeFn = opts.transcribe;
}

export async function startCapture(opts: { locked?: boolean; countdown?: number } = {}): Promise<void> {
  if (state.phase === 'recording' || state.phase === 'countdown') return;
  if (!canRecord() && !canTranscribeLive()) { set({ ...initial, phase: 'error', errorKind: 'unsupported', error: "This browser can't record audio." }); return; }
  set({ ...initial, phase: opts.countdown ? 'countdown' : 'recording', locked: !!opts.locked, countdown: opts.countdown ?? 0 });
  audio = null; chunks = []; liveFailed = false; wantRec = true;
  if (opts.countdown) {
    await new Promise<void>((resolve) => {
      countdownTimer = setInterval(() => {
        if (state.phase !== 'countdown') { if (countdownTimer) clearInterval(countdownTimer); resolve(); return; }
        if (state.countdown <= 1) { if (countdownTimer) clearInterval(countdownTimer); set({ countdown: 0, phase: 'recording' }); resolve(); }
        else set({ countdown: state.countdown - 1 });
      }, 1000);
    });
    if ((getCapture().phase as CapturePhase) !== 'recording') return;
  }
  haptic(15);
  set({ startedAt: Date.now() });
  if (canRecord()) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      fail(denied ? 'denied' : 'no-mic', denied ? 'Microphone access is off for this site.' : "Couldn't open the microphone.");
      return;
    }
    if (!wantRec) { teardown(); return; }
    startLevel(stream);
    try {
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t));
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      recorder.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      recorder.start(1000);
    } catch { recorder = null; }
  }
  startRecognition();
}

export function lockCapture() { if (state.phase === 'recording' && !state.locked) { set({ locked: true }); haptic(8); } }

export async function stopCapture(): Promise<void> {
  if (state.phase === 'countdown') { if (countdownTimer) clearInterval(countdownTimer); set({ ...initial }); teardown(); return; }
  if (state.phase !== 'recording') return;
  const durationS = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : null;
  wantRec = false;
  try { rec?.stop(); } catch { /* ok */ }
  // Give the recogniser a beat to flush its last final result.
  await new Promise((r) => setTimeout(r, 450));
  if (recorder && recorder.state !== 'inactive') {
    await new Promise<void>((resolve) => { recorder!.onstop = () => resolve(); try { recorder!.stop(); } catch { resolve(); } });
  }
  audio = chunks.length ? new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }) : null;
  recorder = null;
  teardown();
  haptic(10);
  const words = transcriptOf();
  set({ level: 0, interim: '', finalText: words, durationS, hasAudio: !!audio });
  if (words && !liveFailed) { set({ phase: 'extracting' }); onStopped?.(words); return; }
  if (words && liveFailed && !audio) { set({ phase: 'extracting' }); onStopped?.(words); return; }
  if (audio) { await retryTranscription(); return; }
  set({ phase: 'error', errorKind: 'no-speech', error: "Didn't catch anything. Hold the mic and talk, or type it." });
}

/** Server transcription of the kept recording — the fallback and the retry. */
export async function retryTranscription(): Promise<void> {
  if (!audio || !transcribeFn) { set({ phase: 'error', errorKind: 'transcribe', error: 'No recording to transcribe.' }); return; }
  const had = state.finalText;
  set({ phase: 'transcribing', error: null, errorKind: null });
  const r = await transcribeFn(audio);
  const text = (r.text ?? '').trim();
  if (r.error || !text) {
    // Keep whatever live words we did get; the audio stays for another try.
    set({ phase: 'error', errorKind: 'transcribe', error: r.error ?? "Couldn't make out any words.", finalText: had });
    return;
  }
  set({ finalText: text, phase: 'extracting' });
  onStopped?.(text);
}

/** The "Or type it" path and the no-mic fallback. */
export function submitTyped(text: string) {
  const t = text.trim(); if (!t) return;
  set({ ...initial, phase: 'extracting', finalText: t, typed: true });
  onStopped?.(t);
}

/** Open the "Or type it" sheet, optionally with words already in it. */
export function openTyping(prefill = '') { if (state.phase === 'recording') return; set({ ...initial, phase: 'typing', finalText: prefill, typed: true }); }

export function setCapturePhase(phase: CapturePhase, patch: Partial<CaptureState> = {}) { set({ phase, ...patch }); }
export function captureError(kind: string, message: string) { set({ phase: 'error', errorKind: kind, error: message }); }
export function resetCapture() { if (countdownTimer) clearInterval(countdownTimer); teardown(); recorder = null; set({ ...initial }); }
