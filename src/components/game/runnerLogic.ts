// The error-screen runner's rules, kept pure so they can be tested.
export const W = 600, H = 160, GROUND = 128, PLAYER_X = 48, PLAYER = { w: 26, h: 28 };
export const GRAVITY = 2400, JUMP_V = -720, START_SPEED = 240, MAX_SPEED = 620;
export type ObstacleKind = 'bug' | 'box' | 'spinner' | 'null';
export interface Obstacle { x: number; w: number; h: number; kind: ObstacleKind }
export interface Game { y: number; vy: number; obstacles: Obstacle[]; speed: number; score: number; dist: number; nextGap: number; over: boolean; t: number }
export const SIZES: Record<ObstacleKind, { w: number; h: number }> = { bug: { w: 22, h: 20 }, box: { w: 24, h: 30 }, spinner: { w: 24, h: 24 }, null: { w: 38, h: 20 } };
export const KINDS: ObstacleKind[] = ['bug', 'box', 'spinner', 'null'];

export const newGame = (): Game => ({ y: GROUND - PLAYER.h, vy: 0, obstacles: [], speed: START_SPEED, score: 0, dist: 0, nextGap: 380, over: false, t: 0 });
export const onGround = (g: Game) => g.y >= GROUND - PLAYER.h - 0.5;
export const jump = (g: Game): void => { if (!g.over && onGround(g)) g.vy = JUMP_V; };
/** Speed climbs slowly with the score and caps. */
export const speedFor = (score: number): number => Math.min(MAX_SPEED, START_SPEED + score * 0.9);
/** Slightly forgiving box overlap (inset by a few pixels). */
export function hits(g: Game, o: Obstacle, inset = 4): boolean {
  const px = PLAYER_X + inset, pw = PLAYER.w - inset * 2, py = g.y + inset, ph = PLAYER.h - inset * 2;
  const oy = GROUND - o.h;
  return px < o.x + o.w - inset && px + pw > o.x + inset && py < oy + o.h && py + ph > oy;
}
/** Advance by dt seconds. `rand` is injected so tests are deterministic. */
export function step(g: Game, dt: number, rand: () => number = Math.random): Game {
  if (g.over) return g;
  const d = Math.min(dt, 0.05);
  g.t += d;
  g.vy += GRAVITY * d; g.y += g.vy * d;
  if (g.y > GROUND - PLAYER.h) { g.y = GROUND - PLAYER.h; g.vy = 0; }
  g.speed = speedFor(g.score);
  const dx = g.speed * d;
  g.dist += dx; g.score = Math.floor(g.dist / 10);
  for (const o of g.obstacles) o.x -= dx;
  g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);
  g.nextGap -= dx;
  if (g.nextGap <= 0) {
    const kind = KINDS[Math.floor(rand() * KINDS.length) % KINDS.length];
    g.obstacles.push({ x: W + 10, ...SIZES[kind], kind });
    // The gap always leaves room for a jump at the current speed.
    g.nextGap = 260 + g.speed * 0.45 + rand() * 260;
  }
  if (g.obstacles.some((o) => hits(g, o))) g.over = true;
  return g;
}
export const HI_KEY = 'mm:runner-hi';
export function readHi(): number { try { const n = Number(localStorage.getItem(HI_KEY)); return Number.isFinite(n) && n > 0 ? n : 0; } catch { return 0; } }
export function saveHi(n: number): void { try { localStorage.setItem(HI_KEY, String(Math.floor(n))); } catch { /* private mode: never crash the crash screen */ } }
