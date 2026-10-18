import { describe, it, expect } from 'vitest';
import { newGame, step, jump, onGround, hits, speedFor, GROUND, PLAYER, PLAYER_X, START_SPEED, MAX_SPEED, saveHi, readHi } from '../src/components/game/runnerLogic';

describe('error-screen runner', () => {
  it('jumps only from the ground and lands again', () => {
    const g = newGame();
    expect(onGround(g)).toBe(true);
    jump(g); expect(g.vy).toBeLessThan(0);
    step(g, 0.05); expect(onGround(g)).toBe(false);
    const v = g.vy; jump(g); expect(g.vy).toBe(v);
    for (let i = 0; i < 40; i++) step(g, 0.03, () => 0.99);
    expect(g.y).toBeLessThanOrEqual(GROUND - PLAYER.h);
  });
  it('score counts up and speed rises but caps', () => {
    expect(speedFor(0)).toBe(START_SPEED);
    expect(speedFor(100)).toBeGreaterThan(START_SPEED);
    expect(speedFor(1e6)).toBe(MAX_SPEED);
  });
  it('ends when an obstacle reaches the bot and stops moving after', () => {
    const g = newGame();
    g.obstacles.push({ x: PLAYER_X, w: 24, h: 30, kind: 'box' });
    step(g, 0.016);
    expect(g.over).toBe(true);
    const d = g.dist; step(g, 0.5); expect(g.dist).toBe(d);
  });
  it('a jump clears a low obstacle', () => {
    const g = newGame();
    const o = { x: PLAYER_X, w: 22, h: 20, kind: 'bug' as const };
    g.y = GROUND - PLAYER.h - 60;
    expect(hits(g, o)).toBe(false);
  });
  it('high score storage never throws, even with no storage', () => {
    expect(() => saveHi(5)).not.toThrow();
    expect(typeof readHi()).toBe('number');
  });
});
