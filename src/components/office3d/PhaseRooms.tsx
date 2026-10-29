import type { ReactNode } from 'react';
import './office3d.css';
import { iso, pts, shade, boxFaces, hash, rng } from './iso';
import Person, { Bubble } from './Person';
import type { BoardItem, BoardStream, TopTask } from '../../data/board';

const R = 7, PER_ROOM = 6;
// Two rows that read left to right on screen: 1 · 2 · 3, then 4 · 5 · Waiting on you.
const SPOTS: [number, number][] = [[0, 0], [9, -9], [18, -18], [10, 10], [19, 1], [28, -8]];
const PHASE_COLOR = ['#5b7cfa', '#22b8cf', '#2fbf71', '#f29a2e', '#e8590c'];
const WAIT_COLOR = '#ffcc4d'; // your room

function Box({ x, y, z, w, d, h, color }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string }) {
  const f = boxFaces(x, y, z, w, d, h);
  return <g><polygon points={f.left} fill={shade(color, -0.18)} /><polygon points={f.right} fill={shade(color, -0.34)} /><polygon points={f.top} fill={color} /></g>;
}

/** Made by's pipeline as rooms. Each lead or client walks around the room
 *  for their phase with a name tag; the last room is everyone waiting on you,
 *  hands up. Tap anyone to see their stage and what's next. */
