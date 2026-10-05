import { useEffect, useRef, useState } from 'react';
import { S, LINKS, Nav, Footer, useViewport, useReducedMotion, updateNavInk } from './shared';
import {
  HEADLINES, SUBLINE, UTILIZE_1, UTILIZE_2, WORK_WITH_1, WORK_WITH_2, SAMPLE_DO, SAMPLE_GOAL, FITS, FIRST_STEP, PLAN,
  repPanels, REP_CHECKED, CLIPS, CHAPTERS, PIPE, TASKS, WEEK, K_STATS, K_PIECES, OUTPUTS, SHOPS, DAY, FAQS,
} from './content';
import type { RepItem } from './content';

// Masterminds Home v3. The cover photograph is a sticky layer; scrolling
// pushes the camera into the laptop on the desk until its glass fills the
// viewport, and the rest of the page (Ask, What it replaces, the chapters)
// scrolls inside that screen. Reduced motion: the cover holds, then the
// screen crossfades in at full size.

/** The cover photo's size and the laptop glass inside it, in image pixels. */
const IW = 2688, IH = 1520;
const SCR = { l: 1305, t: 892, w: 67, h: 36 };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export default function Home() {
  const { h: vhState, mob: m } = useViewport();
  const still = useReducedMotion();
  const q = new URLSearchParams(location.search);
  const headline = HEADLINES[(q.get('h') as 'a' | 'b' | 'c') ?? 'a'] ?? HEADLINES.a;

  const navRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLSpanElement>(null);

  const [seats, setSeats] = useState<10 | 25 | 50>(10);
  const [tab, setTab] = useState<'Solo' | 'Pro' | 'Team' | 'E-commerce' | 'Content'>('Solo');
  const [more, setMore] = useState(false);
  const [faq, setFaq] = useState(-1);
  const [dayIdx, setDayIdx] = useState(0);
  const dayIdxRef = useRef(0);
  const stillRef = useRef(still);
  stillRef.current = still;

  // The pinned stage is sized in pixels to the *visible* screen, and every
  // measurement below reads the stage itself rather than window.innerHeight:
  // on iPad and iPhone Safari 100vh is taller than what's on screen while
  // the toolbars show, which pushed the logo band below the fold and threw
  // the laptop-glass math off the laptop.
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageH = () => stageRef.current?.clientHeight || window.innerHeight;
  /** Pins the stage to the height actually on screen (Safari's toolbars
   *  included). The photo and the laptop glass both read this same box. */
  const fitStage = () => {
    const el = stageRef.current;
    if (!el) return;
    const h = Math.round(window.innerHeight);
    if (el.style.height !== h + 'px') el.style.height = h + 'px';
  };
  const stageW = () => stageRef.current?.clientWidth || window.innerWidth;
  const Z = () => stageH() * 1.8;
  const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

  /** The pinned stretch is one screen, plus the push-in, plus however tall
   *  the content inside the laptop screen is. */
  const syncHeight = () => {
    const c = contentRef.current, wr = wrapRef.current;
    if (!c || !wr) return;
    const vh = stageH();
    wr.style.height = Math.round(vh + Z() + Math.max(0, c.offsetHeight - vh)) + 'px';
  };

  const frame = () => {
    const wrap = wrapRef.current, layer = layerRef.current, scr = screenRef.current, inner = innerRef.current, content = contentRef.current, hero = heroRef.current;
    if (!wrap || !layer || !scr || !inner || !content || !hero) return;
    const vw = stageW(), vh = stageH(), mob = vw < 700, st = stillRef.current;
    const z = Z(), scrolled = Math.max(0, -wrap.getBoundingClientRect().top), pz = clamp(scrolled / z);
    const maxIn = Math.max(0, content.offsetHeight - vh);

    // Where the laptop glass sits in the cover-fitted photo.
    const s0 = Math.max(vw / IW, vh / IH), ox = (vw - IW * s0) / 2, oy = (vh - IH * s0) / 2;
    const sw = SCR.w * s0, sh = SCR.h * s0, gx0 = ox + SCR.l * s0, gy0 = oy + SCR.t * s0;
    const cx = gx0 + sw / 2, cy = gy0 + sh / 2, Sc = Math.max(vw / sw, vh / sh) * 1.002;
    const k = st ? 0 : ease(pz), sc = Math.pow(Sc, k);
    const px = cx + (vw / 2 - cx) * k, py = cy + (vh / 2 - cy) * k;
    layer.style.transform = `translate3d(${px - cx * sc}px,${py - cy * sc}px,0) scale(${sc})`;
    // The photo is sized and placed from the same numbers as the laptop glass
    // (not by CSS object-fit), so the screen can never drift off the laptop.
    const img = imgRef.current;
    if (img) { img.style.left = ox + 'px'; img.style.top = oy + 'px'; img.style.width = IW * s0 + 'px'; img.style.height = IH * s0 + 'px'; }
    let gx = px - (sw * sc) / 2, gy = py - (sh * sc) / 2, gw = sw * sc, gh = sh * sc, op = 1;
    if (st && pz > 0.3) { gx = 0; gy = 0; gw = vw; gh = vh; op = clamp((pz - 0.3) / 0.25); }
    const L = Math.max(0, gx), T = Math.max(0, gy), R = Math.min(vw, gx + gw), B = Math.min(vh, gy + gh);
    const rw = Math.max(1, R - L), rh = Math.max(1, B - T);
    scr.style.left = L + 'px'; scr.style.top = T + 'px'; scr.style.width = rw + 'px'; scr.style.height = rh + 'px'; scr.style.opacity = String(op);
    const f = rw / vw;
    inner.style.width = vw + 'px'; inner.style.height = rh / f + 'px'; inner.style.transform = `scale(${f})`;
    content.style.transform = `translate3d(0,${-Math.min(maxIn, Math.max(0, scrolled - z))}px,0)`;

    // Cover copy shrinks to fit above the desk; the logo band never covers it.
    const stack = stackRef.current, band = bandRef.current;
    if (stack) {
      const navB = mob ? 64 : 80, limit = gy0 - (mob ? 16 : 24), nat = stack.offsetHeight || 1, avail = Math.max(80, limit - navB - 8);
      const fit = Math.min(1, avail / nat);
      stack.style.top = navB + 8 + Math.max(0, (avail - nat * fit) * 0.42) + 'px';
      stack.style.transform = `scale(${fit})`;
    }
    if (band) {
      // Always fully on screen at load; on short screens it tightens up and
      // may sit over the foot of the photo rather than drop below the fold.
      const short = vh < 780;
      band.style.paddingTop = short ? (mob ? '22px' : '26px') : '';
      band.style.background = short ? 'linear-gradient(180deg,rgba(23,23,33,0) 0%,rgba(23,23,33,.85) 22%,#171721 48%)' : '';
    }
    const hp = clamp(pz / 0.12);
    hero.style.opacity = String(1 - hp);
    hero.style.transform = st ? 'none' : `translate3d(0,${-hp * 100}px,0)`;
    hero.style.pointerEvents = hp > 0.9 ? 'none' : 'auto';
    hero.style.visibility = hp >= 1 ? 'hidden' : 'visible';

    // "Your day, one login": one stop per seventh of the pinned stretch.
    const day = dayRef.current;
    if (day && !st) {
      const dr = day.getBoundingClientRect(), dp = clamp(-dr.top / Math.max(1, dr.height - vh));
      const di = Math.min(6, Math.floor(dp * 7));
      if (di !== dayIdxRef.current) { dayIdxRef.current = di; setDayIdx(di); }
      if (progRef.current) progRef.current.style.height = `calc((100% - ${mob ? 8 : 16}px) * ${dp.toFixed(4)})`;
    }
    updateNavInk(navRef.current);
  };

  useEffect(() => {
    let raf = 0;
    const loop = () => { fitStage(); frame(); raf = requestAnimationFrame(loop); };
    fitStage();
    raf = requestAnimationFrame(loop);
    const onScroll = () => frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    syncHeight();
    // Fonts and the photo change heights after first paint.
    const ro = new ResizeObserver(() => syncHeight());
    if (contentRef.current) ro.observe(contentRef.current);
    // Landing on /home#start or #faq: the pinned stretch has to be sized first.
    const hash = location.hash;
    if (hash && hash.length > 1) setTimeout(() => { syncHeight(); document.querySelector(hash)?.scrollIntoView(); }, 120);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { syncHeight(); frame(); });

  // Chapter clips: only the most visible one plays, muted.
  useEffect(() => {
    const vs = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-clip]'));
    if (!vs.length) return;
    const ratios = new Map<HTMLVideoElement, number>();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => ratios.set(e.target as HTMLVideoElement, e.isIntersecting ? e.intersectionRatio : 0));
      let best: HTMLVideoElement | null = null, br = 0.35;
      ratios.forEach((r, v) => { if (r > br) { br = r; best = v; } });
      vs.forEach((v) => { if (v === best) { v.muted = true; v.play().catch(() => {}); } else v.pause(); });
    }, { threshold: [0, 0.2, 0.35, 0.5, 0.75, 1] });
    vs.forEach((v) => { v.muted = true; v.pause(); io.observe(v); });
    return () => io.disconnect();
  }, [still]);

  /** The goal box button lands on the sample answer inside the screen. */
  const showAnswer = () => {
    const wr = wrapRef.current, a = answerRef.current;
    if (!wr || !a) return;
    window.scrollTo({ top: top(wr) + Z() + a.offsetTop + 64, behavior: still ? 'auto' : 'smooth' });
  };

  const vh = vhState;
  const secPad = m ? '96px 20px 64px' : '128px 64px 128px';
  const sectionPad = m ? '72px 20px' : '128px 64px';
  const h2Size = m ? '36px' : '56px', cardPad = m ? '24px 16px' : '32px';
  const rowCols = m ? 'minmax(0,1fr) auto' : 'minmax(0,1fr) minmax(0,1.2fr) auto';
  const rowAreas = m ? '"prod price" "fn fn"' : '"fn prod price"';
  const logoSize = m ? '17px' : '24px', logoBox = m ? '20px' : '28px', wmSize = m ? '15px' : '20px';
  const dur1 = m ? '56s' : '70s', dur2 = m ? '67s' : '84s', bandGap = m ? '16px' : '24px';
  const phW = m ? Math.round(Math.min(200, vh * 0.46 * 0.485)) : Math.round(Math.min(320, (vh - 160) * 0.485));
  const phH = m ? Math.round(Math.min(412, vh * 0.46)) : Math.round(Math.min(660, vh - 160));
  const panels = repPanels(seats, more, { signup: LINKS.signup, team: LINKS.team, apply: LINKS.apply });
  const rep4 = <T,>(a: T[]) => [...a, ...a, ...a, ...a];
  const rep6 = <T,>(a: T[]) => [...a, ...a, ...a, ...a, ...a, ...a];
  const stops = DAY.map(([time, mod, line, c1, c2], i) => ({ time, mod, line, grad: `linear-gradient(165deg,${c1} 0%,${c2} 100%)`, on: i === dayIdx }));

  const repItem = (r: RepItem, i: number) => {
    if (r.kind === 'row') return <div key={i} style={S(`display:grid; grid-template-columns:${rowCols}; grid-template-areas:${rowAreas}; gap:2px 24px; align-items:baseline; padding:12px 0; border-bottom:1px solid #e2ddd2;`)}><span style={S('grid-area:fn; font-size:14px; color:#6b665c;')}>{r.fn}</span><span style={S('grid-area:prod; font-size:15px; font-weight:500; min-width:0;')}>{r.prod}</span><span style={S('grid-area:price; justify-self:end; text-align:right; font-size:15px; font-variant-numeric:tabular-nums; white-space:nowrap;')}>{r.price}</span></div>;
    if (r.kind === 'head') return <div key={i} style={S('padding:12px 0 8px; font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c; border-bottom:1px solid #e2ddd2; text-transform:uppercase;')}>{r.text}</div>;
    if (r.kind === 'hire') return <div key={i} style={S('display:flex; justify-content:space-between; align-items:baseline; gap:16px; padding:12px 0; border-bottom:1px solid #e2ddd2;')}><span style={S('font-size:15px; font-weight:500; min-width:0;')}>{r.fn}</span><span style={S('flex:none; max-width:46%; text-align:right; font-size:15px; font-variant-numeric:tabular-nums;')}>{r.price}</span></div>;
    if (r.kind === 'more') return <div key={i} style={S('display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #e2ddd2;')}><div style={S('display:flex; flex-direction:column; gap:2px;')}><span style={S('font-size:15px; font-weight:500;')}>More modules</span><span style={S('font-size:13px; color:#6b665c;')}>{r.note}</span></div><button onClick={() => setMore((v) => !v)} aria-expanded={more} style={S("height:32px; padding:0 16px; border:1px solid #1b1a17; border-radius:999px; background:transparent; color:#1b1a17; font-family:'Instrument Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer;")}>{more ? 'Hide' : 'Show'}</button></div>;
    return <div key={i} style={S(`display:grid; grid-template-columns:${rowCols}; grid-template-areas:${rowAreas}; gap:2px 24px; align-items:baseline; padding:12px 0; border-bottom:1px solid #e2ddd2; color:#8a8a96;`)}><span style={S('grid-area:fn; font-size:14px;')}>{r.fn}</span><span style={S('grid-area:prod; font-size:15px; font-weight:500; min-width:0;')}>{r.prod}</span><span style={S('grid-area:price; justify-self:end; display:flex; align-items:baseline; gap:8px; white-space:nowrap; font-size:14px;')}>Price to confirm<span style={S('padding:1px 6px; border:1px solid #d6d1c6; border-radius:4px; font-size:11px; color:#6b665c;')}>Not in total</span></span></div>;
  };

  return (
    <div style={S('position:relative; color:#100f12;')}>
      <Nav mob={m} navRef={navRef} onHome />

      {/* ── Cover + push-in. Everything up to the chapters lives inside the laptop screen. */}
      <div ref={wrapRef} data-nav="ink" style={S('position:relative; height:700vh;')}>
        <div ref={stageRef} style={S('position:sticky; top:0; height:100vh; overflow:hidden; background:#c9d2dc;')}>
          <div ref={layerRef} style={S('position:absolute; left:0; top:0; width:100%; height:100%; transform-origin:0 0; will-change:transform;')}>
            <picture>
              <source type="image/webp" srcSet="/site/cover-1344.webp 1344w, /site/cover-2688.webp 2688w" sizes="100vw" />
              <img ref={imgRef} src="/site/cover-2688.jpg" alt="A desk and chair alone on a mountain ledge above the clouds, a laptop open on the desk" fetchPriority="high" decoding="async" style={S('position:absolute; left:0; top:0; width:100%; height:100%; max-width:none; display:block; user-select:none;')} />
            </picture>
          </div>

          <div ref={screenRef} style={S('position:absolute; left:0; top:0; width:0; height:0; overflow:hidden; background:#dde7f1; will-change:left,top,width,height;')}>
            <div ref={innerRef} style={S('position:absolute; left:0; top:0; width:100%; height:100%; transform-origin:0 0; background:#dde7f1;')}>
              <div ref={contentRef} style={S('position:absolute; left:0; right:0; top:0; will-change:transform;')}>

                {/* Ask */}
                <section data-sec="ask" data-nav="ink" style={S(`background:#dde7f1; padding:${secPad}; padding-bottom:48px; box-sizing:border-box;`)}>
                  <div style={S('max-width:1040px; margin:0 auto; display:flex; flex-direction:column; gap:32px;')}>
                    <div style={S('display:flex; flex-direction:column; gap:16px;')}>
                      <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#5a6478;')}>ASK</span>
                      <h2 style={S(`margin:0; font-size:${h2Size}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance; color:#121826;`)}>Tell us what you do. We'll show you how it fits.</h2>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); showAnswer(); }} style={S(`background:#fff; border:1px solid #c9d4e2; border-radius:12px; padding:${cardPad}; display:grid; grid-template-columns:repeat(auto-fit,minmax(256px,1fr)); gap:16px 24px; align-items:end;`)}>
                      <label style={S('display:flex; flex-direction:column; gap:8px;')}><span style={S('font-size:14px; font-weight:600; color:#121826;')}>What do you do?</span><input defaultValue={SAMPLE_DO} style={S("height:48px; box-sizing:border-box; padding:0 16px; border:1px solid #c9d4e2; border-radius:8px; background:#fff; outline:none; font-family:'Instrument Sans',sans-serif; font-size:16px; color:#121826; min-width:0;")} /></label>
                      <label style={S('display:flex; flex-direction:column; gap:8px;')}><span style={S('font-size:14px; font-weight:600; color:#121826;')}>What is your biggest goal?</span><input defaultValue={SAMPLE_GOAL} style={S("height:48px; box-sizing:border-box; padding:0 16px; border:1px solid #c9d4e2; border-radius:8px; background:#fff; outline:none; font-family:'Instrument Sans',sans-serif; font-size:16px; color:#121826; min-width:0;")} /></label>
                      <button type="submit" className="lp-h-primary" style={S("grid-column:1 / -1; justify-self:start; height:48px; padding:0 24px; border:none; border-radius:999px; background:#5266eb; color:#fff; font-family:'Instrument Sans',sans-serif; font-size:16px; font-weight:500; cursor:pointer;")}>Show me how Masterminds fits</button>
                    </form>

                    <div ref={answerRef} style={S('display:flex; flex-direction:column; gap:16px;')}>
                      <div style={S('display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; padding-top:16px;')}><span style={S('font-size:24px; font-weight:500; letter-spacing:-0.02em; color:#121826;')}>Your results</span><span style={S("font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.08em; color:#5a6478;")}>ILLUSTRATIVE SAMPLE</span></div>
                      <div style={S(`background:#fff; border:1px solid #c9d4e2; border-radius:12px; padding:${cardPad}; display:flex; flex-direction:column; gap:16px;`)}>
                        <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#5a6478;')}>HOW MASTERMINDS FITS YOUR LIFE</span>
                        <div style={S('display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:0 32px;')}>
                          {FITS.map((f) => <div key={f.name} style={S('display:grid; grid-template-columns:136px minmax(0,1fr); gap:16px; align-items:baseline; padding:16px 0; border-top:1px solid #e3e8ef;')}><span style={S('font-size:15px; font-weight:600; color:#121826;')}>{f.name}</span><span style={S('font-size:15px; line-height:1.5; color:#3a4152;')}>{f.line}</span></div>)}
                        </div>
                      </div>
                      <div style={S('display:grid; grid-template-columns:repeat(auto-fit,minmax(296px,1fr)); gap:16px;')}>
                        <div style={S(`background:#121826; color:#eef2f8; border-radius:12px; padding:${cardPad}; display:flex; flex-direction:column; gap:16px;`)}>
                          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#a9b3c4;')}>YOUR BEST FIRST STEP</span>
                          <span style={S(`font-size:${m ? '20px' : '24px'}; line-height:1.3; font-weight:480; letter-spacing:-0.015em; text-wrap:pretty;`)}>{FIRST_STEP}</span>
                        </div>
                        <div style={S(`background:#fff; border:1px solid #c9d4e2; border-radius:12px; padding:${cardPad}; display:flex; flex-direction:column; gap:8px;`)}>
                          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#5a6478; padding-bottom:8px;')}>A SIMPLE PLAN</span>
                          {PLAN.map((s) => <div key={s.n} style={S('display:grid; grid-template-columns:32px minmax(0,1fr); gap:8px; align-items:baseline; padding:8px 0; border-top:1px solid #e3e8ef;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:12px; color:#5a6478;")}>{s.n}</span><span style={S('font-size:15px; line-height:1.5; color:#121826;')}>{s.text}</span></div>)}
                        </div>
                      </div>
                      <div style={S('border-top:1px solid #b9c6d6; border-bottom:1px solid #b9c6d6; padding:24px 0; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;')}>
                        <div style={S('display:flex; flex-direction:column; gap:8px; max-width:640px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#5a6478;')}>ALSO AVAILABLE</span><span style={S('font-size:15px; line-height:1.5; color:#121826;')}>Want your page posting while you're with clients? Content, Run by Marq, is a done-with-you service from Marq's team.</span></div>
                        <a href={LINKS.apply} className="lp-h-inv-navy" style={S('height:48px; padding:0 24px; display:flex; align-items:center; border-radius:999px; border:1px solid #121826; color:#121826; font-size:15px; font-weight:500;')}>Apply</a>
                      </div>
                      <div style={S('display:flex; flex-direction:column; gap:4px; font-size:12px; color:#3a4152;')}><span>A starting point, not a promise of results.</span><span>Not medical or financial advice.</span></div>
                    </div>
                  </div>
                </section>

                <div style={S('height:48px; background:linear-gradient(180deg,#dde7f1,#fbf9f4);')} />

                {/* What it replaces */}
                <section data-sec="replaces" data-nav="ink" style={S(`background:#fbf9f4; color:#1b1a17; border-top:1px solid #e2ddd2; padding:${m ? '64px 20px' : '48px 64px'}; box-sizing:border-box;`)}>
                  <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:16px;')}>
                    <div style={S('display:flex; justify-content:space-between; align-items:flex-end; gap:16px 48px; flex-wrap:wrap;')}>
                      <div style={S('display:flex; flex-direction:column; gap:16px; max-width:640px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>WHAT IT REPLACES</span><h2 style={S(`margin:0; font-size:${m ? '32px' : '44px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>Most people piece these tools together.</h2><p style={S(`margin:0; font-size:${m ? '16px' : '18px'}; line-height:1.4; color:#4a463f;`)}>Masterminds puts them in one system.</p></div>
                      <div role="tablist" aria-label="Plan" style={S('display:flex; border:1px solid #d6d1c6; border-radius:8px; overflow-x:auto; max-width:100%; flex-wrap:nowrap;')}>
                        {(['Solo', 'Pro', 'Team', 'E-commerce', 'Content'] as const).map((t, i) => (
                          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} style={S(`flex:none; height:40px; padding:0 16px; border:none; border-right:${i < 4 ? '1px solid #d6d1c6' : 'none'}; font-family:'Instrument Sans',sans-serif; font-size:15px; font-weight:500; cursor:pointer; white-space:nowrap; background:${t === tab ? '#1b1a17' : 'transparent'}; color:${t === tab ? '#fbf9f4' : '#1b1a17'};`)}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div style={S(`position:relative; height:${m ? '640px' : '424px'};`)}>
                      {panels.map((p) => {
                        const on = p.key === tab, hasDoes = !!p.does, sep = !hasDoes;
                        return (
                          <div key={p.key} role="tabpanel" aria-hidden={!on} style={S(`position:absolute; inset:0; display:flex; flex-direction:${m ? 'column' : 'row'}; gap:${m ? '16px' : '48px'}; opacity:${on ? 1 : 0}; pointer-events:${on ? 'auto' : 'none'}; transition:opacity .25s;`)}>
                            <div style={S('flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; border-top:1px solid #1b1a17;')}>
                              {p.hasSeats && (
                                <div style={S('flex:none; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:8px 0; border-bottom:1px solid #e2ddd2;')}><span style={S('font-size:14px; color:#6b665c;')}>Seats</span><div style={S('display:flex; border:1px solid #d6d1c6; border-radius:8px; overflow:hidden;')}>
                                  {([10, 25, 50] as const).map((s, i) => <button key={s} onClick={() => setSeats(s)} aria-pressed={s === seats} style={S(`height:32px; padding:0 16px; border:none; border-right:${i < 2 ? '1px solid #d6d1c6' : 'none'}; font-family:'Instrument Sans',sans-serif; font-size:14px; font-weight:500; cursor:pointer; background:${s === seats ? '#1b1a17' : 'transparent'}; color:${s === seats ? '#fbf9f4' : '#1b1a17'}; white-space:nowrap;`)}>{s} seats</button>)}
                                </div></div>
                              )}
                              <div style={S('flex:1; min-height:0; overflow-y:auto; padding-right:8px;')}>
                                <div style={S(`display:grid; grid-template-columns:${hasDoes && !m ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)'}; gap:0 32px; align-items:start;`)}>
                                  <div style={S('min-width:0;')}>{p.items.map(repItem)}</div>
                                  {hasDoes && (
                                    <div style={S('min-width:0;')}>
                                      <div style={S('padding:12px 0 8px; font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c; border-bottom:1px solid #e2ddd2; text-transform:uppercase;')}>What Masterminds does instead</div>
                                      {p.does!.map((d) => <div key={d.name} style={S('padding:12px 0; border-bottom:1px solid #e2ddd2; display:flex; flex-direction:column; gap:2px;')}><span style={S('font-size:15px; font-weight:600;')}>{d.name}</span><span style={S('font-size:14px; line-height:1.45; color:#4a463f;')}>{d.line}</span></div>)}
                                      <div style={S('padding:16px 0 8px; font-size:15px; line-height:1.45; font-weight:600;')}>{p.closing}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={S(`flex:none; width:${m ? 'auto' : '320px'}; display:flex; flex-direction:column; gap:8px; align-self:stretch;`)}>
                              <div style={S(`flex:1; min-height:0; box-sizing:border-box; border:1px solid #d6d1c6; border-radius:12px; background:#fff; padding:${m ? '16px' : '24px'}; display:flex; flex-direction:column; gap:12px;`)}>
                                <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>{p.eyebrow}</span>
                                <span style={S(`font-size:${m ? '32px' : '40px'}; line-height:1; font-weight:500; letter-spacing:-0.03em; color:#5266eb; font-variant-numeric:tabular-nums;`)}>{p.price}</span>
                                {sep && <div style={S('display:flex; flex-direction:column; gap:4px; padding-top:12px; border-top:1px solid #e2ddd2;')}><span style={S('font-size:13px; color:#6b665c;')}>{p.sepLabel}</span><span style={S(`font-size:${m ? '22px' : '24px'}; line-height:1.1; font-weight:500; letter-spacing:-0.02em; font-variant-numeric:tabular-nums;`)}>{p.total}</span><span style={S('font-size:12px; line-height:1.5; color:#6b665c;')}>{p.note}</span></div>}
                                {p.line && <span style={S('font-size:15px; line-height:1.5; color:#4a463f;')}>{p.line}</span>}
                                {p.live
                                  ? <a href={p.href} className="lp-h-primary" style={S(`margin-top:auto; align-self:${hasDoes ? 'flex-start' : 'stretch'}; padding:0 ${hasDoes ? '24px' : '0px'}; height:48px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#5266eb; color:#fff; font-size:16px; font-weight:500;`)}>{p.cta}</a>
                                  : <span aria-disabled="true" style={S('margin-top:auto; height:48px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#efebe2; color:#8a857b; font-size:16px; font-weight:500; cursor:not-allowed;')}>{p.cta}</span>}
                              </div>
                              {p.foot && <span style={S('font-size:12px; line-height:1.5; color:#6b665c;')}>{p.foot}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <span style={S('font-size:12px; line-height:1.5; color:#6b665c;')}>{REP_CHECKED}</span>
                  </div>
                </section>

                <div style={S('height:48px; background:linear-gradient(180deg,#fbf9f4,#171721);')} />

                {/* Chapters */}
                {CHAPTERS.map((c) => {
                  const clip = CLIPS[c.k], hasClip = !still && !!(clip.mp4 || clip.webm);
                  return (
                    <section key={c.k} data-sec={c.k} data-nav="light" style={S(`background:#171721; color:#ededf3; padding:${secPad}; box-sizing:border-box; border-bottom:1px solid #262633;`)}>
                      <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:48px;')}>
                        <div style={S('display:flex; gap:64px; flex-wrap:wrap; align-items:flex-start;')}>
                          <div style={S('flex:1 1 416px; min-width:0; display:flex; flex-direction:column; gap:24px;')}>
                            <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#9a9aa8;')}>{c.label}</span>
                            <h2 style={S(`margin:0; font-size:${h2Size}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>{c.title}</h2>
                            <p style={S('margin:0; font-size:18px; line-height:1.55; color:#b9b9c6; max-width:496px; text-wrap:pretty;')}>{c.body}</p>
                            <div style={S('display:flex; flex-direction:column; max-width:464px;')}>
                              {c.steps.map((s, i) => <div key={s} style={S('display:grid; grid-template-columns:40px minmax(0,1fr); align-items:baseline; padding:16px 0; border-top:1px solid #2c2c3a;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:12px; color:#8a8a98;")}>0{i + 1}</span><span style={S('font-size:18px; font-weight:500;')}>{s}</span></div>)}
                            </div>
                            {c.cta && <a href={LINKS.apply} className="lp-h-inv-ivory" style={S('align-self:flex-start; height:48px; padding:0 24px; display:flex; align-items:center; border-radius:999px; border:1px solid #ededf3; color:#ededf3; font-size:15px; font-weight:500;')}>Apply</a>}
                          </div>
                          <div style={S('flex:1 1 416px; min-width:0; display:flex; gap:24px; align-items:flex-start; justify-content:center; flex-wrap:wrap;')}>
                            <div style={S('flex:none; width:248px; height:512px; border-radius:44px; background:#0c0c11; border:1px solid #33333f; padding:8px; box-sizing:border-box;')}>
                              <div style={S(`position:relative; width:100%; height:100%; border-radius:36px; overflow:hidden; background:${c.grad};`)}>
                                <span style={S('position:absolute; top:12px; left:50%; transform:translateX(-50%); width:80px; height:24px; border-radius:999px; background:#0c0c11;')} />
                                {c.k === 'content' ? (
                                  <div style={S('position:absolute; inset:0; padding:56px 16px 16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px;')}>
                                    <span style={S('font-size:17px; font-weight:500; letter-spacing:-0.015em;')}>Content Creation</span>
                                    <div style={S('display:grid; grid-template-columns:1fr 1fr; gap:8px;')}>{K_STATS.map(([v, l]) => <div key={l} style={S('border:1px solid #3a3a48; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:4px;')}><span style={S('font-size:18px; font-weight:500; letter-spacing:-0.02em;')}>{v}</span><span style={S('font-size:10.5px; color:#a9a9b8;')}>{l}</span></div>)}</div>
                                    <div style={S('display:flex; flex-direction:column; border-top:1px solid #3a3a48;')}>{K_PIECES.map(([n, st, col]) => <div key={n} style={S('display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #3a3a48; font-size:12px;')}><span>{n}</span><span style={{ color: col }}>{st}</span></div>)}</div>
                                    <span style={S("margin-top:auto; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.08em; color:#a9a9b8;")}>EXAMPLE DATA</span>
                                  </div>
                                ) : <span style={S("position:absolute; left:16px; right:16px; bottom:16px; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#c9c9d6;")}>PLACEHOLDER · 9:16 video</span>}
                              </div>
                            </div>
                            <div style={S('flex:1 1 320px; min-width:0; display:flex; flex-direction:column; gap:8px;')}>
                              <div style={S('position:relative; width:100%; aspect-ratio:16 / 10; background:#070B0D; border:1px solid #1E2A31; border-radius:12px; overflow:hidden;')}>
                                {c.k === 'commerce' && (
                                  <div style={S('position:absolute; inset:0; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px;')}>
                                    <div style={S('display:flex; justify-content:space-between; align-items:center;')}><span style={S("font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:600; letter-spacing:.12em; color:#DCE6EA;")}>E-COMMERCE</span><span style={S('width:32px; height:4px; background:#22D3FF;')} /></div>
                                    <div style={S('display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:4px;')}>{PIPE.map((name, i) => <span key={name} style={S(`height:28px; box-sizing:border-box; padding:0 4px; display:flex; align-items:center; background:#0E1418; border:1px solid #1E2A31; border-left:3px solid ${i < 7 ? '#22D3FF' : '#1E2A31'}; font-family:'IBM Plex Mono',monospace; font-size:7.5px; color:${i < 7 ? '#c5d1d6' : '#6c7a82'}; overflow:hidden; white-space:nowrap;`)}>{name}</span>)}</div>
                                    <div style={S('margin-top:auto; display:flex; flex-direction:column; gap:8px;')}><div style={S("display:flex; justify-content:space-between; font-family:'IBM Plex Mono',monospace; font-size:9px; color:#9fb0b8;")}><span>ORDER COMING IN</span><span>REVENUE</span></div><div style={S('height:6px; background:#1E2A31;')}><div style={S('height:100%; width:62%; background:#2BFF88;')} /></div></div>
                                  </div>
                                )}
                                {c.k === 'everyday' && (
                                  <div style={S('position:absolute; inset:0; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px;')}>
                                    <div style={S('display:flex; justify-content:space-between; align-items:center;')}><span style={S("font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:600; letter-spacing:.12em; color:#DCE6EA;")}>DAILY PLAN</span><span style={S('width:32px; height:4px; background:#22D3FF;')} /></div>
                                    <div style={S('display:flex; flex-direction:column; gap:4px;')}>{TASKS.map(([name, on]) => <div key={name} style={S('height:28px; box-sizing:border-box; display:flex; align-items:center; gap:8px; padding:0 8px; background:#0E1418; border:1px solid #1E2A31;')}><span style={S(`width:10px; height:10px; box-sizing:border-box; border:1px solid #44525a; background:${on ? '#2BFF88' : 'transparent'};`)} /><span style={S(`font-family:'IBM Plex Mono',monospace; font-size:9px; color:#c5d1d6; text-decoration:${on ? 'line-through' : 'none'};`)}>{name}</span></div>)}</div>
                                    <div style={S('display:flex; gap:4px;')}>{['Schedule', 'Macros & Meals', 'Weekly Review'].map((t) => <span key={t} style={S("padding:3px 8px; border:1px solid #1E2A31; font-family:'IBM Plex Mono',monospace; font-size:8px; color:#9fb0b8;")}>{t}</span>)}</div>
                                    <div style={S('margin-top:auto; display:flex; flex-direction:column; gap:8px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:9px; color:#9fb0b8;")}>LEFT TODAY</span><div style={S('height:6px; background:#1E2A31;')}><div style={S('height:100%; width:44%; background:#FFB020;')} /></div></div>
                                  </div>
                                )}
                                {c.k === 'content' && (
                                  <div style={S('position:absolute; inset:0; padding:16px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px;')}>
                                    <div style={S('display:flex; justify-content:space-between; align-items:center;')}><span style={S("font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:600; letter-spacing:.12em; color:#DCE6EA;")}>CONTENT CREATION</span><div style={S("display:flex; gap:8px; font-family:'IBM Plex Mono',monospace; font-size:8px; color:#9fb0b8;")}><span>Drafting</span><span>Ready</span><span>Posted</span></div></div>
                                    <div style={S('display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:4px;')}>{WEEK.map((d, i) => <div key={i} style={S('height:72px; box-sizing:border-box; background:#0E1418; border:1px solid #1E2A31; padding:4px; display:flex; flex-direction:column; gap:3px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:7.5px; color:#7f9099;")}>{d.d}</span><span style={{ height: d.h1, background: d.c1 }} /><span style={{ height: d.h2, background: d.c2 }} /></div>)}</div>
                                    <div style={S('margin-top:auto; display:flex; flex-direction:column; gap:4px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:9px; color:#9fb0b8;")}>DUE THIS WEEK</span><span style={S('height:12px; background:#0E1418; border:1px solid #1E2A31; border-left:3px solid #FFB020;')} /><span style={S('height:12px; background:#0E1418; border:1px solid #1E2A31; border-left:3px solid #22D3FF;')} /></div>
                                  </div>
                                )}
                                {hasClip && (
                                  <video data-clip="1" autoPlay muted loop playsInline preload="metadata" poster={clip.poster || undefined} style={S('position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#070B0D;')}>
                                    {clip.mp4 && <source src={clip.mp4} type="video/mp4" />}{clip.webm && <source src={clip.webm} type="video/webm" />}
                                  </video>
                                )}
                                {!hasClip && <span style={S("position:absolute; left:12px; bottom:12px; padding:2px 8px; border:1px solid #44525a; border-radius:4px; background:#070B0D; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.06em; color:#c5d1d6;")}>Example data</span>}
                              </div>
                              <span style={S('font-size:12px; letter-spacing:.08em; color:#9a9aa8;')}>{c.cap}</span>
                            </div>
                          </div>
                        </div>

                        {c.k === 'content' && (
                          <div style={S(`display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))'}; border-top:1px solid #2c2c3a; border-left:1px solid #2c2c3a;`)}>
                            {OUTPUTS.map((o) => <div key={o.name} style={S('padding:24px; border-right:1px solid #2c2c3a; border-bottom:1px solid #2c2c3a; display:flex; flex-direction:column; gap:8px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#9a9aa8;')}>OUTPUT</span><span style={S('font-size:20px; font-weight:500; letter-spacing:-0.01em;')}>{o.name}</span><span style={S('font-size:15px; line-height:1.5; color:#b9b9c6;')}>{o.line}</span></div>)}
                          </div>
                        )}
                        {c.k === 'commerce' && (
                          <div style={S('display:grid; grid-template-columns:repeat(auto-fit,minmax(256px,1fr)); border-top:1px solid #2c2c3a; border-left:1px solid #2c2c3a;')}>
                            {SHOPS.map((name) => (
                              <div key={name} style={S('padding:24px; border-right:1px solid #2c2c3a; border-bottom:1px solid #2c2c3a; display:flex; flex-direction:column; gap:16px;')}>
                                <div style={S('display:flex; align-items:center; gap:16px;')}><span style={S('width:40px; height:40px; border-radius:8px; background:#262633;')} /><div style={S('display:flex; flex-direction:column; gap:2px;')}><span style={S('font-size:16px; font-weight:600;')}>{name}</span><span style={S('font-size:13px; color:#9a9aa8;')}>Category</span></div></div>
                                <div style={S('display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px;')}>
                                  {[['000', 'Orders a month'], ['00', 'Products live'], ['00', 'Days to launch']].map(([v, l]) => <div key={l} style={S('display:flex; flex-direction:column; gap:4px;')}><span style={S('font-size:20px;')}>{v}</span><span style={S('font-size:11px; color:#9a9aa8;')}>{l}</span></div>)}
                                </div>
                                <span style={S("font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#8a8a98;")}>PLACEHOLDER · shop and stats</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {c.k === 'everyday' && (
                          <div style={S('display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap; border-top:1px solid #2c2c3a; border-bottom:1px solid #2c2c3a; padding:24px 0;')}>
                            <div style={S('display:flex; flex-direction:column; gap:4px;')}><span style={S('font-size:18px; font-weight:500;')}>Health schedule logging</span><span style={S('font-size:15px; color:#9a9aa8;')}>Log a schedule and see it on your day.</span></div>
                            <span style={S('padding:4px 8px; border:1px solid #44444f; border-radius:4px; font-size:13px;')}>Coming soon</span>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
                <div style={S(`height:${m ? '40px' : '80px'}; background:#171721;`)} />
              </div>
            </div>
          </div>

          {/* Cover copy and the logo band, over the photograph. */}
          <div ref={heroRef} style={S('position:absolute; inset:0; will-change:opacity,transform;')}>
            <div style={S('position:absolute; left:0; right:0; top:0; height:64%; background:radial-gradient(ellipse 58% 68% at 50% 38%,rgba(244,247,251,.6),rgba(244,247,251,0) 72%); pointer-events:none;')} />
            <div ref={stackRef} style={S('position:absolute; top:120px; left:20px; right:20px; display:flex; flex-direction:column; align-items:center; text-align:center; transform-origin:50% 0;')}>
              <h1 style={S(`margin:0; font-size:${m ? '40px' : 'clamp(54px, 5.4vw, 78px)'}; line-height:1.0; font-weight:480; letter-spacing:-0.035em; max-width:960px; text-wrap:balance; color:#100f12;`)}>{headline}</h1>
              <p style={S(`margin:${m ? '14px' : '20px'} 0 0; font-size:${m ? '16px' : '19px'}; line-height:1.45; max-width:640px; color:#252b3a; text-wrap:balance;`)}>{SUBLINE}</p>
              <a href={LINKS.signup} className="lp-h-primary" style={S(`margin-top:${m ? '22px' : '30px'}; height:56px; padding:0 30px; display:flex; align-items:center; border-radius:999px; background:#5266eb; color:#fff; font-size:17px; font-weight:500; box-shadow:0 8px 20px rgba(16,15,18,.16); white-space:nowrap;`)}>Start 7-day free trial</a>
              <div style={S(`margin-top:${m ? '18px' : '22px'}; font-size:${m ? '17px' : '20px'}; font-weight:500; letter-spacing:-0.015em; color:#100f12;`)}>13 modules. One login. $19.99/mo.</div>
              <div style={S('margin-top:8px; font-size:12px; letter-spacing:.02em; color:#2e3240;')}>Not medical or financial advice.</div>
            </div>

            <div ref={bandRef} style={S(`position:absolute; left:0; right:0; bottom:0; padding:${m ? '44px 0 28px' : '64px 0 38px'}; display:flex; flex-direction:column; gap:${bandGap}; background:linear-gradient(180deg,rgba(23,23,33,0) 0%,rgba(23,23,33,.82) 34%,#171721 64%);`)}>
              <div style={S('text-align:center; font-size:12px; font-weight:500; letter-spacing:.16em; color:rgba(237,237,243,.6);')}>BRANDS WE UTILIZE</div>
              {!still ? (
                <div style={S('display:flex; flex-direction:column; gap:16px;')} aria-label={[...UTILIZE_1, ...UTILIZE_2].join(', ')}>
                  {[[UTILIZE_1, dur1, 0], [UTILIZE_2, dur2, -84]].map(([list, dur, ml], r) => (
                    <div key={r} className="lp-fade-edges" aria-hidden="true">
                      <div style={S(`display:flex; width:max-content; margin-left:${ml}px; animation:mmRight ${dur} linear infinite;`)}>{rep4(list as string[]).map((n, i) => <span key={i} style={S(`padding:0 28px; font-size:${logoSize}; line-height:${logoBox}; font-weight:600; letter-spacing:-0.01em; color:rgba(237,237,243,.6); white-space:nowrap;`)}>{n}</span>)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={S('max-width:1100px; margin:0 auto; padding:0 20px; display:flex; flex-wrap:wrap; justify-content:center; gap:14px 40px;')}>{[...UTILIZE_1, ...UTILIZE_2].map((n) => <span key={n} style={S(`font-size:${logoSize}; line-height:${logoBox}; font-weight:600; color:rgba(237,237,243,.6);`)}>{n}</span>)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Your day, one login: pinned for seven stops. */}
      {!still ? (
        <div ref={dayRef} data-nav="ink" style={S(`position:relative; height:${100 + 7 * 55}vh; background:#fbfbfd; border-top:1px solid #e3e3ea;`)}>
          <div style={S('position:sticky; top:0; height:100vh; overflow:hidden; background:#fbfbfd;')}>
            {!m ? (
              <div style={S('max-width:1200px; height:100%; margin:0 auto; padding:96px 64px 48px; box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:64px; align-items:center;')}>
                <div style={S('display:flex; flex-direction:column; gap:40px;')}>
                  <div style={S('display:flex; flex-direction:column; gap:16px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>YOUR DAY, ONE LOGIN</span><h2 style={S('margin:0; font-size:48px; line-height:1.02; font-weight:480; letter-spacing:-0.035em;')}>One ordinary day, in one app.</h2></div>
                  <div style={S('position:relative; padding-left:32px;')}>
                    <span style={S('position:absolute; left:0; top:8px; bottom:8px; width:1px; background:#e3e3ea;')} />
                    <span ref={progRef} style={S('position:absolute; left:0; top:8px; width:1px; height:0; background:#100f12;')} />
                    {stops.map((s) => (
                      <div key={s.time} style={S('display:grid; grid-template-columns:96px minmax(0,1fr); gap:16px; padding:12px 0; transition:color .35s;')}>
                        <span style={S(`font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:24px; color:${s.on ? '#100f12' : '#a3a3ad'}; transition:color .35s;`)}>{s.time}</span>
                        <div style={S('display:flex; flex-direction:column; gap:4px;')}><span style={S(`font-size:18px; line-height:24px; font-weight:600; color:${s.on ? '#100f12' : '#a3a3ad'}; transition:color .35s;`)}>{s.mod}</span>{s.on && <span style={S('font-size:15px; line-height:1.5; color:#3a3a44;')}>{s.line}</span>}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={S('display:flex; justify-content:center;')}>
                  <div style={S(`position:relative; width:${phW}px; height:${phH}px; border-radius:52px; background:#0c0c11; border:1px solid #2a2a33; padding:10px; box-sizing:border-box;`)}>
                    <div style={S('position:relative; width:100%; height:100%; border-radius:42px; overflow:hidden; background:#e8edf5;')}>
                      {stops.map((s) => (
                        <div key={s.time} style={S(`position:absolute; inset:0; background:${s.grad}; opacity:${s.on ? 1 : 0}; transition:opacity .6s; display:flex; flex-direction:column; justify-content:space-between; padding:64px 24px 24px; box-sizing:border-box;`)}>
                          <div style={S('display:flex; flex-direction:column; gap:4px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:12px; color:#4a4f5c;")}>{s.time}</span><span style={S('font-size:24px; font-weight:500; letter-spacing:-0.02em; color:#15171d;')}>{s.mod}</span></div>
                          <span style={S("font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#4a4f5c;")}>PLACEHOLDER · screen recording</span>
                        </div>
                      ))}
                      <span style={S('position:absolute; top:14px; left:50%; transform:translateX(-50%); width:96px; height:28px; border-radius:999px; background:#0c0c11;')} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={S('height:100%; padding:72px 20px 24px; box-sizing:border-box; display:flex; flex-direction:column; gap:16px;')}>
                <div style={S('display:flex; justify-content:center;')}>
                  <div style={S(`position:relative; width:${phW}px; height:${phH}px; border-radius:36px; background:#0c0c11; border:1px solid #2a2a33; padding:7px; box-sizing:border-box;`)}>
                    <div style={S('position:relative; width:100%; height:100%; border-radius:29px; overflow:hidden; background:#e8edf5;')}>
                      {stops.map((s) => (
                        <div key={s.time} style={S(`position:absolute; inset:0; background:${s.grad}; opacity:${s.on ? 1 : 0}; transition:opacity .6s; display:flex; flex-direction:column; justify-content:space-between; padding:40px 16px 16px; box-sizing:border-box;`)}>
                          <span style={S('font-size:17px; font-weight:500; letter-spacing:-0.015em; color:#15171d;')}>{s.mod}</span>
                          <span style={S("font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.06em; color:#4a4f5c;")}>PLACEHOLDER · screen recording</span>
                        </div>
                      ))}
                      <span style={S('position:absolute; top:9px; left:50%; transform:translateX(-50%); width:64px; height:18px; border-radius:999px; background:#0c0c11;')} />
                    </div>
                  </div>
                </div>
                <div style={S('position:relative; padding-left:24px; display:flex; flex-direction:column;')}>
                  <span style={S('position:absolute; left:0; top:4px; bottom:4px; width:1px; background:#e3e3ea;')} />
                  <span ref={progRef} style={S('position:absolute; left:0; top:4px; width:1px; height:0; background:#100f12;')} />
                  {stops.map((s) => (
                    <div key={s.time} style={S('display:grid; grid-template-columns:72px minmax(0,1fr); gap:8px; padding:4px 0;')}>
                      <span style={S(`font-family:'IBM Plex Mono',monospace; font-size:12px; line-height:24px; color:${s.on ? '#100f12' : '#a3a3ad'};`)}>{s.time}</span>
                      <span style={S(`font-size:15px; line-height:24px; font-weight:600; color:${s.on ? '#100f12' : '#a3a3ad'};`)}>{s.mod}</span>
                    </div>
                  ))}
                  <span style={S('margin-top:8px; padding-top:8px; border-top:1px solid #e3e3ea; font-size:15px; line-height:1.5; color:#15171d; min-height:48px;')}>{DAY[dayIdx][2]}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <section data-nav="ink" style={S(`background:#fbfbfd; border-top:1px solid #e3e3ea; padding:${sectionPad};`)}>
          <div style={S(`max-width:1200px; margin:0 auto; display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : 'minmax(0,1fr) 320px'}; gap:64px; align-items:start;`)}>
            <div style={S('display:flex; flex-direction:column; gap:32px;')}>
              <div style={S('display:flex; flex-direction:column; gap:16px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>YOUR DAY, ONE LOGIN</span><h2 style={S(`margin:0; font-size:${h2Size}; line-height:1.02; font-weight:480; letter-spacing:-0.035em;`)}>One ordinary day, in one app.</h2></div>
              <div style={S('display:flex; flex-direction:column; border-top:1px solid #e3e3ea;')}>
                {DAY.map(([time, mod, line]) => <div key={time} style={S('display:grid; grid-template-columns:96px minmax(0,1fr); gap:16px; padding:16px 0; border-bottom:1px solid #e3e3ea;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:24px; color:#4a4a55;")}>{time}</span><div style={S('display:flex; flex-direction:column; gap:4px;')}><span style={S('font-size:18px; line-height:24px; font-weight:600;')}>{mod}</span><span style={S('font-size:15px; line-height:1.5; color:#4a4a55;')}>{line}</span></div></div>)}
              </div>
            </div>
            <div style={S('display:flex; justify-content:center;')}>
              <div style={S('position:relative; width:280px; height:576px; border-radius:48px; background:#0c0c11; border:1px solid #2a2a33; padding:10px; box-sizing:border-box;')}>
                <div style={S('position:relative; width:100%; height:100%; border-radius:38px; overflow:hidden; background:linear-gradient(165deg,#eef2f8 0%,#d3dceb 100%); display:flex; align-items:flex-end; padding:24px; box-sizing:border-box;')}><span style={S('position:absolute; top:12px; left:50%; transform:translateX(-50%); width:88px; height:26px; border-radius:999px; background:#0c0c11;')} /><span style={S("font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; color:#4a4f5c;")}>PLACEHOLDER · screen recording</span></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Brands we work with (placeholder slots until permission is in). */}
      <section data-nav="ink" style={S(`background:#f7f4ee; border-top:1px solid #e2ddd2; padding:${m ? '48px 0' : '72px 0'}; display:flex; flex-direction:column; gap:${bandGap};`)}>
        <div style={S('text-align:center; font-size:11px; font-weight:500; letter-spacing:.14em; color:rgba(16,15,18,.6);')}>BRANDS WE WORK WITH</div>
        {!still ? (
          <div style={S('display:flex; flex-direction:column; gap:16px;')}>
            {[[WORK_WITH_1, dur1, 0, '4px'], [WORK_WITH_2, dur2, -102, '999px']].map(([list, dur, ml, rad], r) => (
              <div key={r} className="lp-fade-edges">
                <div style={S(`display:flex; width:max-content; margin-left:${ml}px; animation:mmRight ${dur} linear infinite;`)}>
                  {rep6(list as string[]).map((n, i) => <span key={i} style={S(`padding:0 28px; display:flex; align-items:center; gap:8px; height:${logoBox}; white-space:nowrap;`)}><span style={S(`width:16px; height:16px; border-radius:${rad}; background:rgba(16,15,18,.55);`)} /><span style={S(`font-size:${wmSize}; font-weight:600; letter-spacing:-0.01em; color:rgba(16,15,18,.55);`)}>Wordmark</span><span style={S("font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.08em; color:rgba(16,15,18,.55);")}>PLACEHOLDER {n}</span></span>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={S('max-width:1100px; margin:0 auto; padding:0 16px; display:flex; flex-wrap:wrap; justify-content:center; gap:16px 40px;')}>{[...WORK_WITH_1, ...WORK_WITH_2].map((n) => <span key={n} style={S(`display:flex; align-items:center; gap:8px; height:${logoBox};`)}><span style={S('width:16px; height:16px; border-radius:4px; background:rgba(16,15,18,.55);')} /><span style={S(`font-size:${wmSize}; font-weight:600; color:rgba(16,15,18,.55);`)}>Wordmark</span><span style={S("font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.08em; color:rgba(16,15,18,.55);")}>PLACEHOLDER {n}</span></span>)}</div>
        )}
      </section>

      {/* ── Get started (pricing) */}
      <section id="start" data-nav="ink" style={S(`background:#fbf9f4; color:#1b1a17; padding:${sectionPad}; border-top:1px solid #e2ddd2; scroll-margin-top:0;`)}>
        <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:40px;')}>
          <div style={S('display:flex; flex-direction:column; gap:16px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>GET STARTED</span><h2 style={S(`margin:0; font-size:${h2Size}; line-height:1.02; font-weight:480; letter-spacing:-0.035em;`)}>Pick where you start.</h2></div>
          <div style={S('display:grid; grid-template-columns:repeat(auto-fit,minmax(296px,1fr)); gap:16px; align-items:stretch;')}>
            <div style={S('background:#1b1a17; color:#fbf9f4; border-radius:12px; padding:32px; display:flex; flex-direction:column; gap:16px;')}>
              <span style={S('font-size:18px; font-weight:600;')}>Masterminds</span>
              <div style={S('display:flex; align-items:baseline; gap:8px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:48px; line-height:1; letter-spacing:-0.03em;")}>$19.99</span><span style={S('font-size:16px; color:#b8b3a8;')}>/mo</span></div>
              <span style={S('flex:1; font-size:15px; line-height:1.5; color:#d6d1c6;')}>All 13 modules, Nova, and one login.</span>
              <a href={LINKS.signup} className="lp-h-primary" style={S('height:48px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#5266eb; color:#fff; font-size:16px; font-weight:500;')}>Start 7-day free trial</a>
              <span style={S('padding-top:16px; border-top:1px solid #3a3833; font-size:12px; line-height:1.5; color:#b8b3a8;')}>7-day free trial terms. <span style={S("font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em;")}>PLACEHOLDER</span></span>
            </div>
            <div style={S('background:#fff; border:1px solid #e2ddd2; border-radius:12px; padding:32px; display:flex; flex-direction:column; gap:16px;')}>
              <div style={S('display:flex; justify-content:space-between; align-items:center; gap:16px;')}><span style={S('font-size:18px; font-weight:600;')}>Masterminds Pro</span><span style={S('padding:4px 8px; border:1px solid #d6d1c6; border-radius:4px; font-size:12px;')}>Coming soon</span></div>
              <div style={S('display:flex; align-items:baseline; gap:8px;')}><span style={S("font-family:'IBM Plex Mono',monospace; font-size:48px; line-height:1; letter-spacing:-0.03em;")}>$49.99</span><span style={S('font-size:16px; color:#6b665c;')}>/mo</span></div>
              <span style={S('flex:1; font-size:15px; line-height:1.5; color:#4a463f;')}>Client CRM, LeadFlow, Invoicing, Client Modules, Audits, Scaling Planner, Idea Maker, Brand Lab.</span>
              <span aria-disabled="true" style={S('height:48px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#efebe2; color:#6b665c; font-size:16px; font-weight:500; cursor:not-allowed;')}>Coming soon</span>
            </div>
            <div style={S('background:#fff; border:1px solid #e2ddd2; border-radius:12px; padding:32px; display:flex; flex-direction:column; gap:16px;')}>
              <div style={S('display:flex; justify-content:space-between; align-items:center; gap:16px;')}><span style={S('font-size:18px; font-weight:600;')}>Masterminds Team</span><span style={S('padding:4px 8px; border:1px solid #d6d1c6; border-radius:4px; font-size:12px;')}>Request only</span></div>
              <div style={S('display:flex; flex-direction:column; border-top:1px solid #ece8df;')}>
                {[['10 seats', '$99/mo'], ['25 seats', '$199/mo'], ['50 seats', '$349/mo']].map(([s, p]) => <div key={s} style={S('display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #ece8df;')}><span>{s}</span><span style={S("font-family:'IBM Plex Mono',monospace;")}>{p}</span></div>)}
              </div>
              <span style={S('flex:1; font-size:15px; line-height:1.5; color:#4a463f;')}>Owner plus seats. Teammates never see each other's personal modules.</span>
              <a href={LINKS.team} className="lp-h-inv-ink" style={S('height:48px; display:flex; align-items:center; justify-content:center; border-radius:999px; border:1px solid #1b1a17; color:#1b1a17; font-size:16px; font-weight:500;')}>Request access</a>
            </div>
          </div>
          <div style={S('display:flex; flex-direction:column; gap:16px;')}>
            <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>RUN BY MARQ · DONE WITH YOU</span>
            <div style={S('display:grid; grid-template-columns:repeat(auto-fit,minmax(296px,1fr)); border-top:1px solid #d6d1c6;')}>
              {[['Content', '$749', 'Content workers, account builds, launch kits.'], ['Commerce', '$1,500', 'Sourcing, store build, product pages, launch. Includes Content.']].map(([n, p, d], i) => (
                <div key={n} style={S(`padding:24px 0; border-bottom:1px solid #d6d1c6; display:flex; flex-direction:column; align-items:flex-start; gap:16px; margin-right:${i === 0 && !m ? '32px' : '0px'};`)}>
                  <div style={S('display:flex; flex-direction:column; gap:8px;')}><span style={S('font-size:18px; font-weight:600;')}>{n}</span><span style={S("font-family:'IBM Plex Mono',monospace; font-size:24px;")}>{p}<span style={S("font-family:'Instrument Sans',sans-serif; font-size:14px; color:#6b665c;")}>/mo</span></span><span style={S('font-size:15px; color:#4a463f;')}>{d}</span></div>
                  <a href={LINKS.apply} className="lp-h-inv-ink" style={S('align-self:flex-start; height:48px; padding:0 24px; display:flex; align-items:center; border-radius:999px; border:1px solid #1b1a17; color:#1b1a17; font-size:16px; font-weight:500;')}>Apply</a>
                </div>
              ))}
            </div>
          </div>
          <span style={S('font-size:12px; color:#6b665c;')}>Not medical or financial advice.</span>
        </div>
      </section>

      {/* ── FAQ */}
      <section id="faq" data-nav="ink" style={S(`background:#fbf9f4; color:#1b1a17; border-top:1px solid #e2ddd2; padding:${sectionPad};`)}>
        <div style={S('max-width:880px; margin:0 auto; display:flex; flex-direction:column; gap:40px;')}>
          <div style={S('display:flex; flex-direction:column; gap:16px;')}><span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>FAQ <span style={S("font-family:'IBM Plex Mono',monospace; letter-spacing:.08em;")}>· DRAFT COPY</span></span><h2 style={S(`margin:0; font-size:${h2Size}; line-height:1.02; font-weight:480; letter-spacing:-0.035em;`)}>Questions.</h2></div>
          <div style={S('display:flex; flex-direction:column; border-top:1px solid #1b1a17;')}>
            {FAQS.map(([qq, a], i) => (
              <div key={qq} style={S('border-bottom:1px solid #e2ddd2;')}>
                <button onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i} style={S("width:100%; min-height:64px; padding:16px 0; display:flex; justify-content:space-between; align-items:center; gap:16px; border:none; background:transparent; color:#1b1a17; font-family:'Instrument Sans',sans-serif; font-size:18px; font-weight:500; text-align:left; cursor:pointer;")}><span>{qq}</span><span aria-hidden="true" style={S('font-size:20px; color:#6b665c;')}>{faq === i ? '−' : '+'}</span></button>
                {faq === i && <p style={S('margin:0; padding:0 0 24px; max-width:640px; font-size:16px; line-height:1.55; color:#4a463f;')}>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer mob={m} onHome />
    </div>
  );
}
