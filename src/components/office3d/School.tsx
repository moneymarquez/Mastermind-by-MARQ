import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import './office3d.css';
import { iso, pts, shade, boxFaces, hash, rng } from './iso';
import Person, { Bubble } from './Person';
import type { BoardItem, BoardStream } from '../../data/board';
import type { TopTask } from '../../data/topTasks';

// One building: three rooms along the back, a hallway, three along the front.
// Phase 1-3 at the back, Phase 4-5 and your office at the front. Doors open
// onto the hallway; when someone moves to the next phase they walk out their
// door, down the hall and into the new room.
const W = 24, HALL0 = 7, HALL1 = 10, DEPTH = 17, PER_ROOM = 6;
type RoomKey = 1 | 2 | 3 | 4 | 5 | 'office';
const ROOMS: { key: RoomKey; x0: number; back: boolean; color: string }[] = [
  { key: 1, x0: 0, back: true, color: '#5b7cfa' }, { key: 2, x0: 8, back: true, color: '#22b8cf' }, { key: 3, x0: 16, back: true, color: '#2fbf71' },
  { key: 4, x0: 0, back: false, color: '#f29a2e' }, { key: 5, x0: 8, back: false, color: '#e8590c' }, { key: 'office', x0: 16, back: false, color: '#ffcc4d' },
];
const roomOf = (k: RoomKey) => ROOMS.find((r) => r.key === k)!;
const doorX = (k: RoomKey) => roomOf(k).x0 + 4;
const doorY = (k: RoomKey) => (roomOf(k).back ? HALL0 : HALL1);
const HALL_MID = (HALL0 + HALL1) / 2;

function Box({ x, y, z, w, d, h, color }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string }) {
  const f = boxFaces(x, y, z, w, d, h);
  return <g><polygon points={f.left} fill={shade(color, -0.18)} /><polygon points={f.right} fill={shade(color, -0.34)} /><polygon points={f.top} fill={color} /></g>;
}
const homeIn = (k: RoomKey, i: number, seed: string): [number, number] => {
  const r = roomOf(k), j = rng(hash(seed))() * 0.3;
  return [r.x0 + 1.6 + (i % 3) * 2.3 + j, (r.back ? 1.8 : HALL1 + 1.8) + Math.floor(i / 3) * 2.6 + j];
};
const keyOf = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

