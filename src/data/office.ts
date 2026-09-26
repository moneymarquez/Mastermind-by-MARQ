/** View Office — pure rules: which sprite state a worker is in, from real
 *  data only (Appendix 5 Part 3 "no fake animation that doesn't match real
 *  data"), and the room layout order. */
import { LIVE_WORKERS } from './ecom';

export type SpriteState = 'working' | 'idle' | 'waiting' | 'error' | 'off' | 'asleep' | 'unbuilt';
/** Row in the 4×5 sprite sheet (public/office/README.md). */
export const SPRITE_ROW: Record<SpriteState, number> = { working: 0, idle: 1, waiting: 2, error: 3, asleep: 4, off: 4, unbuilt: 4 };
export const STATE_LABEL: Record<SpriteState, string> = { working: 'Working', idle: 'Idle', waiting: 'Waiting on you', error: 'Error', off: 'Off', asleep: 'No runs today', unbuilt: 'Not built yet' };

export interface WorkerLike { key: string; status: string; enabled: boolean }
export interface WorkerFacts { runsToday: number; lastRunFailed: boolean; pendingApprovals: number }

export function spriteState(w: WorkerLike, f: WorkerFacts): SpriteState {
  if (!w.enabled || w.status === 'disabled') return 'off';
  if (w.status === 'running') return 'working';
  if (w.key !== 'orchestrator' && !LIVE_WORKERS.includes(w.key)) return 'unbuilt';
  if (w.status === 'failed' || f.lastRunFailed) return 'error';
  if (f.pendingApprovals > 0) return 'waiting';
  if (w.key !== 'orchestrator' && f.runsToday === 0) return 'asleep';
  return 'idle';
}

/** Live workers first, then waiting/error ones, so the rooms that matter
 *  sit nearest the orchestrator. */
export function roomOrder<T extends WorkerLike>(workers: T[], facts: Record<string, WorkerFacts>, idOf: (w: T) => string): T[] {
  const rank: Record<SpriteState, number> = { waiting: 0, error: 1, working: 2, idle: 3, asleep: 4, off: 5, unbuilt: 6 };
  return workers.filter((w) => w.key !== 'orchestrator').slice().sort((a, b) => rank[spriteState(a, facts[idOf(a)] ?? { runsToday: 0, lastRunFailed: false, pendingApprovals: 0 })] - rank[spriteState(b, facts[idOf(b)] ?? { runsToday: 0, lastRunFailed: false, pendingApprovals: 0 })]);
}

export const spriteUrl = (key: string) => `/office/sprites/${key}.png`;
