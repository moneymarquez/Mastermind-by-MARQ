// Demo Mode state (13-demo-mode-spec). One small store the whole app can
// read synchronously — the Supabase switch in lib/supabase.ts asks
// `isDemo()` on every call, so there is no window where a real query runs
// with demo on (or the other way round).
import { useSyncExternalStore } from 'react';

export type DemoSpeed = 'slow' | 'normal' | 'fast';
export interface DemoState {
  active: boolean;
  /** Record mode: no presenter bar or dots, demo identity, countdown, auto-advance. */
  record: boolean;
  speed: DemoSpeed;
  auto: boolean;
  step: number;
  /** Bumped on every start so the tour restarts from its first step. */
  run: number;
  /** Where to return to on exit. */
  returnTo: string | null;
  /** false = explore on sample data with no guided tour (?demo=explore). */
  tour: boolean;
}

export const SPEED_FACTOR: Record<DemoSpeed, number> = { slow: 1.6, normal: 1, fast: 0.62 };

let state: DemoState = { active: false, record: false, speed: 'normal', auto: true, step: 0, run: 0, returnTo: null, tour: true };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export function isDemo(): boolean { return state.active; }
export function getDemo(): DemoState { return state; }
export function subscribeDemo(l: () => void): () => void { listeners.add(l); return () => listeners.delete(l); }
export function useDemo(): DemoState { return useSyncExternalStore(subscribeDemo, getDemo, getDemo); }

export function startDemo(opts: Partial<Pick<DemoState, 'record' | 'speed' | 'auto' | 'returnTo' | 'tour'>> = {}): void {
  const speed = opts.speed ?? state.speed;
  state = {
    active: true, record: !!opts.record, speed,
    // Slow is for live walkthroughs where Marq talks over it: manual by default.
    auto: opts.auto ?? (opts.record ? true : speed !== 'slow'),
    step: 0, run: state.run + 1, returnTo: opts.returnTo ?? null, tour: opts.tour ?? true,
  };
  emit();
}
export function stopDemo(): void { if (!state.active) return; state = { ...state, active: false, record: false, step: 0 }; emit(); }
export function setDemo(patch: Partial<Pick<DemoState, 'speed' | 'auto' | 'record' | 'step'>>): void {
  if (!state.active) return;
  state = { ...state, ...patch };
  emit();
}

/** ?demo=1 · ?demo=record&speed=fast — read once at load, then removed
 *  from the URL so a reload doesn't restart the tour. */
export function demoFromUrl(search = window.location.search): Partial<DemoState> | null {
  const p = new URLSearchParams(search);
  const d = p.get('demo');
  if (!d || d === '0') return null;
  const speed = p.get('speed');
  return { record: d === 'record', tour: d !== 'explore', speed: speed === 'slow' || speed === 'fast' ? speed : 'normal' };
}
export function consumeDemoUrl(): void {
  const opts = demoFromUrl();
  if (!opts) return;
  const url = new URL(window.location.href);
  url.searchParams.delete('demo'); url.searchParams.delete('speed');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  startDemo(opts);
}
