import { useState } from 'react';
import { useHasAssessment } from '../../../data/useBrain';

const KEY = 'mm:brain-nudge';
const DAY = 86400000;

function readNudge(): { dismissedAt: number; times: number } {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') as { dismissedAt: number; times: number }; } catch { return { dismissedAt: 0, times: 0 }; }
}

/** One dismissible card on the home screen until the assessment is
 *  taken. Dismissed once, it comes back after three days; dismissed
 *  twice, it stops. */
export default function BrainNudgeCard({ onOpen }: { onOpen: () => void }) {
  const has = useHasAssessment();
  const [nudge, setNudge] = useState(readNudge);
  if (has !== false) return null;
  if (nudge.times >= 2) return null;
  if (nudge.times === 1 && Date.now() - nudge.dismissedAt < 3 * DAY) return null;
  const dismiss = () => {
    const next = { dismissedAt: Date.now(), times: nudge.times + 1 };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setNudge(next);
  };
  return (
    <div style={{ marginTop: 16, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 240px', fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5 }}>
        Head to the Brain tab and take the assessment — that's how Nova starts learning how you work.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onOpen} style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer' }}>Open Brain</button>
        <button onClick={dismiss} style={{ padding: '8px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-body-sm)', cursor: 'pointer' }}>Not now</button>
      </div>
    </div>
  );
}