export default function School({ stream, top, onOpen, onOpenTop }: { stream: BoardStream; top: TopTask[]; onOpen: (item: BoardItem, phase: number) => void; onOpenTop: (t: TopTask) => void }) {
  // Everyone in a phase room, keyed by business name so a lead that becomes a
  // drafted email (a different row) is still the same person walking over.
  const people = useMemo(() => {
    const out: { key: string; item: BoardItem; room: RoomKey; home: [number, number]; color: string }[] = [];
    const seen = new Set<string>();
    for (const c of stream.columns) {
      const room = c.phase as RoomKey;
      c.items.slice(0, PER_ROOM).forEach((it, i) => {
        let k = keyOf(it.title); while (seen.has(k)) k += '+'; seen.add(k);
        out.push({ key: k, item: it, room, home: homeIn(room, i, k), color: roomOf(room).color });
      });
    }
    return out;
  }, [stream]);

  // Walk anyone whose room changed since the last refresh.
  const els = useRef(new Map<string, SVGGElement>());
  const prev = useRef(new Map<string, { room: RoomKey; home: [number, number] }>());
  useLayoutEffect(() => {
    for (const p of people) {
      const was = prev.current.get(p.key), el = els.current.get(p.key);
      if (was && was.room !== p.room && el && typeof el.animate === 'function') {
        const path: [number, number][] = [was.home, [doorX(was.room), doorY(was.room)], [doorX(was.room), HALL_MID], [doorX(p.room), HALL_MID], [doorX(p.room), doorY(p.room)], p.home];
        const frames = path.map(([x, y]) => { const [sx, sy] = iso(x, y); return { transform: `translate(${sx}px, ${sy}px)` }; });
        el.animate(frames, { duration: 900 * path.length, easing: 'linear' });
      }
    }
    prev.current = new Map(people.map((p) => [p.key, { room: p.room, home: p.home }]));
  }, [people]);

  const items: { depth: number; el: ReactNode }[] = [];
  // Walls, cut into 1-unit pieces so people sort correctly against them.
  const doorGap = (x: number) => [4, 12, 20].some((c) => Math.abs(x + 0.5 - c) < 1.0);
  for (let x = 0; x < W; x++) items.push({ depth: x + 0.5, el: <Box key={`wb${x}`} x={x} y={0} z={0} w={1} d={0.25} h={1.8} color="#56607e" /> });
  for (let y = 0; y < DEPTH; y++) items.push({ depth: y + 0.5, el: <Box key={`wl${y}`} x={0} y={y} z={0} w={0.25} d={1} h={1.8} color="#4a5370" /> });
  for (const px of [8, 16]) for (const [a, b] of [[0, HALL0], [HALL1, DEPTH]]) for (let y = a; y < b; y++) items.push({ depth: px + y + 0.5, el: <Box key={`wp${px}-${y}`} x={px - 0.1} y={y} z={0} w={0.2} d={1} h={1.0} color="#6b7594" /> });
  for (const wy of [HALL0, HALL1]) for (let x = 0; x < W; x++) if (!doorGap(x)) items.push({ depth: x + 0.5 + wy, el: <Box key={`wh${wy}-${x}`} x={x} y={wy - 0.1} z={0} w={1} d={0.2} h={1.0} color="#6b7594" /> });

  // People wandering their phase room.
  for (const p of people) {
    const [px, py] = iso(...p.home), h = hash(p.key);
    const name = p.item.title.length > 18 ? `${p.item.title.slice(0, 17)}…` : p.item.title;
    items.push({ depth: p.home[0] + p.home[1], el: (
      <g key={`p${p.key}`} ref={(el) => { if (el) els.current.set(p.key, el); else els.current.delete(p.key); }} style={{ transform: `translate(${px}px, ${py}px)` }}>
        <g className={`o3-hit o3-wander${h % 2 ? ' o3-wander2' : ''}`} style={{ '--dur': `${7 + (h % 6)}s`, '--delay': `${-((h >> 4) % 70) / 10}s` } as React.CSSProperties} onClick={(e) => { e.stopPropagation(); onOpen(p.item, p.room as number); }}>
          <rect x="-16" y="-70" width="32" height="74" fill="transparent" />
          <Person seed={p.key} shirt={shade(p.color, 0.05)} pose="walk" />
          <text x="0" y="-54" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" stroke="rgba(10,12,24,.9)" strokeWidth="3" paintOrder="stroke">{name}</text>
        </g>
      </g>
    ) });
  }

  // Your office: you at your desk, your most important tasks lined up, #1 first.
  const ox = 16;
  items.push({ depth: ox + 4 + HALL1 + 0.5, el: <g key="me" transform={`translate(${iso(ox + 4.3, HALL1 + 0.7)[0]} ${iso(ox + 4.3, HALL1 + 0.7)[1]})`}><Person seed="marq-owner" shirt="#ff5a36" pose="stand" /><g transform="translate(0 -60)"><rect x="-16" y="-10" width="32" height="15" rx="7.5" fill="#ff5a36" /><text x="0" y="1.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">YOU</text></g></g> });
  items.push({ depth: ox + 3.2 + HALL1 + 1.6, el: <Box key="mydesk" x={ox + 3.2} y={HALL1 + 1.2} z={0} w={2.2} d={0.8} h={0.75} color="#d9c3a5" /> });
  top.forEach((t, i) => {
    const x = ox + 4.3, y = HALL1 + 2.7 + i * 0.95, [px, py] = iso(x, y);
    items.push({ depth: x + y, el: (
      <g key={`t${t.kind}${t.id}`} transform={`translate(${px} ${py})`} className="o3-hit" onClick={(e) => { e.stopPropagation(); onOpenTop(t); }}>
        <rect x="-16" y="-80" width="32" height="84" fill="transparent" />
        <Person seed={`${t.kind}${t.id}`} shirt={t.rank === 1 ? '#ffcc4d' : '#ffe39a'} pose="raise" />
        <Bubble text={`#${t.rank}`} color={t.rank === 1 ? '#ff5a36' : '#ffcc4d'} y={-68} />
      </g>
    ) });
  });
  items.sort((a, b) => a.depth - b.depth);

  // Room signs and the ranked list sit on top of everything.
  const signs = ROOMS.map((r) => {
    const col = r.key === 'office' ? null : stream.columns.find((c) => c.phase === r.key);
    const title = r.key === 'office' ? 'Your office' : `${r.key} · ${col?.name ?? ''}`;
    const extra = col ? col.count - Math.min(col.items.length, PER_ROOM) : 0;
    const sub = r.key === 'office' ? `Top ${top.length} across everything` : !col?.count ? 'Empty' : `${col.count} ${col.count === 1 ? 'person' : 'people'}${extra > 0 ? ` · ${extra} more` : ''}`;
    const [sx, sy] = r.back ? iso(r.x0 + 0.4, 0.4, 2.7) : iso(r.x0 + 0.4, HALL1 + 0.3, 2.0);
    const cw = Math.max(118, Math.max(title.length * 7, sub.length * 5.3) + 30);
    return (
      <g key={`s${r.key}`} transform={`translate(${sx + cw / 2 - 20} ${sy})`}>
        <rect x={-cw / 2} y="-34" width={cw} height="34" rx="10" fill="rgba(14,17,32,.92)" stroke={r.color} strokeOpacity=".8" />
        <circle cx={-cw / 2 + 13} cy="-20" r="4" fill={r.key === 'office' ? '#ff5a36' : r.color} />
        <text x={-cw / 2 + 22} y="-16" fontSize="12" fontWeight="700" fill="#fff">{title}</text>
        <text x={-cw / 2 + 22} y="-5" fontSize="9.5" fill="rgba(255,255,255,.65)">{sub}</text>
      </g>
    );
  });
  const [lx0, ly0] = iso(W, HALL1 + 0.5);
  const list = top.map((t, i) => {
    const [px, py] = iso(ox + 4.3, HALL1 + 2.7 + i * 0.95), y = ly0 + 10 + i * 27, title = t.title.length > 30 ? `${t.title.slice(0, 29)}…` : t.title;
    return (
      <g key={`l${i}`} className="o3-hit" onClick={() => onOpenTop(t)}>
        <line x1={px + 12} y1={py - 30} x2={lx0 + 10} y2={y - 4} stroke="rgba(255,204,77,.4)" strokeDasharray="2 3" />
        <text x={lx0 + 14} y={y} fontSize="10.5" fontWeight="700" fill="#fff" stroke="rgba(10,12,24,.9)" strokeWidth="3" paintOrder="stroke">{`${t.rank}. ${title}`}</text>
        <text x={lx0 + 14} y={y + 11} fontSize="8.5" fill="rgba(255,255,255,.7)" stroke="rgba(10,12,24,.9)" strokeWidth="2.5" paintOrder="stroke">{`${t.area} · ${t.reason}`}</text>
      </g>
    );
  });

  const [l] = iso(0, DEPTH), [, t0] = iso(0, 0, 4), [, b0] = iso(W, DEPTH, -0.5);
  const r = lx0 + 235, b = Math.max(b0, ly0 + 10 + top.length * 27 + 10);
  return (
    <div className="o3-stage">
      <svg viewBox={`${l - 20} ${t0 - 10} ${r - l + 30} ${b - t0 + 20}`} role="img" aria-label={`Made by building: ${stream.columns.map((c) => `phase ${c.phase} ${c.name} ${c.count}`).join(', ')}; your top ${top.length}: ${top.map((x) => x.title).join('; ')}`}>
        <Box x={0} y={0} z={-0.5} w={W} d={DEPTH} h={0.5} color="#2a3150" />
        {ROOMS.map((r) => <polygon key={`f${r.key}`} points={pts([iso(r.x0, r.back ? 0 : HALL1), iso(r.x0 + 8, r.back ? 0 : HALL1), iso(r.x0 + 8, r.back ? HALL0 : DEPTH), iso(r.x0, r.back ? HALL0 : DEPTH)])} fill={shade(r.color, -0.45)} opacity=".9" />)}
        <polygon points={pts([iso(0, HALL0), iso(W, HALL0), iso(W, HALL1), iso(0, HALL1)])} fill="#3a4466" />
        <polyline points={pts([iso(0.5, HALL_MID), iso(W - 0.5, HALL_MID)])} stroke="rgba(255,255,255,.18)" strokeDasharray="6 8" fill="none" />
        {ROOMS.map((r) => <polygon key={`m${r.key}`} points={pts([iso(r.x0 + 3.2, doorY(r.key) + (r.back ? 0.1 : -0.5)), iso(r.x0 + 4.8, doorY(r.key) + (r.back ? 0.1 : -0.5)), iso(r.x0 + 4.8, doorY(r.key) + (r.back ? 0.5 : -0.1)), iso(r.x0 + 3.2, doorY(r.key) + (r.back ? 0.5 : -0.1))])} fill={r.color} opacity=".55" />)}
        <polygon points={boxFaces(ox + 3.8, HALL1 + 2.2, 0.01, 1.0, 4.9, 0).top} fill="rgba(255,204,77,.14)" stroke="rgba(255,204,77,.5)" strokeDasharray="4 5" />
        {items.map((i) => i.el)}
        {signs}
        {list}
      </svg>
    </div>
  );
}
