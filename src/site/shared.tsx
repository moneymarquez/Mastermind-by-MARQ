import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode, Ref } from 'react';

/** The design ships its styles as CSS strings; parsing them keeps every value
 *  identical to the file instead of hand-translating hundreds of properties.
 *  Cached per string, so each distinct style is parsed once. */
const cache = new Map<string, CSSProperties>();
export function S(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/^-webkit-/, 'Webkit-').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = val;
  }
  cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}

/** Where every link on the site goes. Pages marked `unbuilt` show the
 *  "Not built yet" page until they are designed. */
export const LINKS = {
  home: '/home',
  product: '/product',
  pricing: '/home#start',
  concepts: '/concepts',
  jobs: '/jobs',
  login: '/?login',
  signup: '/?signup',
  apply: '/apply',
  team: '/team',
  faq: '/home#faq',
  privacy: '/privacy',
  terms: '/terms',
  refund: '/refund',
  disclaimers: '/disclaimers',
  roadmap: '/roadmap',
};

export function useViewport() {
  const [w, setW] = useState(() => window.innerWidth);
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => { setW(window.innerWidth); setH(window.innerHeight); };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { w, h, mob: w < 700 };
}

export function useReducedMotion(): boolean {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [reduce, setReduce] = useState(() => !!q?.matches || new URLSearchParams(location.search).get('static') === '1');
  useEffect(() => {
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return reduce;
}

/** The stacked MA/RQ mark. */
export function Mark({ size = 32, bg, fg, transition }: { size?: number; bg: string; fg: string; transition?: boolean }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 8, background: bg, color: fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, lineHeight: '10px', transition: transition ? 'background .3s,color .3s' : undefined, flex: 'none' }}>
      <span>MA</span><span>RQ</span>
    </span>
  );
}

/** Floating nav. Its ink flips between dark and light from the section
 *  under it (data-nav on each section), driven by the page's frame loop or
 *  its own scroll listener. */
export function Nav({ mob, navRef, onHome }: { mob: boolean; navRef?: Ref<HTMLElement>; onHome?: boolean }) {
  const [menu, setMenu] = useState(false);
  const pricing = onHome ? '#start' : LINKS.pricing;
  return (
    <>
      <nav ref={navRef} aria-label="Main" style={S(`position:fixed; z-index:60; top:0; left:0; right:0; height:${mob ? '64px' : '80px'}; padding:0 ${mob ? '16px' : '40px'}; box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; gap:16px; color:var(--navc,#100f12); background:transparent; transition:color .3s; pointer-events:none;`)}>
        <a href={LINKS.home} aria-label="Masterminds home" style={S('pointer-events:auto; display:flex; align-items:center; gap:8px; color:inherit; white-space:nowrap;')}>
          <Mark bg="var(--navc,#100f12)" fg="var(--navi,#f2f5f9)" transition />
          <span style={S('display:flex; flex-direction:column; gap:1px;')}><span style={S('font-size:16px; font-weight:700; letter-spacing:-0.01em; line-height:17px;')}>Masterminds</span><span style={S('font-size:8.5px; font-weight:600; letter-spacing:.22em; line-height:10px; opacity:.72;')}>BY MARQ</span></span>
        </a>
        {!mob && (
          <div style={S('pointer-events:auto; display:flex; gap:8px; font-size:15px; font-weight:500; white-space:nowrap;')}>
            <a href={LINKS.product} className="lp-h-fade" style={S('color:inherit; padding:8px 16px;')}>Product</a>
            <a href={pricing} className="lp-h-fade" style={S('color:inherit; padding:8px 16px;')}>Pricing</a>
            <a href={LINKS.concepts} className="lp-h-fade" style={S('color:inherit; padding:8px 16px;')}>Concepts</a>
            <a href={LINKS.jobs} className="lp-h-fade" style={S('color:inherit; padding:8px 16px;')}>Jobs</a>
          </div>
        )}
        <div style={S('pointer-events:auto; display:flex; align-items:center; gap:8px; white-space:nowrap;')}>
          {!mob && <a href={LINKS.login} className="lp-h-fade" style={S('color:inherit; font-size:15px; font-weight:500; padding:8px 16px;')}>Log in</a>}
          <a href={pricing} className="lp-h-primary" style={S('background:#5266eb; color:#fff; font-size:15px; font-weight:500; height:40px; padding:0 20px; display:flex; align-items:center; border-radius:999px;')}>Free trial</a>
          {mob && (
            <button onClick={() => setMenu((v) => !v)} aria-label="Menu" aria-expanded={menu} style={S('width:44px; height:44px; border:none; background:transparent; color:inherit; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; cursor:pointer;')}>
              <span style={S('width:20px; height:1.5px; background:currentColor;')} /><span style={S('width:20px; height:1.5px; background:currentColor;')} />
            </button>
          )}
        </div>
      </nav>
      {mob && menu && (
        <div style={S('position:fixed; z-index:61; top:64px; left:16px; right:16px; background:#fff; border:1px solid #e3e3ea; border-radius:12px; padding:8px; display:flex; flex-direction:column;')}>
          {[['Product', LINKS.product], ['Pricing', pricing], ['Concepts', LINKS.concepts], ['Jobs', LINKS.jobs]].map(([l, h]) => (
            <a key={l} href={h} onClick={() => setMenu(false)} style={S('height:48px; padding:0 16px; display:flex; align-items:center; color:#100f12; font-size:17px; font-weight:500;')}>{l}</a>
          ))}
          <a href={LINKS.login} onClick={() => setMenu(false)} style={S('height:48px; padding:0 16px; display:flex; align-items:center; color:#100f12; font-size:17px; font-weight:500; border-top:1px solid #ececf1;')}>Log in</a>
        </div>
      )}
    </>
  );
}

