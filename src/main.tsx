import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicAuditScreen from './PublicAuditScreen.tsx'

// /audit is the one genuinely public route in the app (Part 1b of the
// Client CRM build) — a prospect filling it out has no Mastermind
// session, so this bypasses App.tsx's auth gate entirely rather than
// trying to thread an unauthenticated path through it. Everything else
// still goes through App -> AuthedGate -> Stage as before.
const isPublicAudit = window.location.pathname.replace(/\/+$/, '') === '/audit';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicAudit ? <PublicAuditScreen /> : <App />}
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
