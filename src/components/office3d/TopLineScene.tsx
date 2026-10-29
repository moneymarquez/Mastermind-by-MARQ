import './office3d.css';
import Person, { Bubble } from './Person';
import { iso, shade, boxFaces } from './iso';
import type { TopTask } from '../../data/topTasks';

function Box({ x, y, z, w, d, h, color }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string }) {
  const f = boxFaces(x, y, z, w, d, h);
  return <g><polygon points={f.left} fill={shade(color, -0.18)} /><polygon points={f.right} fill={shade(color, -0.34)} /><polygon points={f.top} fill={color} /></g>;
}

/** The little scene for Today: you at your desk, your tasks lined up, #1 first. */
export default function TopLineScene({ top, onOpen }: { top: TopTask[]; onOpen: (t: TopTask) => void }) {
  const W = 9, D = 5;
  const people = top.map((t, i) => ({ t, x: 2.6 + i * 1.25, y: 2.9 }));
  const [l] = iso(0, D), [r] = iso(W, 0), [, tp] = iso(0, 0, 3.2), [, b] = iso(W, D, -0.4);
  return (
    <div className="o3-stage" style={{ borderRadius: 14 }}>
      <svg viewBox={`${l - 10} ${tp - 10} ${r - l + 20} ${b - tp + 20}`} role="img" aria-label={`Your line: ${top.map((t) => `${t.rank}. ${t.title}`).join('; ')}`}>
        <Box x={0} y={0} z={-0.4} w={W} d={D} h={0.4} color="#4b4330" />
        <polygon points={boxFaces(0, 0, 0, W, D, 0).top} fill="#ffcc4d" opacity=".12" />
        <Box x={0} y={0} z={0} w={W} d={0.2} h={1.1} color="#a8892f" />
        <Box x={0} y={0} z={0} w={0.2} d={D} h={1.1} color="#8c7226" />
        <polygon points={boxFaces(2.1, 2.5, 0.01, 6.4, 0.9, 0).top} fill="rgba(255,204,77,.15)" stroke="rgba(255,204,77,.5)" strokeDasharray="4 5" />
        <g transform={`translate(${iso(0.9, 2.8)[0]} ${iso(0.9, 2.8)[1]})`}><Person seed="marq-owner" shirt="#ff5a36" pose="stand" /><g transform="translate(0 -60)"><rect x="-16" y="-10" width="32" height="15" rx="7.5" fill="#ff5a36" /><text x="0" y="1.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">YOU</text></g></g>
        <Box x={1.4} y={2.2} z={0} w={0.8} d={1.6} h={0.75} color="#d9c3a5" />
        {people.map(({ t, x, y }) => { const [px, py] = iso(x, y); return (
          <g key={`${t.kind}${t.id}`} transform={`translate(${px} ${py})`} className="o3-hit" onClick={() => onOpen(t)}>
            <rect x="-16" y="-78" width="32" height="82" fill="transparent" />
            <Person seed={`${t.kind}${t.id}`} shirt={t.rank === 1 ? '#ffcc4d' : '#ffe39a'} pose="raise" />
            <Bubble text={`#${t.rank}`} color={t.rank === 1 ? '#ff5a36' : '#ffcc4d'} y={-68} />
          </g>); })}
      </svg>
    </div>
  );
}

