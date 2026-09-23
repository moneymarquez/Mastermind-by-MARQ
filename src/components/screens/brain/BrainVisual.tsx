import './brain.css';
import type { Disc, RegionId, Scores } from '../../../data/brain';
import { REGIONS, regionRead } from '../../../data/brain';

const TONE: Record<string, string> = { 'Runs hot': 'var(--warning)', 'Runs steady': 'var(--success)', 'Underused': 'var(--text-tertiary)' };

/** The interactive diagram. Five regions, signals between them, each
 *  region tinted by its tendency. Labels are relative ("runs hot"),
 *  never percentages — see brain.ts for why. */
export default function BrainVisual({ scores, primary, active, onSelect }: { scores: Scores; primary: Disc; active: RegionId | null; onSelect: (id: RegionId) => void }) {
  const reads = Object.fromEntries(REGIONS.map((r) => [r.id, regionRead(r.id, scores, primary)])) as Record<RegionId, ReturnType<typeof regionRead>>;
  const at = (id: RegionId) => REGIONS.find((r) => r.id === id)!;
  const links: [RegionId, RegionId][] = [['prefrontal', 'basal'], ['basal', 'amygdala'], ['amygdala', 'hippocampus'], ['prefrontal', 'reward'], ['reward', 'amygdala'], ['basal', 'hippocampus']];
  const speed = (a: RegionId, b: RegionId) => { const lv = Math.max(reads[a].level, reads[b].level); return lv >= 4 ? 'fast' : lv <= 2 ? 'slow' : 'normal'; };
  return (
    <svg viewBox="0 0 340 260" style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block' }} role="img" aria-label="Brain regions with your tendencies">
      {/* Outline: a lateral view, simplified. */}
      <path className="brain-outline" d="M60,150 C40,110 70,60 120,55 C150,35 210,35 245,60 C290,70 310,110 300,150 C295,185 265,210 230,212 C210,225 180,228 160,215 C120,225 80,205 70,180 C60,172 58,160 60,150 Z" />
      <path d="M150,60 C140,100 150,150 165,214" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" opacity="0.7" />
      {links.map(([a, b]) => {
        const p = at(a), q = at(b);
        return <path key={`${a}-${b}`} className="brain-signal" data-speed={speed(a, b)} d={`M${p.x},${p.y} Q${(p.x + q.x) / 2 + 10},${(p.y + q.y) / 2 - 14} ${q.x},${q.y}`} />;
      })}
      {REGIONS.map((r) => {
        const read = reads[r.id];
        const tone = TONE[read.label];
        const rad = 12 + read.level * 2.2;
        return (
          <g key={r.id} className="brain-region" data-active={active === r.id ? 'true' : 'false'} onClick={() => onSelect(r.id)}>
            <circle cx={r.x} cy={r.y} r={rad + 6} fill={tone} opacity={0.12} />
            <circle className="brain-ring" cx={r.x} cy={r.y} r={rad} fill="var(--surface)" stroke={tone} strokeWidth={1.5} />
            <text x={r.x} y={r.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)" style={{ fontFamily: 'var(--font-mono)' }}>{read.level}</text>
            <text x={r.x} y={r.y + rad + 14} textAnchor="middle" fontSize="9" fill="var(--text-secondary)" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>{r.name.split(' ')[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}
