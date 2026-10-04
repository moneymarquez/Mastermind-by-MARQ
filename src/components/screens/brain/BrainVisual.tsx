import { useId } from 'react';
import './brain.css';
import type { Disc, RegionId, Scores } from '../../../data/brain';
import { REGIONS, regionRead } from '../../../data/brain';

export const TONE: Record<string, string> = { 'Runs hot': 'var(--warning)', 'Runs steady': 'var(--success)', 'Underused': 'var(--accent)' };
const LINKS: [RegionId, RegionId][] = [['prefrontal', 'basal'], ['basal', 'amygdala'], ['amygdala', 'hippocampus'], ['prefrontal', 'reward'], ['reward', 'amygdala'], ['basal', 'hippocampus'], ['reward', 'basal']];
// Map layout: spread across the cerebrum so nodes and labels never collide.
const POS: Record<RegionId, { x: number; y: number }> = { prefrontal: { x: 96, y: 108 }, basal: { x: 196, y: 92 }, reward: { x: 130, y: 166 }, amygdala: { x: 206, y: 162 }, hippocampus: { x: 270, y: 132 } };
const SHORT: Record<RegionId, string> = { prefrontal: 'Focus', amygdala: 'Reaction', hippocampus: 'Memory', basal: 'Habit', reward: 'Drive' };

/** The neural map: five regions as glowing nodes sized and tinted by your
 *  tendency, synapses carrying signals between them (faster where the
 *  tendency runs hotter). Labels stay relative, never percentages. */
export default function BrainVisual({ scores, primary, active, onSelect }: { scores: Scores; primary: Disc; active: RegionId | null; onSelect: (id: RegionId) => void }) {
  const uid = useId().replace(/:/g, '');
  const reads = Object.fromEntries(REGIONS.map((r) => [r.id, regionRead(r.id, scores, primary)])) as Record<RegionId, ReturnType<typeof regionRead>>;
  const at = (id: RegionId) => POS[id];
  const curve = (a: RegionId, b: RegionId) => { const p = at(a), q = at(b); return `M${p.x},${p.y} Q${(p.x + q.x) / 2 + 8},${(p.y + q.y) / 2 - 22} ${q.x},${q.y}`; };
  const dur = (a: RegionId, b: RegionId) => { const lv = Math.max(reads[a].level, reads[b].level); return lv >= 4 ? 1.6 : lv <= 2 ? 4.4 : 2.8; };
  return (
    <svg viewBox="0 0 340 260" className="brain-map" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Your five brain regions, tinted by tendency. Tap one to read it.">
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="48%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--surface-3)" />
          <stop offset="100%" stopColor="var(--surface-2)" />
        </linearGradient>
        {REGIONS.map((r) => (
          <radialGradient key={r.id} id={`${uid}-n-${r.id}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="35%" stopColor={TONE[reads[r.id].label]} />
            <stop offset="100%" stopColor={TONE[reads[r.id].label]} stopOpacity="0.75" />
          </radialGradient>
        ))}
      </defs>
      <ellipse cx="180" cy="135" rx="175" ry="130" fill={`url(#${uid}-glow)`} className="brain-breathe" />
      {/* Lateral view: cerebrum, cerebellum, brainstem. */}
      <path d="M232,214 C238,232 236,246 230,256 L216,256 C220,244 220,230 214,218 Z" fill={`url(#${uid}-fill)`} stroke="var(--border)" strokeWidth="1.2" />
      <path d="M232,206 C252,212 280,214 294,198 C306,184 302,166 288,160 C276,176 252,192 232,206 Z" fill={`url(#${uid}-fill)`} stroke="var(--border)" strokeWidth="1.2" />
      <path className="brain-shell" d="M58,148 C40,104 72,56 124,50 C156,30 214,30 250,56 C296,66 318,108 306,150 C300,180 278,198 246,204 C222,220 186,224 162,212 C124,222 84,204 72,180 C62,172 56,160 58,148 Z" fill={`url(#${uid}-fill)`} stroke="var(--border)" strokeWidth="1.5" />
      {/* Gyri: soft folds so it reads as a brain, not a blob. */}
      <g fill="none" stroke="var(--text-tertiary)" strokeOpacity="0.18" strokeWidth="1.4" strokeLinecap="round">
        <path d="M96,86 C110,76 124,90 140,80 C154,70 168,84 182,74" />
        <path d="M84,120 C100,108 118,124 132,112 C146,100 160,116 176,104 C190,94 206,108 222,98" />
        <path d="M206,64 C222,74 238,62 254,76 C268,86 282,80 292,96" />
        <path d="M232,120 C246,110 262,124 278,114 C290,108 298,120 300,132" />
        <path d="M90,160 C104,150 118,166 134,154" />
        <path d="M168,186 C182,176 198,190 214,180 C228,172 240,184 254,176" />
        <path d="M150,56 C144,96 152,150 166,210" strokeDasharray="2 5" strokeOpacity="0.25" />
      </g>
      {/* Synapses, with a spark riding each one. */}
      {LINKS.map(([a, b]) => {
        const d = curve(a, b), on = active === a || active === b;
        return (
          <g key={`${a}-${b}`}>
            <path d={d} className="brain-syn" data-on={on || undefined} style={{ animationDuration: `${dur(a, b)}s` }} />
            <circle r={on ? 2.6 : 1.8} fill={TONE[reads[a].label]} className="brain-spark">
              <animateMotion dur={`${dur(a, b) * 1.4}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        );
      })}
      {REGIONS.map((reg) => {
        const r = { ...reg, ...POS[reg.id] };
        const read = reads[r.id], tone = TONE[read.label], on = active === r.id;
        const rad = 10 + read.level * 2.4;
        const w = SHORT[r.id].length * 5.6 + 14;
        return (
          <g key={r.id} className="brain-node" data-active={on || undefined} onClick={() => onSelect(r.id)} role="button" aria-label={`${r.name}: ${read.label}`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(r.id); }}>
            <circle cx={r.x} cy={r.y} r={rad + 10} fill={tone} opacity="0.14" className="brain-pulse" style={{ animationDelay: `${(r.x % 7) * 0.2}s` }} />
            <circle cx={r.x} cy={r.y} r={rad + 4} fill="none" stroke={tone} strokeOpacity={on ? 0.9 : 0.35} strokeWidth={on ? 2 : 1} />
            <circle cx={r.x} cy={r.y} r={rad} fill={`url(#${uid}-n-${r.id})`} />
            <text x={r.x} y={r.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{read.level}</text>
            <rect x={r.x - w / 2} y={r.y + rad + 7} width={w} height="17" rx="8.5" fill="var(--surface)" stroke={on ? tone : 'var(--border)'} />
            <text x={r.x} y={r.y + rad + 19} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={on ? 'var(--text)' : 'var(--text-secondary)'}>{SHORT[r.id]}</text>
          </g>
        );
      })}
    </svg>
  );
}
