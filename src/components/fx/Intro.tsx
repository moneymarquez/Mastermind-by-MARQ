import { useEffect, useState } from 'react';
import LaunchIntro from './LaunchIntro';
import ColdOpen from './ColdOpen';
import { getSkin, useSkin } from '../../data/useTheme';
import { onceToday, prefersReducedMotion } from '../../lib/motion';
import { onPreviewIntro } from '../../lib/fxEvents';

/** Decides which of the two openers run, in order: the launch sequence
 *  (once per home-screen launch), then the cold open (once per day).
 *  Both Cyberpunk-only; Simple never mounts either. previewIntro() lets
 *  the settings screen replay both on demand, on any device. */
const LAUNCH_KEY = 'mm:launched';

function isStandalone(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

type Phase = 'none' | 'launch' | 'cold';

function decide(): Phase {
  if (getSkin() !== 'cyberpunk' || prefersReducedMotion()) return 'none';
  let launched = true;
  try { launched = sessionStorage.getItem(LAUNCH_KEY) === '1'; sessionStorage.setItem(LAUNCH_KEY, '1'); } catch { /* private mode */ }
  if (isStandalone() && !launched) return 'launch';
  if (onceToday('cold-open')) return 'cold';
  return 'none';
}

export default function Intro({ name }: { name: string }) {
  const skin = useSkin();
  const [phase, setPhase] = useState<Phase>(decide);
  const [preview, setPreview] = useState(false);

  useEffect(() => onPreviewIntro(() => { setPreview(true); setPhase('launch'); }), []);

  if (skin !== 'cyberpunk' || phase === 'none') return null;
  if (phase === 'launch') {
    return <LaunchIntro onDone={() => setPhase(preview || onceToday('cold-open') ? 'cold' : 'none')} />;
  }
  return <ColdOpen name={name} onDone={() => { setPhase('none'); setPreview(false); }} />;
}
