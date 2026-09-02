import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SignUpResult } from './useAuth';
import { PLANS, LIVE_PLAN } from '../billing/plans';
import { MODULE_REGISTRY } from '../modules.config';
import Icon from '../Icon';

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<SignUpResult>;
}

const THEME_KEY = 'mastermind-theme';

function currentTheme(): 'dark' | 'light' {
  return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null) ?? 'dark';
}

// Same mechanism useTheme.ts uses post-login (attribute + localStorage) so
// a choice made here survives into the authenticated app without a second
// write path, and a saved server-side preference just overwrites it the
// first time useTheme() loads after sign-in.
function applyTheme(next: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
}

const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11, height: 48, padding: '0 15px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--mm-line)', background: 'var(--mm-field, var(--mm-panel))',
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--mm-text)', fontSize: 14,
};

// A representative slice of MODULE_REGISTRY for the showcase grid — real
// modules, not invented ones. Picked for spread across categories rather
// than every module (there are ~30), landing on 8 so it fills a clean 3x3
// grid together with the Nova card.
const SHOWCASE_KEYS = ['daily-plan', 'macros', 'fitness', 'budgeting', 'goals', 'patterns', 'dialing', 'invoicing'];
const showcaseModules = SHOWCASE_KEYS
  .map((k) => MODULE_REGISTRY.find((m) => m.key === k))
  .filter((m): m is NonNullable<typeof m> => !!m);

// Every module a paying (non-owner) signup can actually turn on — the
// Pricing section's "what's included" list uses this, not the full
// registry, since the ownerOnly modules (Client CRM, LeadFlow, Marketing,
// etc.) aren't part of what a customer is buying.
const includedModules = MODULE_REGISTRY.filter((m) => !m.ownerOnly);
const comingSoonPlan = PLANS.find((p) => !p.live) ?? null;

// The "what it replaces" ticker — kept deliberately short and conservative.
// Every pairing here is a module that's actually built and does the
// stated job today (barcode-scan macro tracking, real workout logging,
// a real budgeting module, etc.) — not the full list a reference file
// might suggest. Left out on purpose: Call Recordings (upload/storage is
// real, but transcription/scoring against a script isn't built yet, so
// "replaces Gong" would overclaim) and anything else without a real
// feature behind it yet.
const REPLACES = [
  'MyFitnessPal', 'Strong', 'YNAB', 'Streaks', 'Sunsama', 'HubSpot', 'PhoneBurner', 'Float',
];

/** The landing page, built against the Aperture "2026 reference"
 *  (aperture-reference.html) — an accent-free "ink" system (inverted
 *  near-white/near-black pill buttons, no colored --accent anywhere) that
 *  supersedes the earlier blurple Aperture port this file used to run on.
 *  --mm-* tokens (index.css) carry every color; --accent/--bg/etc. are
 *  untouched elsewhere in the app.
 *
 *  Structure carries over from the previous version of this file, which
 *  was itself already built against an earlier Aperture pass: same nav,
 *  hero + login card split, dashboard preview, "what it replaces" ticker,
 *  module grid, pricing (two tiers — the live plan and an unrevealed
 *  second slot from billing/plans.ts, never a fabricated one), "how Nova
 *  learns you," closing CTA, footer.
 *
 *  Copy stays honest to what the product does today — see REPLACES above
 *  and the Pricing section's comment for what got left out and why. */
