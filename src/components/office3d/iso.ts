// Isometric drawing helpers for the Office and Classroom scenes. Pure.
// World units: x to the right-down, y to the left-down, z up. One unit = S px.

export const S = 22;
const CX = 0.866, CY = 0.5;

/** World point → screen point. */
export const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * S * CX, (x + y) * S * CY - z * S];
export const pts = (p: [number, number][]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb color. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** The three visible faces of a box (top, left-front, right-front) as polygons. */
export function boxFaces(x: number, y: number, z: number, w: number, d: number, h: number) {
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const left = [iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z)];
  const right = [iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z)];
  return { top: pts(top), left: pts(left), right: pts(right) };
}

/** Ellipse radii for a flat circle of radius r on the floor. */
export const isoCircle = (r: number) => ({ rx: r * S * CX * Math.SQRT2, ry: r * S * CY * Math.SQRT2 });

/** Stable small hash for picking looks. */
export const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const TEAM_COLOR: Record<string, string> = { all: '#5b7cfa', ecom: '#f29a2e', marketing: '#2fbf71', content: '#9b6cf2' };
export const TEAM_NAME: Record<string, string> = { all: 'HQ', ecom: 'E-commerce', marketing: 'Made by', content: 'Content' };

/** Small seeded random generator, so the starfield is the same every render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
