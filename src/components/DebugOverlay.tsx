import { useEffect, useState } from 'react';

interface Metrics {
  innerW: number;
  innerH: number;
  vvW: number | null;
  vvH: number | null;
  vvOffsetTop: number | null;
  vvScale: number | null;
  docClientH: number;
  standalone: boolean;
  dpr: number;
  safeBottom: number;
  safeTop: number;
  shineBgH: number | null;
  shineBgBottom: number | null;
  tabBarBottom: number | null;
}

// Reads env(safe-area-inset-*) by measuring a throwaway element rather than
// guessing — getComputedStyle on :root doesn't resolve env() directly, but
// an element that actually uses it in a real property does.
function measureSafeArea(side: 'top' | 'bottom'): number {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style[side === 'top' ? 'paddingTop' : 'paddingBottom'] = `env(safe-area-inset-${side})`;
  document.body.appendChild(el);
  const px = parseFloat(getComputedStyle(el)[side === 'top' ? 'paddingTop' : 'paddingBottom']) || 0;
  document.body.removeChild(el);
  return px;
}

function collect(): Metrics {
  const vv = window.visualViewport;
  const shineBg = document.querySelector('.app-shine-bg');
  const shineRect = shineBg?.getBoundingClientRect() ?? null;
  const tabBar = [...document.querySelectorAll('div')].find((d) => {
    const cs = getComputedStyle(d);
    return cs.position === 'absolute' && d.getBoundingClientRect().height > 60 && d.getBoundingClientRect().height < 140 && cs.bottom === '0px';
  });
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    vvW: vv?.width ?? null,
    vvH: vv?.height ?? null,
    vvOffsetTop: vv?.offsetTop ?? null,
    vvScale: vv?.scale ?? null,
    docClientH: document.documentElement.clientHeight,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
    dpr: window.devicePixelRatio,
    safeBottom: measureSafeArea('bottom'),
    safeTop: measureSafeArea('top'),
    shineBgH: shineRect ? Math.round(shineRect.height) : null,
    shineBgBottom: shineRect ? Math.round(shineRect.bottom) : null,
    tabBarBottom: tabBar ? Math.round(tabBar.getBoundingClientRect().bottom) : null,
  };
}

/** Temporary, owner-only diagnostic readout for tracking down the mobile
 *  "bottom of the screen cut off" report — real on-device numbers instead
 *  of guessing at what iOS is actually reporting. Delete once that's
 *  resolved; this isn't meant to ship long-term. */
export default function DebugOverlay() {
  const [m, setM] = useState<Metrics>(() => collect());

  useEffect(() => {
    const update = () => setM(collect());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed', top: 4, left: 4, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace', fontSize: 9,
        padding: '6px 8px', borderRadius: 6, lineHeight: 1.5, pointerEvents: 'none', whiteSpace: 'pre',
      }}
    >
      {`window: ${m.innerW}x${m.innerH}  dpr:${m.dpr}
docClientH: ${m.docClientH}
vv: ${m.vvW}x${m.vvH}  offsetTop:${m.vvOffsetTop}  scale:${m.vvScale}
standalone: ${m.standalone}
safeArea top:${m.safeTop} bottom:${m.safeBottom}
.app-shine-bg: h=${m.shineBgH} bottom=${m.shineBgBottom}
tabBar bottom edge: ${m.tabBarBottom}`}
    </div>
  );
}
