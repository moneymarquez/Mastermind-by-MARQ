import { describe, it, expect } from 'vitest';
import { PRODUCT_MODULES, MODULE_COUNT, PERSONAL_TBD } from '../src/site/productContent';
import { SOLO_LINEUP, TEAMS_MODULE_KEYS } from '../src/modules.config';
import { streakDays } from '../src/lib/celebrate';
import { withRegistry, NAV_DATA } from '../src/data';
import { MODULE_REGISTRY } from '../src/modules.config';

describe('website alignment (Phase 7)', () => {
  it('the Product page lists exactly the solo lineup, and the count is derived', () => {
    expect(PRODUCT_MODULES.map((m) => m.key)).toEqual(SOLO_LINEUP);
    expect(MODULE_COUNT).toBe(SOLO_LINEUP.length);
    expect(PERSONAL_TBD).toBe(0);
    for (const k of TEAMS_MODULE_KEYS) expect(PRODUCT_MODULES.map((m) => m.key)).not.toContain(k);
    for (const m of PRODUCT_MODULES) expect(m.line.length).toBeGreaterThan(10);
  });
});

describe('nav is derived from the registry', () => {
  it('every module\'s first route appears exactly once', () => {
    const ids = NAV_DATA.flatMap((g) => g.items.map((i) => i.id));
    for (const m of MODULE_REGISTRY) expect(ids.filter((x) => x === m.routes[0])).toHaveLength(1);
    expect(NAV_DATA.flatMap((g) => g.items).find((i) => i.id === 'weekly-review')?.label).toBe('Weekly Check-in');
  });
  it('is idempotent', () => {
    expect(withRegistry(NAV_DATA).flatMap((g) => g.items.map((i) => i.id))).toEqual(NAV_DATA.flatMap((g) => g.items.map((i) => i.id)));
  });
});

describe('design pass (Phase 6)', () => {
  it('streak counts consecutive days, allowing today to be not done yet', () => {
    expect(streakDays(['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-04'], '2026-10-08')).toBe(3);
    expect(streakDays(['2026-10-07', '2026-10-06'], '2026-10-08')).toBe(2);
    expect(streakDays(['2026-10-05'], '2026-10-08')).toBe(0);
  });
});
