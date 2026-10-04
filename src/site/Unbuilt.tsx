import { useEffect, useRef } from 'react';
import { S, LINKS, Nav, Footer, useViewport, updateNavInk } from './shared';

/** Pages the site links to that have no design yet. Each one says so
 *  plainly, in the site's own style, so nothing is a dead link. */
export const UNBUILT: Record<string, { title: string; what: string }> = {
  product: { title: 'Product', what: 'A tour of the 21 modules and how they connect.' },
  concepts: { title: 'Concepts', what: 'A library of the ideas behind Masterminds.' },
  jobs: { title: 'Jobs', what: 'Apply to work with Marq.' },
  apply: { title: 'Apply', what: 'The application for Run by Marq: Content and E-commerce.' },
  team: { title: 'Request a team plan', what: 'Request access for 10, 25 or 50 seats.' },
  refund: { title: 'Refund policy', what: 'How refunds work for each plan.' },
  disclaimers: { title: 'Disclaimers', what: 'Not medical advice, paper trading only, and the rest in full.' },
  roadmap: { title: 'Roadmap', what: 'An honest list of what is built and what is coming.' },
};

export default function Unbuilt({ page }: { page: string }) {
  const { mob: m } = useViewport();
  const navRef = useRef<HTMLElement>(null);
  const info = UNBUILT[page] ?? { title: 'Page', what: '' };
  useEffect(() => {
    document.title = `${info.title} · Masterminds`;
    const on = () => updateNavInk(navRef.current);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [info.title]);
  return (
    <div style={S('position:relative; color:#100f12; min-height:100vh; display:flex; flex-direction:column; background:#fbf9f4;')}>
      <Nav mob={m} navRef={navRef} />
      <main data-nav="ink" style={S(`flex:1; background:#fbf9f4; color:#1b1a17; padding:${m ? '128px 20px 72px' : '176px 64px 128px'};`)}>
        <div style={S('max-width:880px; margin:0 auto; display:flex; flex-direction:column; gap:24px;')}>
          <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6b665c;')}>{info.title.toUpperCase()} <span style={S("font-family:'IBM Plex Mono',monospace; letter-spacing:.08em;")}>· NOT BUILT YET</span></span>
          <h1 style={S(`margin:0; font-size:${m ? '40px' : '64px'}; line-height:1.02; font-weight:480; letter-spacing:-0.035em; text-wrap:balance;`)}>This page is on its way.</h1>
          <p style={S('margin:0; font-size:18px; line-height:1.55; color:#4a463f; max-width:560px;')}>{info.what} It hasn't been designed yet, so there's nothing here to read today.</p>
          <div style={S('display:flex; gap:8px; flex-wrap:wrap; padding-top:8px;')}>
            <a href={LINKS.home} className="lp-h-primary" style={S('height:48px; padding:0 24px; display:flex; align-items:center; border-radius:999px; background:#5266eb; color:#fff; font-size:16px; font-weight:500;')}>Back to Masterminds</a>
            <a href={LINKS.pricing} className="lp-h-inv-ink" style={S('height:48px; padding:0 24px; display:flex; align-items:center; border-radius:999px; border:1px solid #1b1a17; color:#1b1a17; font-size:16px; font-weight:500;')}>See pricing</a>
          </div>
        </div>
      </main>
      <Footer mob={m} />
    </div>
  );
}
