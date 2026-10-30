import { useState } from 'react';
import { useScore } from '../../data/useScore';
import { band } from '../../data/aiScores';
import type { Check } from '../../data/aiScores';

const COLOR = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--danger)' } as const;
const LABEL: Record<string, string> = { logic: 'Logic', trust: 'Trust', on_target: 'On-target' };
const WHAT: Record<string, string> = { logic: 'the numbers make sense', trust: 'the research is real', on_target: 'it matches what was asked' };

/** The three scores on an AI card: Logic, Trust, On-target, plus the overall
 *  (the lowest) shown big. Tap a pill for the checks that passed and failed. */
export default function ScorePills({ type, id, compact }: { type: string; id: string | null | undefined; compact?: boolean }) {
  const s = useScore(type, id);
  const [open, setOpen] = useState<string | null>(null);
  if (!id) return null;
  if (!s) return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Scoring…</span>;
  const pill = (k: 'logic' | 'trust' | 'on_target') => {
    const v = s[k];
    const b = band(v);
    return (
      <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setOpen(open === k ? null : k); }} title={`${LABEL[k]}: ${WHAT[k]}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          border: `1px solid ${b ? `color-mix(in srgb, ${COLOR[b]} 45%, transparent)` : 'var(--border)'}`, background: b ? `color-mix(in srgb, ${COLOR[b]} 14%, transparent)` : 'transparent', color: b ? COLOR[b] : 'var(--text-tertiary)' }}>
        {LABEL[k]} {v ?? '—'}
      </button>
    );
  };
  const ob = band(s.overall);
  const checks: Check[] = open ? ((s.checks as Record<string, Check[]>)[open] ?? []) : [];
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span title="Trust Score: the lowest of the three" style={{ fontSize: compact ? 15 : 20, fontWeight: 700, letterSpacing: '-0.02em', color: ob ? COLOR[ob] : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', marginRight: 2 }}>
          {s.overall ?? '—'}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>/100</span>
        </span>
        {pill('logic')}{pill('trust')}{pill('on_target')}
      </div>
      {open && (
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>{LABEL[open]}: {WHAT[open]}</span>
          {checks.length === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>Not checked for this kind of card.</span> : checks.map((c, i) => (
            <span key={i} style={{ color: 'var(--text-secondary)' }}><span style={{ color: c.pass ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{c.pass ? '✓' : '✗'}</span> {c.name}{c.why ? <span style={{ color: 'var(--text-tertiary)' }}> · {c.why}</span> : null}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** For an approve button: true when the card scores red and needs "Approve anyway". */
export function useNeedsConfirm(type: string, id: string | null | undefined): { red: boolean; overall: number | null } {
  const s = useScore(type, id);
  return { red: band(s?.overall) === 'red', overall: s?.overall ?? null };
}