/** Nav ink follows whichever data-nav section sits under it. */
export function updateNavInk(nav: HTMLElement | null) {
  if (!nav) return;
  let mode = 'ink';
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach((s) => {
    const b = s.getBoundingClientRect();
    if (b.top <= 40 && b.bottom > 40 && b.height > 60) mode = s.dataset.nav ?? 'ink';
  });
  nav.style.setProperty('--navc', mode === 'light' ? '#ededf3' : '#100f12');
  nav.style.setProperty('--navi', mode === 'light' ? '#171721' : '#f2f5f9');
}

export function Footer({ mob, onHome }: { mob: boolean; onHome?: boolean }) {
  const col = (title: string, links: [string, string][]) => (
    <div style={S('display:flex; flex-direction:column; gap:8px;')}>
      <span style={S('font-size:11px; letter-spacing:.14em; color:#8a8a98;')}>{title}</span>
      {links.map(([l, h]) => <a key={l} href={h} className="lp-h-ul" style={S('color:#ededf3;')}>{l}</a>)}
    </div>
  );
  return (
    <footer data-nav="light" style={S(`background:#171721; color:#ededf3; padding:${mob ? '48px 20px 96px' : '72px 64px 96px'};`)}>
      <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:48px;')}>
        <div style={S('display:flex; justify-content:space-between; gap:40px; flex-wrap:wrap;')}>
          <div style={S('display:flex; align-items:center; gap:8px;')}><Mark bg="#ededf3" fg="#171721" /><span style={S('font-size:16px; font-weight:700;')}>Masterminds</span></div>
          <div style={S('display:flex; gap:56px; flex-wrap:wrap; font-size:15px;')}>
            {col('PRODUCT', [['Product', LINKS.product], ['Pricing', onHome ? '#start' : LINKS.pricing], ['Concepts', LINKS.concepts], ['Jobs', LINKS.jobs]])}
            {col('HELP', [['Apply', LINKS.apply], ['FAQ', onHome ? '#faq' : LINKS.faq]])}
            {col('LEGAL', [['Privacy', LINKS.privacy], ['Terms', LINKS.terms], ['Refund', LINKS.refund], ['Disclaimers', LINKS.disclaimers]])}
          </div>
        </div>
        <span style={S('font-size:12px; color:#9a9aa8;')}>Masterminds by MARQ. Not medical or financial advice.</span>
      </div>
    </footer>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', color }}>{children}</span>;
}
