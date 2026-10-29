import { hash } from './iso';

const SKIN = ['#f3d2b3', '#e8b892', '#c98e63', '#a46a43', '#7a4a2c', '#f6dcc4'];
const HAIR = ['#2b1d16', '#4a2f1d', '#7a4b26', '#c58b3f', '#1b1b1f', '#8e3b2a', '#d9c7a3'];
export type Pose = 'sit' | 'type' | 'stand' | 'raise' | 'stuck';

/** An original little office character, drawn upright at (0,0) = feet.
 *  Looks are picked from the name, so each worker always looks the same. */
export default function Person({ seed, shirt, pose, scale = 1 }: { seed: string; shirt: string; pose: Pose; scale?: number }) {
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length], style = (h >> 6) % 4;
  const seated = pose === 'sit' || pose === 'type' || pose === 'stuck';
  const y0 = seated ? -7 : 0; // sitting: body lower, legs hidden behind the desk
  return (
    <g transform={`scale(${scale})`}><g className={`o3-person o3-${pose}`}>
      <ellipse cx="0" cy="1" rx="9" ry="3.5" fill="rgba(0,0,0,.28)" />
      {seated && <rect x="-6" y="-14" width="12" height="7" rx="3" fill="#2d3346" />}
      {!seated && <>
        <rect x="-5" y="-14" width="4" height="14" rx="2" fill="#2d3346" />
        <rect x="1" y="-14" width="4" height="14" rx="2" fill="#2d3346" />
      </>}
      <g transform={`translate(0 ${y0})`}>
        {/* body */}
        <rect x="-7.5" y="-30" width="15" height="18" rx="6" fill={shirt} />
        <rect x="-7.5" y="-30" width="15" height="6" rx="3" fill="rgba(255,255,255,.14)" />
        {/* arms */}
        <rect className="o3-arm-l" x="-10.5" y="-28" width="4" height="13" rx="2" fill={shirt} />
        {pose === 'raise'
          ? <g className="o3-arm-up"><rect x="6.5" y="-46" width="4" height="18" rx="2" fill={shirt} /><circle cx="8.5" cy="-47" r="2.8" fill={skin} /></g>
          : <rect className="o3-arm-r" x="6.5" y="-28" width="4" height="13" rx="2" fill={shirt} />}
        {/* head */}
        <g className="o3-head">
          <circle cx="0" cy="-38" r="8" fill={skin} />
          {style === 0 && <path d="M-8 -39 a8 8 0 0 1 16 0 q-3 -3 -8 -3 q-5 0 -8 3z" fill={hair} />}
          {style === 1 && <><path d="M-8 -38 a8 8 0 0 1 16 0 l0 -2 q-8 -6 -16 0z" fill={hair} /><circle cx="0" cy="-47" r="3.5" fill={hair} /></>}
          {style === 2 && <path d="M-8.5 -37 q-1 -10 8.5 -10 q9.5 0 8.5 10 q-2 -5 -4 -5 q-2 2 -4.5 0 q-2.5 2 -4.5 0 q-2 0 -4 5z" fill={hair} />}
          {style === 3 && <><path d="M-8.5 -39 a8.5 8 0 0 1 17 0z" fill={hair} /><rect x="0" y="-40" width="11" height="2.6" rx="1.3" fill={hair} /></>}
          <circle cx="-2.8" cy="-37" r="1.1" fill="#1d1d24" />
          <circle cx="2.8" cy="-37" r="1.1" fill="#1d1d24" />
          {pose === 'stuck' ? <path d="M-2.5 -32.5 q2.5 -2 5 0" stroke="#1d1d24" strokeWidth="1" fill="none" /> : <path d="M-2.5 -33.5 q2.5 2 5 0" stroke="#1d1d24" strokeWidth="1" fill="none" />}
        </g>
      </g>
    </g></g>
  );
}

/** Speech bubble over a head: "!" waiting, "?" stuck, a count in the line. */
export function Bubble({ text, color, y = -62 }: { text: string; color: string; y?: number }) {
  const w = Math.max(16, text.length * 7 + 10);
  return (
    <g transform={`translate(0 ${y})`}><g className="o3-bubble">
      <rect x={-w / 2} y="-11" width={w} height="18" rx="9" fill={color} />
      <path d="M-3 7 L0 12 L3 7z" fill={color} />
      <text x="0" y="2.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#141420">{text}</text>
    </g></g>
  );
}
