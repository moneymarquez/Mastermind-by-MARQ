import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicAuditScreen from './PublicAuditScreen.tsx'
import PublicClientDashboard from './PublicClientDashboard.tsx'
import { isStandalone } from './lib/pwa'
import { initOrientationLock } from './lib/orientationLock'

// Applies the data-force-portrait attribute index.css's rotate-lock keys
// off of — called before the first render so there's no flash of
// sideways content if the tab happens to open already in landscape.
initOrientationLock();

// The two genuinely public routes in the app — /audit (Part 1b: a prospect
// filling out the lead-gen questionnaire) and /client/<token> (Part 7: a
// client viewing their own progress dashboard). Neither visitor has a
// Mastermind session, so both bypass App.tsx's auth gate entirely rather
// than threading an unauthenticated path through it. Everything else still
// goes through App -> AuthedGate -> Stage as before.
const path = window.location.pathname.replace(/\/+$/, '');
const isPublicAudit = path === '/audit';
const clientToken = path.startsWith('/client/') ? path.slice('/client/'.length) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicAudit
      ? <PublicAuditScreen />
      : clientToken
        ? <PublicClientDashboard token={clientToken} />
        : <App />}
  </StrictMode>,
)

// Best-effort real lock, on top of the CSS rotate-compensation above —
// only takes effect where the Screen Orientation Lock API actually
// exists, which today means an installed (standalone) PWA on Android
// Chrome. iOS Safari has never implemented this API at all, in-tab or
// installed, so this silently no-ops there and the CSS handles it
// instead on this app's actual iPhone/iPad audience.
if (isStandalone()) {
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  orientation.lock?.('portrait')?.catch(() => {});
}

if ('serviceWorker' in navigator) {
  // sw-src/sw.ts calls skipWaiting()+clients.claim() so a new deploy's
  // worker activates and takes control immediately — but without this
  // listener, the page already open in the tab keeps running on the old
  // cached JS/HTML until some *later* navigation happens to land after
  // that takeover. This reload (once per takeover, guarded below) is what
  // actually makes a fresh deploy show up without the user needing to
  // reload twice.
  let reloadedForNewWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewWorker) return;
    reloadedForNewWorker = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
