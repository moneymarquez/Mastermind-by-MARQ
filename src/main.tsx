import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicAuditScreen from './PublicAuditScreen.tsx'
import PublicClientDashboard from './PublicClientDashboard.tsx'

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