export default function PhaseRooms({ stream, onOpen }: { stream: BoardStream; onOpen: (item: BoardItem, phase: number | 'waiting' | 'top') => void }) {
  const rooms = [
    ...stream.columns.map((c, i) => ({ key: `p${c.phase}`, label: `${c.phase} · ${c.name}`, count: c.count, items: c.items.slice(0, PER_ROOM), color: PHASE_COLOR[i], phase: c.phase as number | 'waiting' })),
  ];
  const top: TopTask[] = stream.top ?? [];
  const all: { depth: number; el: ReactNode }[] = [];

  rooms.forEach((room, ri) => {
    const [ox, oy] = SPOTS[ri];
    const c = room.color;
    all.push({ depth: ox + oy - 0.5, el: (
      <g key={`f${room.key}`}>
        <Box x={ox} y={oy} z={-0.5} w={R} d={R} h={0.5} color={shade(c, -0.55)} />
        <polygon points={pts([iso(ox, oy), iso(ox + R, oy), iso(ox + R, oy + R), iso(ox, oy + R)])} fill={c} opacity=".18" />
        <Box x={ox} y={oy} z={0} w={R} d={0.2} h={1.2} color={shade(c, -0.15)} />
        <Box x={ox} y={oy} z={0} w={0.2} d={R} h={1.2} color={shade(c, -0.28)} />
      </g>
    ) });
    const rand = rng(hash(room.key));
    room.items.forEach((it, i) => {
      // Spread people over the floor on a loose grid, with a little jitter.
      const hx = ox + 2.0 + (i % 3) * 1.9 + rand() * 0.3 - Math.floor(i / 3) * 0.5, hy = oy + 2.4 + Math.floor(i / 3) * 2.3 + rand() * 0.3;
      const [px, py] = iso(hx, hy);
      const waiting = room.phase === 'waiting';
      const name = it.title.length > 18 ? `${it.title.slice(0, 17)}…` : it.title;
      const dur = 7 + (hash(it.id) % 6), delay = -((hash(it.id) >> 4) % 70) / 10;
      all.push({ depth: hx + hy, el: (
        <g key={`${room.key}${it.id}`} transform={`translate(${px} ${py})`}>
          <g className={`o3-hit${waiting ? '' : ` o3-wander${hash(it.id) % 2 ? ' o3-wander2' : ''}`}`} style={waiting ? undefined : ({ '--dur': `${dur}s`, '--delay': `${delay}s` } as React.CSSProperties)} onClick={(e) => { e.stopPropagation(); onOpen(it, room.phase); }}>
            <rect x="-16" y="-80" width="32" height="84" fill="transparent" />
            <Person seed={it.id} shirt={shade(c, 0.05)} pose={waiting ? 'raise' : 'walk'} />
            {waiting && <Bubble text="!" color={WAIT_COLOR} y={-68} />}
            <text x="0" y={waiting ? -86 : -54} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" stroke="rgba(10,12,24,.9)" strokeWidth="3" paintOrder="stroke">{name}</text>
          </g>
        </g>
      ) });
    });
    // Name card over the back corner.
    const [lx, ly] = iso(ox, oy, 2.4);
    const extra = room.count - room.items.length;
    const sub = room.count === 0 ? 'Empty' : `${room.count} ${room.phase === 'waiting' ? 'to decide' : room.count === 1 ? 'person' : 'people'}${extra > 0 ? ` · ${extra} more not shown` : ''}`;
    const cw = Math.max(120, Math.max(room.label.length * 7, sub.length * 5.3) + 30);
    all.push({ depth: 1000 + ox + oy, el: (
      <g key={`l${room.key}`} transform={`translate(${lx} ${ly})`}>
        <rect x={-cw / 2} y="-34" width={cw} height="34" rx="10" fill="rgba(14,17,32,.9)" stroke={c} strokeOpacity=".7" />
        <circle cx={-cw / 2 + 13} cy="-20" r="4" fill={c} />
        <text x={-cw / 2 + 22} y="-16" fontSize="12" fontWeight="700" fill="#fff">{room.label}</text>
        <text x={-cw / 2 + 22} y="-5" fontSize="9.5" fill="rgba(255,255,255,.65)">{sub}</text>
      </g>
    ) });
  });
  // Room 6: you at your desk, your five most important tasks lined up, #1 at the front.
  {
    const [ox, oy] = SPOTS[5], c = WAIT_COLOR;
    all.push({ depth: ox + oy - 0.5, el: (
      <g key="ftop">
        <Box x={ox} y={oy} z={-0.5} w={R} d={R} h={0.5} color={shade(c, -0.55)} />
        <polygon points={pts([iso(ox, oy), iso(ox + R, oy), iso(ox + R, oy + R), iso(ox, oy + R)])} fill={c} opacity=".18" />
        <Box x={ox} y={oy} z={0} w={R} d={0.2} h={1.2} color={shade(c, -0.15)} />
        <Box x={ox} y={oy} z={0} w={0.2} d={R} h={1.2} color={shade(c, -0.28)} />
        <polygon points={boxFaces(ox + 3.0, oy + 2.5, 0.01, 0.9, 4.6, 0).top} fill="rgba(255,204,77,.14)" stroke="rgba(255,204,77,.5)" strokeDasharray="4 5" />
      </g>
    ) });
    const [mx, my] = iso(ox + 3.4, oy + 1.0);
    all.push({ depth: ox + oy + 4.4, el: <g key="tme" transform={`translate(${mx} ${my})`}><Person seed="marq-owner" shirt="#ff5a36" pose="stand" /><g transform="translate(0 -60)"><rect x="-16" y="-10" width="32" height="15" rx="7.5" fill="#ff5a36" /><text x="0" y="1.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">YOU</text></g></g> });
    all.push({ depth: ox + oy + 5.6, el: <g key="tdesk"><Box x={ox + 2.4} y={oy + 1.5} z={0} w={2.0} d={0.8} h={0.75} color="#d9c3a5" /></g> });
    top.forEach((t, i) => {
      const hx = ox + 3.45, hy = oy + 2.9 + i * 0.97, [px, py] = iso(hx, hy);
      all.push({ depth: hx + hy, el: (
        <g key={`top${t.kind}${t.id}`} transform={`translate(${px} ${py})`} className="o3-hit" onClick={(e) => { e.stopPropagation(); onOpen(t, 'top'); }}>
          <rect x="-16" y="-80" width="32" height="84" fill="transparent" />
          <Person seed={`${t.kind}${t.id}`} shirt={t.rank === 1 ? '#ffcc4d' : '#ffe39a'} pose="raise" />
          <Bubble text={`#${t.rank}`} color={t.rank === 1 ? '#ff5a36' : '#ffcc4d'} y={-68} />
        </g>
      ) });
    });
    // Ranked list beside the line so every task reads in full.
    const [lx0, ly0] = iso(ox + R, oy + 0.6);
    all.push({ depth: 2000, el: (
      <g key="toplist">
        {top.map((t, i) => { const [px, py] = iso(ox + 3.45, oy + 2.9 + i * 0.97); const y = ly0 + i * 26; return (
          <g key={`tl${i}`} className="o3-hit" onClick={(e) => { e.stopPropagation(); onOpen(t, 'top'); }}>
            <line x1={px + 12} y1={py - 30} x2={lx0 + 8} y2={y - 4} stroke="rgba(255,204,77,.4)" strokeDasharray="2 3" />
            <text x={lx0 + 12} y={y} fontSize="10.5" fontWeight="700" fill="#fff" stroke="rgba(10,12,24,.9)" strokeWidth="3" paintOrder="stroke">{`${t.rank}. ${t.title.length > 26 ? `${t.title.slice(0, 25)}…` : t.title}`}</text>
            <text x={lx0 + 12} y={y + 11} fontSize="8.5" fill="rgba(255,255,255,.7)" stroke="rgba(10,12,24,.9)" strokeWidth="2.5" paintOrder="stroke">{t.reason}</text>
          </g>); })}
      </g>
    ) });
    const [lx, ly] = iso(ox, oy, 2.4);
    const sub = top.length ? `Ranked · ${stream.waiting.length} cards waiting` : 'Nothing urgent';
    all.push({ depth: 1000 + ox + oy, el: (
      <g key="ltop" transform={`translate(${lx} ${ly})`}>
        <rect x="-75" y="-34" width="150" height="34" rx="10" fill="rgba(14,17,32,.9)" stroke={c} strokeOpacity=".8" />
        <circle cx="-62" cy="-20" r="4" fill="#ff5a36" />
        <text x="-53" y="-16" fontSize="12" fontWeight="700" fill="#fff">Your top 5</text>
        <text x="-53" y="-5" fontSize="9.5" fill="rgba(255,255,255,.65)">{sub}</text>
      </g>
    ) });
  }
  all.sort((a, b) => a.depth - b.depth);

  const corners = [...SPOTS.flatMap(([x, y]) => [iso(x, y + R), iso(x + R, y), iso(x, y, 3.6), iso(x + R, y + R, -0.5)]), [iso(SPOTS[5][0] + R, SPOTS[5][1] + 0.6)[0] + 175, iso(SPOTS[5][0] + R, SPOTS[5][1] + 0.6)[1] + 5 * 26 + 10] as [number, number]];
  const l = Math.min(...corners.map((c) => c[0])), r = Math.max(...corners.map((c) => c[0])), t = Math.min(...corners.map((c) => c[1])), b = Math.max(...corners.map((c) => c[1]));
  return (
    <div className="o3-stage" style={{ marginTop: 4 }}>
      <svg viewBox={`${l - 40} ${t - 20} ${r - l + 80} ${b - t + 40}`} role="img" aria-label={`Made by phases: ${rooms.map((x) => `${x.label} ${x.count}`).join(', ')}; your top ${top.length}`}>
        {all.map((x) => x.el)}
      </svg>
    </div>
  );
}