export default function AuthScreen({ onSignIn, onSignUp }: Props) {
  // Separate from the owner/subscriber landing entirely — a client gets
  // its own button in the nav, its own minimal screen (no hero, no
  // pricing, no module grid), not a copy-swap inside the sales page's
  // login card. The underlying sign-in call is identical either way
  // (onSignIn) — AuthedGate routes by role after; only the surface a
  // client actually sees differs.
  const [view, setView] = useState<'main' | 'client-login'>('main');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(currentTheme());

  const toggleTheme = (next: 'dark' | 'light') => {
    setTheme(next);
    applyTheme(next);
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const openClientLogin = () => {
    setView('client-login');
    setError(null);
    setNotice(null);
    setEmail('');
    setPassword('');
  };

  const backToMain = () => {
    setView('main');
    setError(null);
    setNotice(null);
  };

  const submitClientLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    const err = await onSignIn(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
  };

  const scrollToLogin = () => {
    document.getElementById('login-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setNotice(null);

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      setSubmitting(true);
      const result = await onSignUp(email.trim(), password);
      setSubmitting(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setNotice('Account created — check your email to confirm it, then log in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }
      return;
    }

    setSubmitting(true);
    const err = await onSignIn(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
  };

  // A genuinely separate, minimal screen — no hero copy, no pricing, no
  // module grid, nothing selling the product a client is already paying
  // for. Same onSignIn call underneath (AuthedGate routes to ClientPortal
  // by role), just a different, quieter surface to land on. Keeps its own
  // teal (--client-accent) identity — unrelated to the ink-system
  // migration below, deliberately not touched here.
  if (view === 'client-login') {
    const clientFieldStyle: React.CSSProperties = { ...fieldStyle, borderColor: 'color-mix(in srgb, var(--client-accent) 35%, var(--border))', background: 'var(--surface-4)' };
    return (
      <div
        style={{
          height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'var(--text)',
          background: 'radial-gradient(circle at 50% 0%, var(--client-accent-soft), var(--bg) 60%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--client-accent-soft)', border: '1px solid color-mix(in srgb, var(--client-accent) 45%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="users" size={22} color="var(--client-accent)" />
            </div>
            <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Client login</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>See your project's progress, updates, and invoices.</div>
          </div>

          <form
            onSubmit={submitClientLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 24, borderRadius: 'var(--radius-xl)', border: '1px solid color-mix(in srgb, var(--client-accent) 30%, var(--border))', background: 'var(--surface)', boxShadow: '0 20px 60px color-mix(in srgb, var(--client-accent) 10%, transparent)' }}
          >
            <div style={clientFieldStyle}>
              <Icon name="envelope-simple" size={17} color="var(--client-accent)" />
              <input type="email" autoFocus placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, color: 'var(--text)' }} />
            </div>
            <div style={clientFieldStyle}>
              <Icon name="lock-simple" size={17} color="var(--client-accent)" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, color: 'var(--text)' }} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="ap-btn ap-btn-block"
              style={{ height: 48, marginTop: 4, background: 'var(--client-accent)', color: '#fff', border: 'none' }}
            >
              {submitting ? 'Signing in…' : 'Log in'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={backToMain}>
            ← Not a client? Back to Masterminds
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--mm-canvas)', color: 'var(--mm-text)' } as React.CSSProperties}>
      <style>{`
        @keyframes apBloom { 0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: .85; } 50% { transform: translate3d(3%,-2%,0) scale(1.12); opacity: 1; } }
        @keyframes apPulse { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
        @keyframes apTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .mm-bloom { animation: none !important; }
          .mm-ticker-track { animation: none !important; }
        }
        .ap-land { max-width: 1280px; margin: 0 auto; padding: 0 28px; }
        .ap-hero-grid { display: grid; grid-template-columns: 1fr 380px; gap: 56px; align-items: start; }
        .ap-h1 { font-size: 60px; line-height: .98; letter-spacing: -0.04em; font-weight: 600; margin: 0; text-wrap: balance; }
        .ap-h2 { font-size: 38px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; margin: 0; text-wrap: balance; }
        .ap-navlinks { display: flex; gap: 4px; align-items: center; }
        .ap-navlinks span { padding: 10px 14px; font-size: 14px; color: var(--mm-dim); cursor: pointer; }
        .ap-navlinks span:hover { color: var(--mm-text); }
        .ap-module-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .ap-preview-sidebar { display: none; }
        @media (min-width: 760px) { .ap-preview-sidebar { display: flex; } }
        .ap-preview-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .ap-nova-learn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
        .ap-pricing-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; max-width: 720px; margin: 0 auto; }
        .ap-compare-row { display: grid; grid-template-columns: 1fr 140px; align-items: center; }
        .ap-faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
        .ap-hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; }
        .only-mobile { display: none; }
        .only-desktop { display: block; }
        /* Ink system — a solid inverted pill instead of Aperture's earlier
           accent-outlined button. No color anywhere; emphasis is contrast. */
        .mm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; text-decoration: none; font-weight: 600; border-radius: 999px; border: 1px solid transparent; }
        .mm-btn-ink { background: var(--mm-ink); color: var(--mm-ink-text); }
        .mm-btn-ink:hover { opacity: 0.92; }
        .mm-btn-outline { background: transparent; color: var(--mm-text); border-color: var(--mm-line2); }
        .mm-btn-outline:hover { background: var(--mm-panel); }
        .mm-kicker { font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--mm-faint); }
        .mm-ticker-mask { overflow: hidden; -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); }
        .mm-ticker-track { display: flex; gap: 48px; width: max-content; animation: apTicker 32s linear infinite; }
        .mm-ticker-mask:hover .mm-ticker-track { animation-play-state: paused; }
        @media (max-width: 900px) {
          .ap-hero-grid { grid-template-columns: 1fr; gap: 32px; }
          .ap-h1 { font-size: 38px; }
          .ap-h2 { font-size: 28px; }
          .ap-navlinks { display: none; }
          .ap-module-grid { grid-template-columns: 1fr; }
          .ap-replaces-row { flex-direction: column; align-items: flex-start !important; gap: 20px !important; }
          .ap-preview-kpis { grid-template-columns: repeat(2, 1fr); }
          .ap-nova-learn-grid { grid-template-columns: 1fr; gap: 28px; }
          .ap-pricing-cards { grid-template-columns: 1fr; }
          .ap-compare-row { grid-template-columns: 1fr auto; }
          .ap-faq-grid { grid-template-columns: 1fr; gap: 20px; }
          .ap-hero-ctas { flex-direction: column; }
          .ap-hero-ctas .mm-btn { width: 100%; }
          .only-desktop { display: none; }
          .only-mobile { display: block; }
        }
      `}</style>

      {/* Nav — sticky, blurred, Menu pill + section links on the left,
          theme toggle + Log in + brand mark on the right. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--mm-bg-blur)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--mm-line)' }}>
        <div className="ap-land" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 999, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', fontSize: 13.5, fontWeight: 600 }}>
              <Icon name="list" size={16} />Menu
            </div>
            <div className="ap-navlinks">
              <span onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}>Modules</span>
              <span onClick={() => document.getElementById('nova')?.scrollIntoView({ behavior: 'smooth' })}>Nova</span>
              <span onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              onClick={() => toggleTheme(theme === 'light' ? 'dark' : 'light')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--mm-line2)', fontSize: 13, color: 'var(--mm-dim)', cursor: 'pointer' }}
            >
              <Icon name={theme === 'light' ? 'sun' : 'moon'} size={16} />{theme === 'light' ? 'Light' : 'Dark'}
            </div>
            <span onClick={scrollToLogin} style={{ fontSize: 14, color: 'var(--mm-dim)', cursor: 'pointer' }}>Log in</span>
            <div
              onClick={openClientLogin}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--client-accent) 40%, transparent)', fontSize: 13, color: 'var(--client-accent)', cursor: 'pointer' }}
            >
              <Icon name="users" size={15} />Client login
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, borderLeft: '1px solid var(--mm-line)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Masterminds</div>
                <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'var(--mm-faint)', textTransform: 'uppercase' }}>by marq</div>
              </div>
              <img src="/icons/icon-192.png" alt="MARQ" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="ap-land">
        {/* Hero */}
        <div style={{ position: 'relative', padding: '80px 0 0', overflow: 'hidden' }}>
          <div className="mm-bloom" style={{ position: 'absolute', left: '-6%', top: '-30%', width: '70%', height: '130%', background: 'radial-gradient(closest-side, var(--mm-bloom), transparent 72%)', animation: 'apBloom 26s ease-in-out infinite', pointerEvents: 'none' }} />

          <div className="ap-hero-grid" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 'max-content', padding: '7px 15px', borderRadius: 999, border: '1px solid var(--mm-line2)', background: 'var(--mm-panel)', fontSize: 13, color: 'var(--mm-dim)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mm-text)', animation: 'apPulse 2.4s ease-in-out infinite' }} />
                One record. Nova reasons across all of it.
              </div>
              <h1 className="ap-h1">Your entire operation, in one place.</h1>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--mm-dim)', maxWidth: 540, textWrap: 'pretty' as React.CSSProperties['textWrap'] }}>
                Goals, health, money, and the business — tracked in one record, so Nova can reason across all of it
                instead of each part sitting in its own app knowing nothing about the others.
              </p>
              <div className="ap-hero-ctas">
                <button className="mm-btn mm-btn-ink" style={{ padding: '15px 26px', fontSize: 15.5 }} onClick={() => { switchMode('signup'); scrollToLogin(); }}>
                  Create your account<Icon name="arrow-right" size={18} />
                </button>
                <a className="mm-btn mm-btn-outline" href="#modules" style={{ padding: '15px 26px', fontSize: 15.5, textAlign: 'center' }}>See what's inside</a>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--mm-faint)' }}>
                {LIVE_PLAN.price}{LIVE_PLAN.cadence} · cancel anytime, self-serve
              </div>
            </div>

            <div id="login-card" style={{ padding: 26, borderRadius: 18, border: '1px solid var(--mm-line)', background: 'var(--mm-panel-solid)', boxShadow: 'var(--mm-shadow)', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{mode === 'login' ? 'Log in' : 'Create your account'}</div>
                <div style={{ fontSize: 13.5, color: 'var(--mm-faint)', marginTop: 4 }}>{mode === 'login' ? 'Nova has your morning ready.' : 'Takes about a minute.'}</div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={fieldStyle}>
                  <Icon name="envelope-simple" size={17} color="var(--mm-faint)" />
                  <input type="email" autoFocus placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <Icon name="lock-simple" size={17} color="var(--mm-faint)" />
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
                </div>
                {mode === 'signup' && (
                  <div style={fieldStyle}>
                    <Icon name="lock-simple" size={17} color="var(--mm-faint)" />
                    <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
                  </div>
                )}

                {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
                {notice && <div style={{ fontSize: 13, color: 'var(--success)' }}>{notice}</div>}

                <button type="submit" disabled={submitting} className="mm-btn mm-btn-ink" style={{ height: 48, marginTop: 4, width: '100%' }}>
                  {submitting ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Continue' : 'Sign up'}
                </button>
              </form>

              <div style={{ fontSize: 13, color: 'var(--mm-faint)', textAlign: 'center' }}>
                {mode === 'login' ? (
                  <>No account?{' '}
                    <span style={{ color: 'var(--mm-text)', borderBottom: '1px solid var(--mm-line2)', cursor: 'pointer' }} onClick={() => switchMode('signup')}>Start free</span>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <span style={{ color: 'var(--mm-text)', borderBottom: '1px solid var(--mm-line2)', cursor: 'pointer' }} onClick={() => switchMode('login')}>Log in</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard preview — a browser-chrome mockup of the real
              Overview screen on desktop; a completely different, compact
              "Your morning" card on mobile instead of just shrinking the
              desktop one. Both are the same illustrative register (an
              example, not a claim about the viewer's own live data). */}
          <div className="only-desktop" style={{ position: 'relative', marginTop: 44, borderRadius: '20px 20px 0 0', border: '1px solid var(--mm-line)', borderBottom: 'none', background: 'var(--mm-panel-solid)', boxShadow: 'var(--mm-shadow-lift)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--mm-line)', background: 'var(--mm-bg2)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--mm-line2)' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--mm-line2)' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--mm-line2)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '5px 16px', borderRadius: 999, background: 'var(--mm-tile)', fontSize: 11.5, color: 'var(--mm-faint)', fontFamily: 'var(--font-mono)' }}>mastermindsbymarq.com/overview</div>
              </div>
              <div style={{ width: 60 }} />
            </div>
            <div style={{ display: 'flex', minHeight: 380 }}>
              <div className="ap-preview-sidebar" style={{ flex: 'none', width: 190, borderRight: '1px solid var(--mm-line)', background: 'var(--mm-bg2)', padding: '16px 12px', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
                <div style={{ padding: '6px 10px 8px', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>Personal</div>
                {[
                  { icon: 'house', label: 'Overview', active: true },
                  { icon: 'clipboard-text', label: 'Daily Plan' },
                  { icon: 'fork-knife', label: 'Macros' },
                  { icon: 'barbell', label: 'Fitness' },
                  { icon: 'wallet', label: 'Budgeting' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: r.active ? 'var(--mm-panel-solid)' : 'transparent', border: r.active ? '1px solid var(--mm-line)' : 'none', fontWeight: r.active ? 600 : 400, color: r.active ? 'var(--mm-text)' : 'var(--mm-faint)' }}>
                    <Icon name={r.icon} size={15} />{r.label}
                  </div>
                ))}
                <div style={{ padding: '14px 10px 8px', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>Cold calling</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'var(--mm-faint)' }}><Icon name="phone-call" size={15} />Dialing</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'var(--mm-faint)' }}><Icon name="address-book" size={15} />Contacts</div>
              </div>
              <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>Example preview</div>
                    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', marginTop: 4 }}>Good morning.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11.5 }}>
                    <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)' }}>Today</span>
                    <span style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--mm-line)', color: 'var(--mm-faint)' }}>Week</span>
                  </div>
                </div>
                <div className="ap-preview-kpis">
                  {[
                    { label: 'Protein', value: '168', sub: '/202g', pct: 83 },
                    { label: 'Dials', value: '42', sub: '/100', pct: 42 },
                    { label: 'Pipeline', value: '$84k', sub: '3 closing' },
                    { label: 'Runway', value: '7.4', sub: 'mo · +0.3 wk' },
                  ].map((t) => (
                    <div key={t.label} style={{ padding: 14, borderRadius: 14, background: 'var(--mm-tile)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{t.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{t.value}<span style={{ fontSize: 12, color: 'var(--mm-faint)' }}>{t.sub}</span></div>
                      {t.pct !== undefined && (
                        <div style={{ height: 4, borderRadius: 4, background: 'var(--mm-track)' }}>
                          <div style={{ width: `${t.pct}%`, height: '100%', borderRadius: 4, background: 'var(--mm-ink)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderRadius: 16, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.66 }}>
                    <Icon name="sparkle" size={15} />Nova
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
                    Example: "Sleep ran short last night — dial block moved earlier, food logged after."
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile's own compact preview — a single "Your morning" card
              (kicker + time, a 2-tile stat row, a Nova insight with its own
              CTA) instead of a shrunk copy of the desktop browser-chrome
              mockup. */}
          <div className="only-mobile" style={{ marginTop: 32, borderRadius: 22, border: '1px solid var(--mm-line)', background: 'var(--mm-panel-solid)', boxShadow: 'var(--mm-shadow)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--mm-line)', background: 'var(--mm-bg2)' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>Your morning</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mm-faint)' }}>{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  { label: 'Protein', value: '168', sub: '/202g', pct: 83 },
                  { label: 'Dials', value: '42', sub: '/100', pct: 42 },
                ].map((t) => (
                  <div key={t.label} style={{ padding: 13, borderRadius: 14, background: 'var(--mm-tile)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{t.label}</div>
                    <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em' }}>{t.value}<span style={{ fontSize: 11, color: 'var(--mm-faint)' }}>{t.sub}</span></div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--mm-track)' }}>
                      <div style={{ width: `${t.pct}%`, height: '100%', borderRadius: 4, background: 'var(--mm-ink)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 15, borderRadius: 16, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.66 }}>
                  <Icon name="sparkle" size={14} />Nova
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.85 }}>
                  Example: "Sleep ran short — dial block moved earlier, food logged after."
                </div>
                <div
                  onClick={() => { switchMode('signup'); scrollToLogin(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--mm-ink-text)', color: 'var(--mm-ink)', fontSize: 13, cursor: 'pointer' }}
                >
                  Try it free<Icon name="arrow-right" size={15} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="ap-hr" style={{ margin: '56px 0 0', background: 'linear-gradient(to right, transparent, var(--mm-line), transparent)' }} />

        {/* What it replaces — a real price plus a horizontally scrolling
            ticker of tools the product genuinely replaces today (see
            REPLACES above for what got left out and why). CSS-only
            marquee, duplicated list for a seamless loop, paused on
            hover, disabled under prefers-reduced-motion. */}
        <section style={{ padding: '72px 0 20px' }}>
          <div className="mm-kicker">What it replaces</div>
          <div className="ap-replaces-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 48, marginTop: 10 }}>
            <h2 className="ap-h2" style={{ maxWidth: 640 }}>One record instead of a dozen apps that don't talk to each other.</h2>
            <div style={{ flex: 'none', padding: '24px 28px', borderRadius: 20, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.66 }}>Your plan</div>
              <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{LIVE_PLAN.price}<span style={{ fontSize: 16, opacity: 0.66, fontWeight: 500 }}>{LIVE_PLAN.cadence}</span></div>
              <div style={{ fontSize: 12.5, opacity: 0.66 }}>Cancel anytime, self-serve</div>
            </div>
          </div>
          <div className="mm-ticker-mask" style={{ marginTop: 32 }}>
            <div className="mm-ticker-track">
              {[...REPLACES, ...REPLACES].map((name, i) => (
                <span key={`${name}-${i}`} style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--mm-faint)', whiteSpace: 'nowrap' }}>{name}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Module grid — real modules from MODULE_REGISTRY, plus Nova. */}
        <section id="modules" style={{ padding: '32px 0 20px' }}>
          <div className="ap-module-grid">
            {showcaseModules.map((m) => (
              <div key={m.key} style={{ padding: 24, borderRadius: 20, background: 'var(--mm-panel-solid)', border: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Icon name={m.icon} size={24} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mm-faint)' }}>included</span>
                </div>
                <div style={{ fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.label}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--mm-dim)' }}>{m.description}</div>
              </div>
            ))}
            <div style={{ padding: 24, borderRadius: 20, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon name="sparkle" size={24} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.66 }}>included</span>
              </div>
              <div style={{ fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.02em' }}>Nova</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.7 }}>
                Reads every module you've turned on — food against training, sleep against close rate, spend against
                runway — and answers with your actual numbers, not generic advice.
              </div>
            </div>
          </div>
        </section>

        <hr className="ap-hr" style={{ margin: '20px 0 0', background: 'linear-gradient(to right, transparent, var(--mm-line), transparent)' }} />

        {/* Pricing — one live tier plus one unrevealed slot from
            billing/plans.ts (never a fabricated third tier — the reference
            file's 3-tier comparison doesn't map onto this product, which
            has one live plan, no free trial, no team seats). Real module
            list standing in for a fabricated vendor-cost table. */}
        <section id="pricing" style={{ padding: '72px 0', display: 'flex', flexDirection: 'column', gap: 48 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="mm-kicker">Pricing</div>
            <h2 className="ap-h2" style={{ maxWidth: 720 }}>One plan for the whole system, not eleven bills for pieces of it.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--mm-dim)', maxWidth: 560, margin: 0 }}>
              Every module includes Nova. No per-seat pricing, no usage meter — turn on what you need from Settings any time.
            </p>
          </div>

          <div className="ap-pricing-cards">
            <div style={{ position: 'relative', padding: 30, borderRadius: 22, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: 'var(--mm-shadow-btn)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.66 }}>{LIVE_PLAN.name}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1 }}>{LIVE_PLAN.price}</div>
                  <div style={{ fontSize: 15, opacity: 0.66, paddingBottom: 6 }}>{LIVE_PLAN.cadence}</div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.75 }}>{LIVE_PLAN.tagline}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                {LIVE_PLAN.includes.map((line) => (
                  <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Icon name="check" size={16} style={{ marginTop: 2, opacity: 0.7 }} />{line}
                  </div>
                ))}
              </div>
              <div
                onClick={() => { switchMode('signup'); scrollToLogin(); }}
                style={{ marginTop: 'auto', padding: 15, borderRadius: 12, background: 'var(--mm-ink-text)', color: 'var(--mm-ink)', textAlign: 'center', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Create your account
              </div>
            </div>

            {comingSoonPlan && (
              <div style={{ padding: 30, borderRadius: 22, border: '1px solid var(--mm-line)', background: 'var(--mm-panel-solid)', display: 'flex', flexDirection: 'column', gap: 20, opacity: 0.72 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mm-faint)' }}>{comingSoonPlan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--mm-faint)' }}>{comingSoonPlan.price}</div>
                    <div style={{ fontSize: 15, color: 'var(--mm-faint)', paddingBottom: 6 }}>{comingSoonPlan.cadence}</div>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--mm-dim)' }}>{comingSoonPlan.tagline}</div>
                </div>
                <div style={{ marginTop: 'auto', padding: 15, borderRadius: 12, border: '1px solid var(--mm-line2)', textAlign: 'center', fontSize: 14.5, color: 'var(--mm-faint)' }}>
                  Not open yet
                </div>
              </div>
            )}
          </div>

          <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--mm-faint)', marginBottom: 16, textAlign: 'center' }}>Everything included</div>
            <div style={{ borderRadius: 16, border: '1px solid var(--mm-line)', overflow: 'hidden' }}>
              {includedModules.map((m, i) => (
                <div key={m.key} className="ap-compare-row" style={{ padding: '14px 20px', borderBottom: i === includedModules.length - 1 ? 'none' : '1px solid var(--mm-line)', background: i % 2 === 0 ? 'var(--mm-panel-solid)' : 'var(--mm-bg2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name={m.icon} size={17} color="var(--mm-faint)" />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--mm-dim)' }}>Included</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="mm-kicker">Straight answers</div>
            <h3 className="ap-h2" style={{ fontSize: 30, maxWidth: 600 }}>The things people ask before switching.</h3>
          </div>
          <div className="ap-faq-grid" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            {[
              { q: 'Is there a free trial?', a: `No — ${LIVE_PLAN.price}${LIVE_PLAN.cadence} starts at signup. No card-then-forget trial period to track.` },
              { q: 'Can I turn modules on and off?', a: 'Yes, any time from Settings → Manage modules. Nova only reads what you\'ve turned on.' },
              { q: 'What does Nova do with my data?', a: 'Reasons across your own record to answer questions and surface patterns — nothing more, and nothing shared outside your account.' },
              { q: 'If I cancel?', a: 'Self-serve from Settings, no call required.' },
            ].map((f) => (
              <div key={f.q} style={{ padding: '18px 0', borderTop: '1px solid var(--mm-line)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{f.q}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--mm-dim)' }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="ap-hr" style={{ margin: '20px 0 0', background: 'linear-gradient(to right, transparent, var(--mm-line), transparent)' }} />

        {/* How Nova learns you — the actual explanation the nav's "Nova"
            link should land on, not the small module-grid card above
            (which is sized/worded like every other module tile and
            explains nothing on its own). */}
        <section id="nova" className="ap-nova-learn-grid" style={{ padding: '72px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="mm-kicker">How Nova learns you</div>
            <h2 className="ap-h2">Separate apps can't see each other. Yours share one record.</h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--mm-dim)', maxWidth: 460 }}>
              Nova tests every stream against your own outcomes and keeps what actually predicts something. No pep
              talks — the pattern, and the next move.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {[
                { d: 'DAY 3', t: 'Learns your real routine — when you actually train, eat, and work.' },
                { d: 'DAY 9', t: 'Starts flagging patterns: sleep against close rate, spend against runway.' },
                { d: 'DAY 60', t: 'Writes your day before you do.', active: true },
              ].map((s) => (
                <div key={s.d} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', borderRadius: 14, background: s.active ? 'var(--mm-ink)' : 'var(--mm-panel-solid)', color: s.active ? 'var(--mm-ink-text)' : 'var(--mm-text)', border: s.active ? 'none' : '1px solid var(--mm-line)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, opacity: s.active ? 0.66 : 1, color: s.active ? undefined : 'var(--mm-faint)', width: 56, flexShrink: 0 }}>{s.d}</span>
                  <span style={{ fontSize: 14.5 }}>{s.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 20, background: 'var(--mm-code-bg)', color: 'var(--mm-code-text)', padding: 28, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 2.1, boxShadow: 'var(--mm-shadow)' }}>
            <div style={{ opacity: 0.55 }}>nova&gt; example: correlate --since 60d</div>
            <div>sleep_hours&nbsp;&nbsp;→ close_rate</div>
            <div>protein_g&nbsp;&nbsp;&nbsp;&nbsp;→ session_rpe</div>
            <div>dials&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ pipeline</div>
            <div>spend_rate&nbsp;&nbsp;&nbsp;→ runway_months</div>
            <div style={{ opacity: 0.55 }}>&gt; weak signals discarded, strongest kept</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--mm-code-line)' }}>&gt; today: dial_block(09:00, 90m) then eat(+34g)</div>
          </div>
        </section>

        <hr className="ap-hr" style={{ background: 'linear-gradient(to right, transparent, var(--mm-line), transparent)' }} />

        {/* Closing CTA */}
        <section style={{ position: 'relative', padding: '96px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', overflow: 'hidden' }}>
          <div className="mm-bloom" style={{ position: 'absolute', left: '50%', bottom: '-60%', width: 700, height: 700, transform: 'translateX(-50%)', background: 'radial-gradient(closest-side, var(--mm-bloom), transparent 70%)', animation: 'apBloom 30s ease-in-out infinite', pointerEvents: 'none' }} />
          <h2 style={{ position: 'relative', fontSize: 42, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05, maxWidth: 760, margin: 0, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>
            One login for everything you're responsible for.
          </h2>
          <p style={{ position: 'relative', fontSize: 17, lineHeight: 1.6, color: 'var(--mm-dim)', maxWidth: 480, margin: 0 }}>
            {LIVE_PLAN.price}{LIVE_PLAN.cadence}. Cancel anytime, self-serve, from inside the app.
          </p>
          <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
            <button className="mm-btn mm-btn-ink" style={{ padding: '16px 30px', fontSize: 15.5 }} onClick={() => { switchMode('signup'); scrollToLogin(); }}>Create your account</button>
            <a className="mm-btn mm-btn-outline" href="#modules" style={{ padding: '16px 30px', fontSize: 15.5 }}>See what's inside</a>
          </div>
        </section>

        <hr className="ap-hr" style={{ background: 'linear-gradient(to right, transparent, var(--mm-line), transparent)' }} />

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '32px 0 44px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/icons/icon-192.png" alt="MARQ" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain' }} />
            <div style={{ lineHeight: 1.05 }}>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.02em' }}>Masterminds</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--mm-faint)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>by marq</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--mm-faint)' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}>Modules</span>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('nova')?.scrollIntoView({ behavior: 'smooth' })}>Nova</span>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--mm-faint)' }}>© {new Date().getFullYear()} MARQ</div>
        </footer>
      </div>
    </div>
  );
}
