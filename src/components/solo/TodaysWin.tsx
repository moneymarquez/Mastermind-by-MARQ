import { useEffect, useState } from 'react';
import { findWins } from '../../data/wins';
import { winCard } from '../../data/feed';
import type { WinInput } from '../../data/feed';

/** "Today's win" on Home (brief Phase 6): the newest real win from the
 *  person's own data, shown within a couple of seconds of opening. */
export default function TodaysWin({ onShare }: { onShare?: () => void }) {
  const [win, setWin] = useState<WinInput | null>(null);
  useEffect(() => {
    let live = true;
    findWins().then((w) => { if (live) setWin(w[0] ?? null); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!win) return null;
  const c = winCard(win, false);
  return (
    <div className="mm-win" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--success) 35%, var(--border))', background: 'color-mix(in srgb, var(--success) 8%, var(--surface))' }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</span>
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Today's win</span><span style={{ fontSize: 15, fontWeight: 600 }}>{c.title}</span></span>
      {onShare && <button className="mm-btn" style={{ height: 32 }} onClick={onShare}>Share</button>}
    </div>
  );
}
