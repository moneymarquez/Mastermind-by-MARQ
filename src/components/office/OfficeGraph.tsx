import { useMemo, useState } from 'react';

// The orchestrator chain as a live graph (brief §2.4). Self-contained and fed
// by a plain data shape (GraphData) so it can be restyled — Marq is sending
// an Obsidian-style "brain" reference — without touching the data layer.
// Plain SVG, no graph library: layoutGraph is pure and tested.

export type NodeKind = 'hq' | 'orchestrator' | 'worker';
export type NodeState = 'active' | 'idle' | 'amber' | 'red' | 'off';
export interface GraphNode { id: string; label: string; kind: NodeKind; domain: string; state: NodeState; parent?: string | null; meta?: string }
export interface GraphEdge { from: string; to: string; kind: 'reports' | 'handoff'; active?: boolean; label?: string }
export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }
export interface Placed extends GraphNode { x: number; y: number; r: number }

/** HQ on top, the domain orchestrators in a row, each one's workers fanned
 *  out beneath it. Deterministic for a given input. */
export function layoutGraph(d: GraphData, width: number, height: number): Placed[] {
  const out: Placed[] = [];
  const hq = d.nodes.find((n) => n.kind === 'hq');
  const orchs = d.nodes.filter((n) => n.kind === 'orchestrator');
  const cx = width / 2;
  if (hq) out.push({ ...hq, x: cx, y: height * 0.12, r: 30 });
  const rowY = height * 0.38;
  orchs.forEach((o, i) => {
    const x = orchs.length === 1 ? cx : width * (0.16 + (0.68 * i) / (orchs.length - 1));
    out.push({ ...o, x, y: rowY, r: 22 });
    const kids = d.nodes.filter((n) => n.kind === 'worker' && n.parent === o.id);
    const span = Math.min(Math.PI * 0.9, 0.42 * kids.length);
    const radius = Math.min(height * 0.42, width / (orchs.length * 2.1) + 40);
    kids.forEach((k, j) => {
      const a = Math.PI / 2 + (kids.length === 1 ? 0 : -span / 2 + (span * j) / (kids.length - 1));
      out.push({ ...k, x: x + Math.cos(a) * radius * 0.9, y: rowY + Math.sin(a) * radius, r: 12 });
    });
  });
  // Workers without a known parent float at the bottom.
  const loose = d.nodes.filter((n) => n.kind === 'worker' && !out.some((p) => p.id === n.id));
  loose.forEach((k, i) => out.push({ ...k, x: width * ((i + 1) / (loose.length + 1)), y: height * 0.92, r: 10 }));
  return out;
}

const COLOR: Record<NodeState, string> = { active: 'var(--accent)', idle: 'var(--text-tertiary)', amber: 'var(--warning)', red: 'var(--danger)', off: 'var(--border)' };

export default function OfficeGraph({ data, onPick, focusDomain, height = 420 }: { data: GraphData; onPick?: (n: GraphNode) => void; focusDomain?: string; height?: number }) {
  const W = 1000;
  const placed = useMemo(() => layoutGraph(data, W, height), [data, height]);
  const at = (id: string) => placed.find((p) => p.id === id);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 16, border: '1px solid var(--border)', background: 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 7%, var(--surface)) 0%, var(--surface) 70%)', overflow: 'hidden' }}>
      <style>{`@keyframes ogPulse{0%{r:var(--r0);opacity:.55}100%{r:calc(var(--r0)*2.2);opacity:0}} @keyframes ogFlow{to{stroke-dashoffset:-24}} @media (prefers-reduced-motion: reduce){.og-pulse,.og-flow{animation:none!important}}`}</style>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Orchestrators and workers, live">
        {data.edges.map((e, i) => {
          const a = at(e.from), b = at(e.to);
          if (!a || !b) return null;
          const dim = focusDomain && a.domain !== focusDomain && b.domain !== focusDomain && a.kind !== 'hq';
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - (e.kind === 'handoff' ? 40 : 0) };
          return (
            <g key={i} opacity={dim ? 0.25 : 1}>
              <path d={`M${a.x},${a.y} Q${mid.x},${mid.y} ${b.x},${b.y}`} fill="none" stroke={e.kind === 'handoff' ? 'var(--accent)' : 'var(--border)'} strokeWidth={e.kind === 'handoff' ? 2 : 1.2} strokeDasharray={e.active || e.kind === 'handoff' ? '6 6' : undefined} className={e.active ? 'og-flow' : undefined} style={e.active ? { animation: 'ogFlow 1.2s linear infinite' } : undefined} />
              {e.label && <text x={mid.x} y={mid.y - 4} textAnchor="middle" fontSize={11} fill="var(--text-tertiary)">{e.label}</text>}
            </g>
          );
        })}
        {placed.map((n) => {
          const dim = focusDomain && n.domain !== focusDomain && n.kind !== 'hq';
          const c = COLOR[n.state];
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim ? 0.35 : 1} style={{ cursor: onPick ? 'pointer' : 'default' }} onClick={() => onPick?.(n)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} tabIndex={0} role="button" aria-label={`${n.label}: ${n.state}`} onKeyDown={(e) => { if (e.key === 'Enter') onPick?.(n); }}>
              {n.state === 'active' && <circle className="og-pulse" r={n.r} fill="none" stroke={c} strokeWidth={2} style={{ ['--r0' as string]: `${n.r}px`, animation: 'ogPulse 1.8s ease-out infinite' } as React.CSSProperties} />}
              <circle r={n.r} fill={n.kind === 'worker' ? 'var(--surface)' : `color-mix(in srgb, ${c} 16%, var(--surface))`} stroke={c} strokeWidth={n.kind === 'worker' ? 2 : 2.5} />
              {n.kind !== 'worker' && <text textAnchor="middle" dy={4} fontSize={n.kind === 'hq' ? 13 : 11} fontWeight={700} fill="var(--text)">{n.kind === 'hq' ? 'HQ' : n.label.split(' ')[0].slice(0, 4)}</text>}
              <text textAnchor="middle" y={n.r + 14} fontSize={n.kind === 'worker' ? 11 : 12.5} fontWeight={n.kind === 'worker' ? 500 : 600} fill={hover === n.id ? 'var(--text)' : 'var(--text-secondary)'}>{n.label}</text>
              {hover === n.id && n.meta && <text textAnchor="middle" y={n.r + 28} fontSize={11} fill="var(--text-tertiary)">{n.meta}</text>}
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 12, bottom: 10, display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
        {(['active', 'idle', 'amber', 'red', 'off'] as NodeState[]).map((s) => <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[s] }} />{s === 'active' ? 'running' : s}</span>)}
      </div>
    </div>
  );
}
