import { useEffect, useRef } from 'react';
import { S, LINKS, Nav, Footer, useViewport, updateNavInk } from './shared';

const MONO = "font-family:'IBM Plex Mono',monospace;";
/** Marked in the page itself so nobody mistakes it for final copy. */
const TBD = (what: string) => `[${what} — Marq to confirm]`;

interface Role { area: string; title: string; what: string[]; you: string }
// The three kinds of work that actually exist in the business today. Titles,
// pay and contract type aren't decided anywhere in the codebase, so they are
// placeholders until Marq fills them in (docs/PUBLIC-SITE.md).
const ROLES: Role[] = [
  {
    area: 'CONTENT', title: TBD('Role title'),
    what: ['Film and help edit short-form video for Masterminds, Made by Marq and the brands we run.', 'Turn a script and a shot list into clips that are ready to post, on a weekly rhythm.', 'Keep the content calendar honest: what was planned, what got posted, how it did.'],
    you: 'You already shoot on your phone and can tell a good hook from a slow one.',
  },
  {
    area: 'COLD CALLING & LEADS', title: TBD('Role title'),
    what: ['Work a real lead list for Made by Marq: call local businesses, book conversations, log every outcome.', 'Clean and qualify leads before they reach the dialer.', 'Follow up on every callback inside a day.'],
    you: 'You can hear "no" twenty times and still sound like you mean it on call twenty-one.',
  },
  {
    area: 'E-COMMERCE & BRANDS', title: TBD('Role title'),
    what: ['Help take a product from research to a live store: suppliers, samples, the page, the launch posts.', 'Check what the numbers say each week and help decide what to push and what to drop.', 'Handle the details that make a small brand look like a real one.'],
    you: 'You like the unglamorous parts — spreadsheets, supplier emails, checking the sample before it ships.',
  },
];

export default function Jobs() {
  const { mob: m } = useViewport();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = 'Jobs · Masterminds';
    const on = () => updateNavInk(navRef.current);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const pad = m ? '0 20px' : '0 64px';

  return (
    <div style={S('position:relative; color:#1b1a17; background:#fbf9f4;')}>
      <Nav mob={m} navRef={navRef} />

      {/* ── Hero */}
      <header data-nav="ink" style={S(`padding:${m ? '128px 20px 64px' : '176px 64px 112px'};`)}>
        <div style={S('max-width:1000px; margin:0 auto; display:flex; flex-direction:column; gap:24px;')}>
          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>JOBS</span>
          <h1 style={S(`margin:0; font-size:${m ? '44px' : 'clamp(56px, 5.6vw, 80px)'}; line-height:1.0; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>Work with Marq.</h1>
          <p style={S(`margin:0; font-size:${m ? '18px' : '21px'}; line-height:1.5; color:#4a463f; max-width:680px;`)}>Help run Made by Marq and Masterminds. It's small and early: one founder, real clients, real stores, and more work than one person can do well. You'd be working directly with Marq, on things that ship this week — not on a team of fifty.</p>
          <div style={S('display:flex; gap:8px; flex-wrap:wrap; padding-top:8px;')}>
            <a href={LINKS.apply} className="lp-h-primary" style={S('height:56px; padding:0 30px; display:flex; align-items:center; border-radius:999px; background:#5266eb; color:#fff; font-size:17px; font-weight:500;')}>Apply</a>
            <a href="#roles" className="lp-h-inv-ink" style={S('height:56px; padding:0 30px; display:flex; align-items:center; border-radius:999px; border:1px solid #1b1a17; color:#1b1a17; font-size:17px; font-weight:500;')}>See the work</a>
          </div>
        </div>
      </header>

      {/* ── Straight answers */}
      <section data-nav="ink" style={S(`border-top:1px solid #e2ddd2; border-bottom:1px solid #e2ddd2; background:#f5f2ea; padding:${m ? '40px 0' : '56px 0'};`)}>
        <div style={S(`max-width:1000px; margin:0 auto; padding:${pad}; display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))'}; gap:${m ? '24px' : '40px'};`)}>
          {[
            ['How it works', TBD('contractor, intern or employee')],
            ['Pay', TBD('pay / equity structure')],
            ['Where', TBD('remote, local or hybrid')],
          ].map(([k, v]) => (
            <div key={k} style={S('display:flex; flex-direction:column; gap:6px;')}>
              <span style={S('font-size:11px; letter-spacing:.14em; color:#6b665c;')}>{k.toUpperCase()}</span>
              <span style={S(`${MONO} font-size:14px; line-height:1.5; color:#8a5a00;`)}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── The roles */}
      <section id="roles" data-nav="ink" style={S(`padding:${m ? '72px 0' : '128px 0'}; scroll-margin-top:64px;`)}>
        <div style={S(`max-width:1000px; margin:0 auto; padding:${pad}; display:flex; flex-direction:column; gap:${m ? '40px' : '56px'};`)}>
          <div style={S('display:flex; flex-direction:column; gap:14px; max-width:680px;')}>
            <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>THE WORK</span>
            <h2 style={S(`margin:0; font-size:${m ? '36px' : '52px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em;`)}>Three kinds of work that exist right now.</h2>
            <p style={S('margin:0; font-size:18px; line-height:1.55; color:#4a463f;')}>No invented titles. These are the jobs Marq does today and wants help with.</p>
          </div>
          {ROLES.map((r) => (
            <article key={r.area} style={S(`display:grid; grid-template-columns:${m ? 'minmax(0,1fr)' : 'minmax(0,4fr) minmax(0,7fr)'}; gap:${m ? '16px' : '48px'}; border-top:1px solid #e2ddd2; padding-top:${m ? '28px' : '40px'};`)}>
              <div style={S('display:flex; flex-direction:column; gap:10px;')}>
                <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>{r.area}</span>
                <h3 style={S(`margin:0; ${MONO} font-size:15px; font-weight:500; line-height:1.4; color:#8a5a00;`)}>{r.title}</h3>
              </div>
              <div style={S('display:flex; flex-direction:column; gap:16px;')}>
                <ul style={S('margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:10px;')}>
                  {r.what.map((w) => <li key={w} style={S('display:grid; grid-template-columns:16px minmax(0,1fr); gap:8px; font-size:17px; line-height:1.55; color:#1b1a17;')}><span style={S('color:#5266eb;')}>—</span><span>{w}</span></li>)}
                </ul>
                <p style={S('margin:0; font-size:15px; line-height:1.55; color:#4a463f;')}><strong style={S('font-weight:600; color:#1b1a17;')}>You'll fit if:</strong> {r.you}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Into /apply */}
      <section data-nav="light" style={S(`background:#171721; color:#ededf3; padding:${m ? '80px 20px' : '128px 64px'};`)}>
        <div style={S('max-width:880px; margin:0 auto; display:flex; flex-direction:column; align-items:center; text-align:center; gap:20px;')}>
          <h2 style={S(`margin:0; font-size:${m ? '38px' : '56px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>Sound like you?</h2>
          <p style={S('margin:0; font-size:18px; line-height:1.55; color:#b8b8c6; max-width:560px;')}>The application takes a few minutes. Tell Marq which kind of work you want and show something you've done.</p>
          <a href={LINKS.apply} className="lp-h-primary" style={S('margin-top:8px; height:56px; padding:0 30px; display:inline-flex; align-items:center; border-radius:999px; background:#5266eb; color:#fff; font-size:17px; font-weight:500;')}>Apply</a>
        </div>
      </section>

      <Footer mob={m} />
    </div>
  );
}
