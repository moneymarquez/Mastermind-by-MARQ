import type { ReactNode } from 'react';
import './office3d.css';
import { iso, shade, boxFaces, TEAM_COLOR } from './iso';
import Person, { Bubble } from './Person';
import type { BoardWorker, QueueEntry } from '../../data/board';

const W = 18, D = 15;
const LINE_MAX = 7, SEATS = 16, STEP = 1.75;

function Box({ x, y, z, w, d, h, color }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string }) {
  const f = boxFaces(x, y, z, w, d, h);
  return <g><polygon points={f.left} fill={shade(color, -0.18)} /><polygon points={f.right} fill={shade(color, -0.34)} /><polygon points={f.top} fill={color} /></g>;
}

/** The Classroom line: everyone with something waiting on you stands in line
 *  at your desk with a hand up, longest-waiting at the front. Everyone else
 *  sits at a desk. Tap someone in line to see and decide what they need. */
export default function ClassroomLine({ queue, workers, onOpen }: { queue: QueueEntry[]; workers: BoardWorker[]; onOpen: (q: QueueEntry) => void }) {
  const inLine = queue.slice(0, LINE_MAX);
  const lineKeys = new Set(queue.map((q) => q.key));
  const seated = workers.filter((w) => !lineKeys.has(w.key)).slice(0, SEATS);
  const total = queue.reduce((s, q) => s + q.items.length, 0);
  const items: { depth: number; el: ReactNode }[] = [];

  // You, behind the front desk (back-left), facing the room.
  const [mx, my] = iso(2.5, 0.9);
  items.push({ depth: 3.4, el: <g key="me" transform={`translate(${mx} ${my})`}><Person seed="marq-owner" shirt="#ff5a36" pose="stand" /><g transform="translate(0 -60)"><rect x="-16" y="-10" width="32" height="15" rx="7.5" fill="#ff5a36" /><text x="0" y="1.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">YOU</text></g></g> });
  items.push({ depth: 4.5, el: <g key="tdesk"><Box x={1.2} y={1.4} z={0} w={2.6} d={1.1} h={0.8} color="#d9c3a5" /><Box x={1.5} y={1.6} z={0.8} w={0.9} d={0.6} h={0.06} color="#f5f5f5" /></g> });

  // The line runs from your desk toward the front of the room; the front of the line waited longest.
  inLine.forEach((q, i) => {
    const x = 2.5, y = 3.7 + i * STEP, [px, py] = iso(x, y), n = q.items.length;
    items.push({ depth: x + y, el: (
      <g key={`q${q.key}`} className="o3-mover o3-hit" style={{ transform: `translate(${px}px, ${py}px)` }} onClick={() => onOpen(q)}>
        <rect x="-14" y="-78" width="28" height="82" fill="transparent" />
        <Person seed={q.key} shirt={TEAM_COLOR[q.domain] ?? '#8a93a8'} pose="raise" />
        <Bubble text={String(n)} color={i === 0 ? '#ffcc4d' : '#ffe39a'} y={-70} />
      </g>
    ) });
  });

  // School desks with a chair for everyone not waiting on you.
  seated.forEach((w, i) => {
    const x = 6 + (i % 4) * 3.0, y = 2.2 + Math.floor(i / 4) * 3.0;
    items.push({ depth: x + y - 0.6, el: (
      <g key={`s${w.id}`}>
        <Box x={x - 0.05} y={y - 0.85} z={0} w={0.6} d={0.5} h={0.42} color="#39425e" />
        <Box x={x - 0.05} y={y - 0.9} z={0.42} w={0.6} d={0.1} h={0.55} color="#39425e" />
        <g className="o3-hit" transform={`translate(${iso(x + 0.25, y - 0.15)[0]} ${iso(x + 0.25, y - 0.15)[1]})`}><Person seed={w.key} shirt={TEAM_COLOR[w.domain] ?? '#8a93a8'} pose={w.state === 'running' ? 'type' : 'sit'} /></g>
        <Box x={x} y={y} z={0} w={1.2} d={0.8} h={0.7} color="#e9e4da" />
      </g>
    ) });
  });
  items.sort((a, b) => a.depth - b.depth);

  const [l] = iso(0, D), [r] = iso(W, 0), [, t] = iso(0, 0, 3.5), [, b] = iso(W, D, -0.6);
  // On a phone, frame the front of the room (you, the line, the first rows).
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px)').matches;
  const [wbx, wby] = narrow ? iso(3.4, 0, 3.6) : iso(10, 0, 2.9);
  const vb = narrow ? [l - 120, t - 30, (r - l) * 0.72 + 120, (b - t) * 0.62 + 30] : [l - 120, t - 30, r - l + 150, b - t + 60];
  return (
    <div className="o3-stage">
      <svg viewBox={vb.join(' ')} role="img" aria-label={`${queue.length} waiting in line, ${total} things to decide`}>
        <Box x={0} y={0} z={-0.6} w={W} d={D} h={0.6} color="#4b5d86" />
        {Array.from({ length: 10 }, (_, i) => <polygon key={i} points={boxFaces(0, i * 1.5, 0, W, 0.02, 0).top} fill="none" stroke="rgba(255,255,255,.05)" />)}
        <polygon points={boxFaces(1.6, 3.0, 0.01, 1.8, 11.8, 0).top} fill="rgba(255,204,77,.12)" stroke="rgba(255,204,77,.45)" strokeDasharray="4 5" />
        <Box x={0} y={0} z={0} w={W} d={0.25} h={2.2} color="#5a6c96" />
        <Box x={0} y={0} z={0} w={0.25} d={D} h={2.2} color="#4f6089" />
        <polygon points={boxFaces(6, 0.26, 0.7, 8, 0.01, 1.2).left} fill="#f4f6fb" stroke="#c9cfdb" />
        {items.map((i) => i.el)}
        {/* Name tags in a column to the left of the line, each with a leader to its person. */}
        {(() => { const colX = iso(2.5, 3.7 + (inLine.length - 1) * STEP)[0] - 34; return inLine.map((q, i) => { const [px, py] = iso(2.5, 3.7 + i * STEP); const ty = py - 32; return (
          <g key={`n${q.key}`} className="o3-hit" onClick={() => onOpen(q)}>
            <line x1={colX + 4} y1={ty - 3} x2={px - 12} y2={ty - 3} stroke="rgba(255,227,154,.45)" strokeDasharray="2 3" />
            <text x={colX} y={ty} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#fff" stroke="rgba(10,12,24,.9)" strokeWidth="3" paintOrder="stroke">{q.name.length > 20 ? `${q.name.slice(0, 19)}…` : q.name}</text>
          </g>); }); })()}
        <g transform={`translate(${wbx} ${wby})`}>
          <rect x="-84" y="-34" width="168" height="34" rx="10" fill="rgba(14,17,32,.88)" stroke="rgba(255,204,77,.6)" />
          <text x="0" y="-18" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff">{queue.length ? `${queue.length} in line · ${total} to decide` : 'Nobody waiting on you'}</text>
          <text x="0" y="-6" textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,.65)">{queue.length ? 'Front of the line has waited longest' : `${seated.length} at their desks`}</text>
        </g>
        {queue.length > LINE_MAX && <text x={iso(2.5, 3.7 + LINE_MAX * STEP)[0]} y={iso(2.5, 3.7 + LINE_MAX * STEP)[1]} fontSize="12" fontWeight="700" fill="#ffe39a">+{queue.length - LINE_MAX}</text>}
      </svg>
    </div>
  );
}
