import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './office3d.css';
import { iso, pts, shade, boxFaces, isoCircle, rng, TEAM_COLOR, TEAM_NAME } from './iso';
import Person, { Bubble } from './Person';
import type { Pose } from './Person';
import type { BoardWorker } from '../../data/board';

const R = 11; // room size in world units
// Where each room's name card floats: over its outer corner, away from the hub.
const ROOMS: { d: string; x: number; y: number; label: [number, number, number] }[] = [
  { d: 'all', x: -16, y: -16, label: [-16, -16, 2.6] }, { d: 'ecom', x: 5, y: -16, label: [13.5, -16, 2.4] },
  { d: 'marketing', x: -16, y: 5, label: [-16, 13.5, 2.4] }, { d: 'content', x: 5, y: 5, label: [16, 16, -2.6] },
];
const FULL = { x: -660, y: -440, w: 1320, h: 900 };
type VB = typeof FULL;

/** A box drawn as three shaded faces. */
function Box({ x, y, z, w, d, h, color, children }: { x: number; y: number; z: number; w: number; d: number; h: number; color: string; children?: ReactNode }) {
  const f = boxFaces(x, y, z, w, d, h);
  return <g><polygon points={f.left} fill={shade(color, -0.18)} /><polygon points={f.right} fill={shade(color, -0.34)} /><polygon points={f.top} fill={color} />{children}</g>;
}

const deskSpot = (i: number) => ({ lx: 1.1 + (i % 3) * 3.2, ly: 1.7 + Math.floor(i / 3) * 2.7 });
const loungeSpot = (i: number) => ({ lx: 1.0 + (i % 9) * 1.15, ly: 9.9 - Math.floor(i / 9) * 0.6 });

/** Whole office, isometric: one raised room per team around the HQ brain.
 *  Workers type at their desk when running, stand in the front lounge when
 *  idle, and wave with a "!" when something is waiting on you. Tap a room
 *  to zoom in, tap a person for their job, last output and Trust Score. */
