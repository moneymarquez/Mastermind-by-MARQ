import { useEffect, useRef } from 'react';
import { S, LINKS, Nav, Footer, useViewport, updateNavInk } from './shared';
import { PRODUCT_MODULES, MODULE_COUNT, PERSONAL_TBD, SHOT_H } from './productContent';
import Offers from './Offers';
import type { ProductModule } from './productContent';

const shot = (k: string) => `/site/product/${k}.webp`;
const MONO = "font-family:'IBM Plex Mono',monospace;";
const CTA = 'height:56px; padding:0 30px; display:inline-flex; align-items:center; border-radius:999px; background:#5266eb; color:#fff; font-size:17px; font-weight:500; white-space:nowrap;';

/** A real screenshot inside a plain browser frame (same idea as the
 *  laptop on Home, but flat so the app itself does the talking). */
function Frame({ k, alt, m, eager }: { k: string; alt: string; m: boolean; eager?: boolean }) {
  return (
    <div style={S(`border-radius:${m ? '10px' : '14px'}; overflow:hidden; background:#fff; border:1px solid #dcdce4; box-shadow:0 1px 2px rgba(16,15,18,.04), 0 24px 48px -24px rgba(16,15,18,.22);`)}>
      <div aria-hidden="true" style={S(`height:${m ? '24px' : '32px'}; display:flex; align-items:center; gap:6px; padding:0 12px; background:#f3f3f6; border-bottom:1px solid #e3e3ea;`)}>
        {['#e4e4ea', '#e4e4ea', '#e4e4ea'].map((c, i) => <span key={i} style={S(`width:${m ? '7px' : '10px'}; height:${m ? '7px' : '10px'}; border-radius:50%; background:${c};`)} />)}
        <span style={S(`margin-left:12px; flex:1; max-width:280px; height:${m ? '12px' : '18px'}; border-radius:6px; background:#e9e9ef; ${MONO} font-size:10px; line-height:${m ? '12px' : '18px'}; color:#8a8a98; padding-left:8px; overflow:hidden; white-space:nowrap;`)}>{m ? '' : 'mastermindsbymarq.com'}</span>
      </div>
      <img src={shot(k)} alt={alt} width={1600} height={SHOT_H[k] ?? 1247} loading={eager ? 'eager' : 'lazy'} decoding="async" style={S('display:block; width:100%; height:auto;')} />
    </div>
  );
}

function Links({ links, dark }: { links: string[]; dark?: boolean }) {
  return (
    <div style={S('display:flex; flex-wrap:wrap; gap:6px; align-items:center;')}>
      <span style={S(`font-size:11px; letter-spacing:.14em; color:${dark ? '#8a8a98' : '#6e6e7a'}; margin-right:4px;`)}>WORKS WITH</span>
      {links.map((l) => <span key={l} style={S(`padding:3px 10px; border-radius:999px; border:1px solid ${dark ? '#3a3a48' : '#dcdce4'}; font-size:13px; color:${dark ? '#d6d6df' : '#3a3a44'};`)}>{l}</span>)}
    </div>
  );
}

/** Deep and standard modules: copy on one side, screenshot on the other,
 *  alternating. Deep ones get the full numbered "how it works". */
function ModuleRow({ mod, i, m }: { mod: ProductModule; i: number; m: boolean }) {
  const flip = !m && i % 2 === 1;
  const deep = mod.depth === 'deep';
  return (
    <article id={mod.key} style={S(`display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : deep ? 'minmax(0,5fr) minmax(0,7fr)' : 'minmax(0,4fr) minmax(0,6fr)'}; gap:${m ? '24px' : '64px'}; align-items:center; scroll-margin-top:96px;`)}>
      <div style={S(`display:flex; flex-direction:column; gap:20px; order:${flip ? 2 : 1};`)}>
        <div style={S('display:flex; flex-direction:column; gap:10px;')}>
          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>{mod.group.toUpperCase()}</span>
          <h3 style={S(`margin:0; font-size:${m ? '30px' : deep ? '40px' : '32px'}; line-height:1.04; font-weight:480; letter-spacing:-0.03em; color:#100f12;`)}>{mod.name}</h3>
          <p style={S(`margin:0; font-size:${m ? '17px' : '19px'}; line-height:1.45; color:#3a3a44; text-wrap:balance;`)}>{mod.line}</p>
        </div>
        {mod.how && (
          <ol style={S('margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:14px;')}>
            {mod.how.map((h, n) => (
              <li key={n} style={S('display:grid; grid-template-columns:28px minmax(0,1fr); gap:10px;')}>
                <span style={S(`${MONO} font-size:12px; line-height:24px; color:#5266eb;`)}>{String(n + 1).padStart(2, '0')}</span>
                <span style={S('font-size:15px; line-height:1.6; color:#2e3240;')}>{h}</span>
              </li>
            ))}
          </ol>
        )}
        {mod.links && <Links links={mod.links} />}
      </div>
      {mod.img ? <div style={S(`order:${flip ? 1 : 2};`)}><Frame k={mod.img} alt={mod.alt} m={m} /></div> : <div style={S(`order:${flip ? 1 : 2}; border:1px solid #e3e3ea; border-radius:16px; background:#f3f4f8; padding:32px; font-size:15px; color:#6e6e7a;`)}>New in October. Screenshot coming with the next sample-data capture.</div>}
    </article>
  );
}