export default function IsoOffice({ workers, onOpen }: { workers: BoardWorker[]; onOpen: (w: BoardWorker) => void }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [vb, setVb] = useState<VB>(FULL);
  const anim = useRef(0);

  const target = useMemo<VB>(() => {
    const r = ROOMS.find((x) => x.d === focus);
    if (!r) return FULL;
    const [lx] = iso(r.x, r.y + R), [rx] = iso(r.x + R, r.y), [, ty] = iso(r.x, r.y, 4.5), [, by] = iso(r.x + R, r.y + R, -0.6);
    const pad = 24, w = rx - lx + pad * 2, h = by - ty + pad * 2;
    const k = Math.max(w / FULL.w, h / FULL.h); // keep the stage's aspect
    return { x: (lx + rx) / 2 - (FULL.w * k) / 2, y: (ty + by) / 2 - (FULL.h * k) / 2, w: FULL.w * k, h: FULL.h * k };
  }, [focus]);
  useEffect(() => {
    cancelAnimationFrame(anim.current);
    const from = vb, t0 = performance.now(), dur = 650;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      setVb({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(anim.current);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const stars = useMemo(() => { const r = rng(42); return Array.from({ length: 90 }, () => ({ x: FULL.x + r() * FULL.w, y: FULL.y + r() * FULL.h, r: 0.5 + r() * 1.1, o: 0.15 + r() * 0.5 })); }, []);
  const byRoom = (d: string) => workers.filter((w) => (w.domain === d || (d === 'all' && !ROOMS.some((r) => r.d === w.domain))));
  const working = workers.filter((w) => w.state === 'running').length;
  const ring = isoCircle(3.4), mid = isoCircle(2.5), core = isoCircle(1.2);

  const room = (r: (typeof ROOMS)[number]) => {
    const c = TEAM_COLOR[r.d], ws = byRoom(r.d).slice(0, 9);
    const idle = ws.filter((w) => w.state === 'idle');
    const items: { depth: number; el: ReactNode }[] = [];
    ws.forEach((w, i) => {
      const { lx, ly } = deskSpot(i), x = r.x + lx, y = r.y + ly, on = w.state === 'running';
      items.push({ depth: x + y - 1.2, el: <Box key={`ch${w.id}`} x={x + 0.65} y={y - 1.15} z={0} w={0.7} d={0.55} h={0.5} color="#2a2f45" /> });
      items.push({ depth: x + y + 0.5, el: (
        <g key={`dk${w.id}`}>
          <Box x={x} y={y} z={0} w={2.0} d={0.9} h={0.75} color="#e9e4da" />
          <Box x={x + 1.55} y={y + 0.05} z={0.75} w={0.28} d={0.75} h={0.62} color="#23283a" />
          <polygon className={on ? 'o3-screen-on' : undefined} points={boxFaces(x + 1.55, y + 0.05, 0.75, 0.28, 0.75, 0.62).right} fill={on ? '#7cd4ff' : w.state === 'error' ? '#ff6b6b' : '#39405a'} opacity={on ? 0.95 : 0.8} />
        </g>
      ) });
      const atDesk = w.state !== 'idle';
      const spot = atDesk ? { x: x + 1.0, y: y - 0.45 } : (() => { const l = loungeSpot(idle.indexOf(w)); return { x: r.x + l.lx, y: r.y + l.ly }; })();
      const [px, py] = iso(spot.x, spot.y);
      const pose: Pose = w.state === 'running' ? 'type' : w.state === 'waiting' ? 'raise' : w.state === 'error' ? 'stuck' : 'stand';
      items.push({ depth: spot.x + spot.y, el: (
        <g key={`p${w.id}`} className="o3-mover o3-hit" style={{ transform: `translate(${px}px, ${py}px)` }} onClick={(e) => { e.stopPropagation(); onOpen(w); }}>
          <rect x="-14" y="-60" width="28" height="64" fill="transparent" />
          <Person seed={w.key} shirt={shade(c, -0.05)} pose={pose} />
          {w.state === 'waiting' && <Bubble text={w.waiting > 1 ? `! ${w.waiting}` : '!'} color="#ffcc4d" />}
          {w.state === 'error' && <Bubble text="?" color="#ff7a7a" y={-56} />}
          {w.state === 'running' && <g className="o3-dots" transform="translate(0 -56)"><circle cx="-5" r="1.8" fill="#7cd4ff" /><circle cx="0" r="1.8" fill="#7cd4ff" /><circle cx="5" r="1.8" fill="#7cd4ff" /></g>}
        </g>
      ) });
    });
    // A plant in the back corner and one by the lounge.
    items.push({ depth: r.x + r.y + 21, el: <g key="plant2"><Box x={r.x + 10.1} y={r.y + 9.9} z={0} w={0.5} d={0.5} h={0.45} color="#c6845a" /><circle cx={iso(r.x + 10.35, r.y + 10.15, 0.95)[0]} cy={iso(r.x + 10.35, r.y + 10.15, 0.95)[1]} r="9" fill="#3fae6a" /></g> });
    items.sort((a, b) => a.depth - b.depth);
    const [lbx, lby] = iso(...r.label);
    const running = ws.filter((w) => w.state === 'running').length, waiting = ws.filter((w) => w.state === 'waiting').length;
    return (
      <g key={r.d} className="o3-hit" onClick={(e) => { e.stopPropagation(); setFocus(focus === r.d ? null : r.d); }}>
        <Box x={r.x} y={r.y} z={-0.6} w={R} d={R} h={0.6} color={shade(c, -0.52)} />
        <polygon points={pts([iso(r.x, r.y), iso(r.x + R, r.y), iso(r.x + R, r.y + R), iso(r.x, r.y + R)])} fill={c} opacity=".16" />
        <polygon points={pts([iso(r.x + 0.5, r.y + 0.5), iso(r.x + R - 0.5, r.y + 0.5), iso(r.x + R - 0.5, r.y + 8.7), iso(r.x + 0.5, r.y + 8.7)])} fill="none" stroke="rgba(255,255,255,.22)" strokeDasharray="4 5" />
        <Box x={r.x} y={r.y} z={0} w={R} d={0.25} h={1.6} color={shade(c, -0.1)} />
        <Box x={r.x} y={r.y} z={0} w={0.25} d={R} h={1.6} color={shade(c, -0.22)} />
        {items.map((i) => i.el)}
        {(() => { const sub = `${ws.length} agents · ${running} working${waiting ? ` · ${waiting} waiting` : ''}`; const cw = Math.max(130, sub.length * 5.3 + 34); return (
          <g transform={`translate(${lbx} ${lby})`}>
            <rect x={-cw / 2} y="-34" width={cw} height="34" rx="10" fill="rgba(14,17,32,.88)" stroke={c} strokeOpacity=".55" />
            <circle cx={-cw / 2 + 14} cy="-20" r="4" fill={c} />
            <text x={-cw / 2 + 23} y="-16" fontSize="12.5" fontWeight="700" fill="#fff">{TEAM_NAME[r.d]}</text>
            <text x={-cw / 2 + 23} y="-5" fontSize="9.5" fill="rgba(255,255,255,.65)">{sub}</text>
          </g>); })()}
      </g>
    );
  };

  const hubAt = iso(0, 0);
  const roads = ROOMS.map((r) => {
    const [ex, ey] = iso(r.x + R / 2, r.y + R / 2);
    return { d: r.d, path: `M${hubAt[0]},${hubAt[1]} L${ex},${ey}`, live: byRoom(r.d).some((w) => w.state === 'running') };
  });
  const [bx, by] = iso(0, 0, 3.2);
  const back = ROOMS.slice(0, 3), front = ROOMS.slice(3);
  return (
    <div>
      <div className="o3-stage" onClick={() => setFocus(null)}>
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={`Office: ${workers.length} workers, ${working} working`}>
          <defs>
            <radialGradient id="o3core"><stop offset="0" stopColor="#c9f1ff" /><stop offset=".45" stopColor="#5fc8ff" stopOpacity=".85" /><stop offset="1" stopColor="#2a6dff" stopOpacity="0" /></radialGradient>
            <linearGradient id="o3beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#8fe0ff" stopOpacity=".9" /><stop offset="1" stopColor="#8fe0ff" stopOpacity="0" /></linearGradient>
          </defs>
          {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />)}
          {roads.map((r) => (
            <g key={r.d}>
              <path d={r.path} stroke="rgba(255,255,255,.07)" strokeWidth="14" strokeLinecap="round" />
              <path className="o3-road" d={r.path} stroke={TEAM_COLOR[r.d]} strokeOpacity={r.live ? 0.9 : 0.35} strokeWidth="2" fill="none" />
              {r.live && <circle r="3.5" fill="#bdf0ff"><animateMotion dur="1.8s" repeatCount="indefinite" path={r.path} /></circle>}
            </g>
          ))}
          {back.map(room)}
          <g>
            <ellipse cx={hubAt[0]} cy={hubAt[1]} rx={ring.rx} ry={ring.ry} fill="#141a33" stroke="rgba(143,224,255,.35)" />
            <ellipse cx={hubAt[0]} cy={hubAt[1]} rx={mid.rx} ry={mid.ry} fill="none" stroke="rgba(143,224,255,.5)" strokeDasharray="3 6" />
            <ellipse className="o3-ring" cx={hubAt[0]} cy={hubAt[1]} rx={mid.rx} ry={mid.ry} fill="none" stroke="#8fe0ff" strokeWidth="1.5" />
            <ellipse className="o3-ring o3-ring2" cx={hubAt[0]} cy={hubAt[1]} rx={mid.rx} ry={mid.ry} fill="none" stroke="#8fe0ff" strokeWidth="1.5" />
            <ellipse cx={hubAt[0]} cy={hubAt[1]} rx={core.rx} ry={core.ry} fill="url(#o3core)" />
            <rect x={hubAt[0] - 7} y={by} width="14" height={hubAt[1] - by} fill="url(#o3beam)" />
            <circle className="o3-orb" cx={bx} cy={by} r="13" fill="url(#o3core)" />
            <g transform={`translate(${bx + 100} ${by + 16})`}>
              <rect x="-66" y="-30" width="132" height="32" rx="10" fill="rgba(14,17,32,.88)" stroke="rgba(143,224,255,.5)" />
              <text x="0" y="-15" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1.5" fill="#fff">THE BRAIN</text>
              <text x="0" y="-3" textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,.65)">{workers.length} agents · {working} working</text>
            </g>
          </g>
          {front.map(room)}
        </svg>
        {focus && <button className="mm-btn" style={{ position: 'absolute', top: 10, left: 10, height: 32, background: 'rgba(14,17,32,.85)', color: '#fff', border: '1px solid rgba(255,255,255,.15)' }} onClick={(e) => { e.stopPropagation(); setFocus(null); }}>← Whole office</button>}
      </div>
      {!focus && <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>Tap a room to zoom in · tap anyone to see their work</span>}
      {focus && (
        <div className="o3-panel">
          {byRoom(focus).map((w) => (
            <button key={w.id} className="o3-row" onClick={() => onOpen(w)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: w.state === 'running' ? 'var(--success)' : w.state === 'waiting' ? 'var(--warning)' : w.state === 'error' ? 'var(--danger)' : 'var(--text-tertiary)' }} />
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontWeight: 600 }}>{w.name}</strong><span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.state === 'running' ? (w.job ?? 'Working') : w.state === 'waiting' ? `${w.waiting} waiting on you` : w.state === 'error' ? 'Last run failed' : (w.lastOutput ?? 'Idle')}</span></span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: w.trust == null ? 'var(--text-tertiary)' : w.trust >= 85 ? 'var(--success)' : w.trust >= 60 ? 'var(--warning)' : 'var(--danger)' }}>{w.trust ?? '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