export default function Product() {
  const { mob: m } = useViewport();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = 'Product · Masterminds';
    const on = () => updateNavInk(navRef.current);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const personal = PRODUCT_MODULES.filter((x) => x.group === 'Personal');
  const calling = PRODUCT_MODULES.filter((x) => x.group === 'Cold Calling');
  const side = PRODUCT_MODULES.filter((x) => x.group === 'Side Hustles');
  const pad = m ? '0 20px' : '0 64px';
  const groupHead = (eyebrow: string, title: string, sub: string) => (
    <div style={S('display:flex; flex-direction:column; gap:14px; max-width:720px;')}>
      <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>{eyebrow}</span>
      <h2 style={S(`margin:0; font-size:${m ? '36px' : '52px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; color:#100f12;`)}>{title}</h2>
      <p style={S('margin:0; font-size:18px; line-height:1.55; color:#4a4a55;')}>{sub}</p>
    </div>
  );

  return (
    <div style={S('position:relative; color:#100f12; background:#fbfbfd;')}>
      <Nav mob={m} navRef={navRef} />

      {/* ── Hero */}
      <header data-nav="ink" style={S(`background:linear-gradient(180deg,#eef1f7 0%,#fbfbfd 70%); padding:${m ? '112px 20px 56px' : '160px 64px 96px'};`)}>
        <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-direction:column; align-items:center; text-align:center; gap:20px;')}>
          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>PRODUCT</span>
          <h1 style={S(`margin:0; font-size:${m ? '42px' : 'clamp(56px, 5.6vw, 80px)'}; line-height:1.0; font-weight:480; letter-spacing:-0.035em; max-width:900px; text-wrap:balance;`)}>{MODULE_COUNT} modules. One login.</h1>
          <p style={S(`margin:0; font-size:${m ? '17px' : '20px'}; line-height:1.45; max-width:640px; color:#252b3a; text-wrap:balance;`)}>Your day, your goals, your training, your calls and your side money in one app — and each part feeds the others, so the plan you wake up to already knows about your shift.</p>
          <div style={S('display:flex; flex-direction:column; align-items:center; gap:10px; margin-top:6px;')}>
            <a href={LINKS.signup} className="lp-h-primary" style={S(`${CTA} box-shadow:0 8px 20px rgba(16,15,18,.16);`)}>Start 7-day free trial</a>
            <span style={S('font-size:14px; color:#4a4a55;')}>$19.99/mo after the trial · cancel any time</span>
          </div>
          <div style={S(`width:100%; max-width:1120px; margin-top:${m ? '32px' : '56px'};`)}><Frame k="daily-plan" alt="The Masterminds Daily Plan on a sample day" m={m} eager /></div>
          <span style={S(`${MONO} font-size:11px; letter-spacing:.06em; color:#8a8a98;`)}>Every screenshot on this page uses made-up sample data.</span>
        </div>
      </header>

      {/* ── Index: every module, jump links */}
      <nav aria-label="Modules" data-nav="ink" style={S(`border-top:1px solid #e3e3ea; border-bottom:1px solid #e3e3ea; background:#fff; padding:${m ? '20px' : '24px 64px'};`)}>
        <div style={S('max-width:1200px; margin:0 auto; display:flex; flex-wrap:wrap; gap:8px 6px; justify-content:center;')}>
          {PRODUCT_MODULES.map((x) => <a key={x.key} href={`#${x.key}`} className="lp-h-fade" style={S('padding:6px 12px; border-radius:999px; border:1px solid #e3e3ea; font-size:14px; color:#2e3240;')}>{x.name}</a>)}
        </div>
      </nav>

      {/* ── Personal */}
      <section data-nav="ink" style={S(`padding:${m ? '72px 0' : '128px 0'};`)}>
        <div style={S(`max-width:1200px; margin:0 auto; padding:${pad}; display:flex; flex-direction:column; gap:${m ? '72px' : '128px'};`)}>
          {groupHead('PERSONAL', 'Run the day instead of reacting to it.', `${personal.length} modules for the life around the work: the plan, the calendar, the goals, the body and how your head works. They share one set of data, so nothing has to be entered twice.`)}
          {personal.map((x, i) => <ModuleRow key={x.key} mod={x} i={i} m={m} />)}
          {PERSONAL_TBD > 0 && <div style={S('border:1px dashed #c9c9d3; border-radius:14px; padding:24px;')}>{PERSONAL_TBD} more Personal modules</div>}
        </div>
      </section>

      {/* ── Cold Calling */}
      <section data-nav="ink" style={S(`background:#f3f4f8; border-top:1px solid #e3e3ea; border-bottom:1px solid #e3e3ea; padding:${m ? '72px 0' : '128px 0'};`)}>
        <div style={S(`max-width:1200px; margin:0 auto; padding:${pad}; display:flex; flex-direction:column; gap:${m ? '48px' : '80px'};`)}>
          {groupHead('COLD CALLING', 'Calls that count for something.', 'Dialing isn\'t a separate dialer you have to remember to open. Every call lands on your schedule, your goal and your plan.')}
          {calling.map((x, i) => <ModuleRow key={x.key} mod={x} i={i} m={m} />)}
        </div>
      </section>

      {/* ── Side Hustles: screenshot first, one line each */}
      <section data-nav="ink" style={S(`padding:${m ? '72px 0' : '128px 0'};`)}>
        <div style={S(`max-width:1200px; margin:0 auto; padding:${pad}; display:flex; flex-direction:column; gap:${m ? '40px' : '64px'};`)}>
          {groupHead('SIDE HUSTLES', 'The extra money, kept in one place.', `${side.length === 3 ? 'Three' : side.length} small tools for the things on the side.`)}
          <div style={S(`display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))'}; gap:${m ? '40px' : '32px'};`)}>
            {side.map((x) => (
              <article key={x.key} id={x.key} style={S('display:flex; flex-direction:column; gap:16px; scroll-margin-top:96px;')}>
                {x.img ? <Frame k={x.img} alt={x.alt} m /> : null}
                <div style={S('display:flex; flex-direction:column; gap:6px;')}>
                  <h3 style={S('margin:0; font-size:24px; font-weight:500; letter-spacing:-0.02em;')}>{x.name}</h3>
                  <p style={S('margin:0; font-size:15px; line-height:1.55; color:#4a4a55;')}>{x.line}</p>
                </div>
              </article>
            ))}
          </div>
          <p style={S('margin:0; font-size:12px; color:#6e6e7a;')}>Stocks is paper trading only. Nothing on Masterminds is financial or medical advice.</p>
        </div>
      </section>

      {/* ── Close */}
      <section data-nav="light" style={S(`background:#171721; color:#ededf3; padding:${m ? '80px 20px' : '128px 64px'};`)}>
        <div style={S('max-width:880px; margin:0 auto; display:flex; flex-direction:column; align-items:center; text-align:center; gap:20px;')}>
          <h2 style={S(`margin:0; font-size:${m ? '38px' : '56px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>Try all {MODULE_COUNT} for a week.</h2>
          <p style={S('margin:0; font-size:18px; line-height:1.55; color:#b8b8c6; max-width:560px;')}>One login, $19.99 a month after the trial. Cancel from Settings any time.</p>
          <a href={LINKS.signup} className="lp-h-primary" style={S(`${CTA} margin-top:8px;`)}>Start 7-day free trial</a>
          <a href={LINKS.pricing} className="lp-h-ul" style={S('font-size:15px; color:#b8b8c6;')}>See pricing</a>
          <div style={S('width:100%; max-width:900px; margin-top:16px;')}><Offers dark /></div>
        </div>
      </section>

      <Footer mob={m} />
    </div>
  );
}
