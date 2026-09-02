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
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-4)',
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 14,
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

/** The landing page, rebuilt against the exact "Masterminds Aperture"
 *  design-canvas markup (uploaded as Masterminds_Aperture__Complete.html) —
 *  same nav, hero + login card split, dashboard preview, module grid, "how
 *  Nova learns you" section, closing CTA, and footer, in that order.
 *
 *  Layout and structure are Aperture's, verbatim. Copy is not, in three
 *  places, because the reference file's copy describes a different
 *  product:
 *   - No "Continue with Face ID" button — this app has no Face ID/WebAuthn
 *     support, and a button that does nothing when tapped is worse than no
 *     button.
 *   - No "you cancel: MyFitnessPal, HubSpot, YNAB, Strong, PhoneBurner,
 *     Gong, Sunsama, Otter.ai, Monarch, Todoist, Fitbod, Float" ticker —
 *     this app doesn't import from or replace any of those, so naming them
 *     as things you stop paying for would be false.
 *   - No "$265/mo across eleven subscriptions, replaced by $49" — invented
 *     economics on top of the wrong price. The one real, live price
 *     (LIVE_PLAN) is used everywhere a number appears.
 *  Everything else — the module grid, the dashboard preview, the "how Nova
 *  learns you" milestones and terminal panel — uses this app's own real
 *  module list and real feature set, kept at the same illustrative-mockup
 *  register the reference uses (a browser-chrome preview, an example
 *  terminal query), not asserted as a claim about the viewer's own data. */
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
  // by role), just a different, quieter surface to land on.
  if (view === 'client-login') {
    // A dedicated teal (--client-accent, index.css) instead of the brand
    // blurple (--accent) everywhere a color shows up here — border,
    // background wash, icons, the submit button — so the whole square
    // reads as visibly different at a glance, not just differently
    // worded. Same onSignIn() underneath either way.
    const clientFieldStyle: React.CSSProperties = { ...fieldStyle, borderColor: 'color-mix(in srgb, var(--client-accent) 35%, var(--border))' };
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
              <input type="email" autoFocus placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div style={clientFieldStyle}>
              <Icon name="lock-simple" size={17} color="var(--client-accent)" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
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
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}>
      <style>{`
        @keyframes apBloom { 0%, 100% { transform: translate3d(0,0,0) scale(1); opacity: .85; } 50% { transform: translate3d(3%,-2%,0) scale(1.12); opacity: 1; } }
        @keyframes apPulse { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
        .ap-land { max-width: 1280px; margin: 0 auto; padding: 0 28px; }
        .ap-hero-grid { display: grid; grid-template-columns: 1fr 380px; gap: 56px; align-items: start; }
        .ap-h1 { font-size: 60px; line-height: .98; letter-spacing: -0.04em; font-weight: 600; margin: 0; text-wrap: balance; }
        .ap-h2 { font-size: 38px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; margin: 0; text-wrap: balance; }
        .ap-navlinks { display: flex; gap: 4px; align-items: center; }
        .ap-navlinks span { padding: 10px 14px; font-size: 14px; color: var(--text-tertiary); cursor: pointer; }
        .ap-navlinks span:hover { color: var(--text); }
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
          .ap-hero-ctas .ap-btn { width: 100%; justify-content: center; }
          .only-desktop { display: none; }
          .only-mobile { display: block; }
        }
      `}</style>

      {/* Nav — sticky, blurred, Menu pill + section links on the left,
          theme toggle + Log in + brand mark on the right. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="ap-land" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 13.5, fontWeight: 600 }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <Icon name={theme === 'light' ? 'sun' : 'moon'} size={16} />{theme === 'light' ? 'Light' : 'Dark'}
            </div>
            <span onClick={scrollToLogin} style={{ fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>Log in</span>
            <div
              onClick={openClientLogin}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid color-mix(in srgb, var(--client-accent) 40%, transparent)', fontSize: 13, color: 'var(--client-accent)', cursor: 'pointer' }}
            >
              <Icon name="users" size={15} />Client login
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, borderLeft: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Masterminds</div>
                <div style={{ fontSize: 8, letterSpacing: '0.3em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>by marq</div>
              </div>
              <img src="/icons/icon-192.png" alt="MARQ" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="ap-land">
        {/* Hero */}
        <div style={{ position: 'relative', padding: '80px 0 0', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '-6%', top: '-30%', width: '70%', height: '130%', background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent 72%)', animation: 'apBloom 26s ease-in-out infinite', pointerEvents: 'none' }} />

          <div className="ap-hero-grid" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 'max-content', padding: '7px 15px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text)', animation: 'apPulse 2.4s ease-in-out infinite' }} />
                One record. Nova reasons across all of it.
              </div>
              <h1 className="ap-h1">Your entire operation, in one place.</h1>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 540, textWrap: 'pretty' as React.CSSProperties['textWrap'] }}>
                Goals, health, money, and the business — tracked in one record, so Nova can reason across all of it
                instead of each part sitting in its own app knowing nothing about the others.
              </p>
              <div className="ap-hero-ctas">
                <button className="ap-btn ap-btn-primary" style={{ padding: '15px 26px', fontSize: 15.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => { switchMode('signup'); scrollToLogin(); }}>
                  Create your account<Icon name="arrow-right" size={18} />
                </button>
                <a className="ap-btn ap-btn-secondary" href="#modules" style={{ padding: '15px 26px', fontSize: 15.5, textAlign: 'center' }}>See what's inside</a>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
                {LIVE_PLAN.price}{LIVE_PLAN.cadence} · cancel anytime, self-serve
              </div>
            </div>

            <div id="login-card" style={{ padding: 26, borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.25))', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{mode === 'login' ? 'Log in' : 'Create your account'}</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{mode === 'login' ? 'Nova has your morning ready.' : 'Takes about a minute.'}</div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={fieldStyle}>
                  <Icon name="envelope-simple" size={17} color="var(--text-tertiary)" />
                  <input type="email" autoFocus placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <Icon name="lock-simple" size={17} color="var(--text-tertiary)" />
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
                </div>
                {mode === 'signup' && (
                  <div style={fieldStyle}>
                    <Icon name="lock-simple" size={17} color="var(--text-tertiary)" />
                    <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
                  </div>
                )}

                {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
                {notice && <div style={{ fontSize: 13, color: 'var(--success)' }}>{notice}</div>}

                <button type="submit" disabled={submitting} className="ap-btn ap-btn-primary ap-btn-block" style={{ height: 48, marginTop: 4 }}>
                  {submitting ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Continue' : 'Sign up'}
                </button>
              </form>

              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                {mode === 'login' ? (
                  <>No account?{' '}
                    <span style={{ color: 'var(--text)', borderBottom: '1px solid var(--border-2)', cursor: 'pointer' }} onClick={() => switchMode('signup')}>Start free</span>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <span style={{ color: 'var(--text)', borderBottom: '1px solid var(--border-2)', cursor: 'pointer' }} onClick={() => switchMode('login')}>Log in</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard preview — a browser-chrome mockup of the real
              Overview screen on desktop; the reference uses a completely
              different, compact "Your morning" card on mobile instead of
              just shrinking the desktop one, so this does too. Both are
              the same illustrative register (an example, not a claim about
              the viewer's own live data), just different components. */}
          <div className="only-desktop" style={{ position: 'relative', marginTop: 44, borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', background: 'var(--surface)', boxShadow: '0 30px 70px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--border-2)' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--border-2)' }} />
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--border-2)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: '5px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-4)', fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>mastermindsbymarq.com/overview</div>
              </div>
              <div style={{ width: 60 }} />
            </div>
            <div style={{ display: 'flex', minHeight: 380 }}>
              <div className="ap-preview-sidebar" style={{ flex: 'none', width: 190, borderRight: '1px solid var(--border)', background: 'var(--surface-2)', padding: '16px 12px', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
                <div style={{ padding: '6px 10px 8px', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Personal</div>
                {[
                  { icon: 'house', label: 'Overview', active: true },
                  { icon: 'clipboard-text', label: 'Daily Plan' },
                  { icon: 'fork-knife', label: 'Macros' },
                  { icon: 'barbell', label: 'Fitness' },
                  { icon: 'wallet', label: 'Budgeting' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: r.active ? 'var(--surface)' : 'transparent', border: r.active ? '1px solid var(--border)' : 'none', fontWeight: r.active ? 600 : 400, color: r.active ? 'var(--text)' : 'var(--text-tertiary)' }}>
                    <Icon name={r.icon} size={15} />{r.label}
                  </div>
                ))}
                <div style={{ padding: '14px 10px 8px', fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Cold calling</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'var(--text-tertiary)' }}><Icon name="phone-call" size={15} />Dialing</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'var(--text-tertiary)' }}><Icon name="address-book" size={15} />Contacts</div>
              </div>
              <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Example preview</div>
                    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', marginTop: 4 }}>Good morning.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11.5 }}>
                    <span style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)' }}>Today</span>
                    <span style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>Week</span>
                  </div>
                </div>
                <div className="ap-preview-kpis">
                  {[
                    { label: 'Protein', value: '168', sub: '/202g', pct: 83 },
                    { label: 'Dials', value: '42', sub: '/100', pct: 42 },
                    { label: 'Pipeline', value: '$84k', sub: '3 closing' },
                    { label: 'Runway', value: '7.4', sub: 'mo · +0.3 wk' },
                  ].map((t) => (
                    <div key={t.label} style={{ padding: 14, borderRadius: 14, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{t.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em' }}>{t.value}<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.sub}</span></div>
                      {t.pct !== undefined && (
                        <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-4)' }}>
                          <div style={{ width: `${t.pct}%`, height: '100%', borderRadius: 4, background: 'var(--text)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--text)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                    <Icon name="sparkle" size={15} />Nova
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    Example: "Sleep ran short last night — dial block moved earlier, food logged after."
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile's own compact preview — a single "Your morning" card
              (kicker + time, a 2-tile stat row, a Nova insight with its own
              CTA) instead of a shrunk copy of the desktop browser-chrome
              mockup, matching the reference's actual mobile artboard. */}
          <div className="only-mobile" style={{ marginTop: 32, borderRadius: 22, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 20px 50px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Your morning</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                {[
                  { label: 'Protein', value: '168', sub: '/202g', pct: 83 },
                  { label: 'Dials', value: '42', sub: '/100', pct: 42 },
                ].map((t) => (
                  <div key={t.label} style={{ padding: 13, borderRadius: 14, background: 'var(--surface-3)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{t.label}</div>
                    <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em' }}>{t.value}<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.sub}</span></div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-4)' }}>
                      <div style={{ width: `${t.pct}%`, height: '100%', borderRadius: 4, background: 'var(--text)' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: 15, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                  <Icon name="sparkle" size={14} />Nova
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                  Example: "Sleep ran short — dial block moved earlier, food logged after."
                </div>
                <div
                  onClick={() => { switchMode('signup'); scrollToLogin(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--text)', color: 'var(--bg)', fontSize: 13, cursor: 'pointer' }}
                >
                  Try it free<Icon name="arrow-right" size={15} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="ap-hr" style={{ margin: '56px 0 0' }} />

        {/* What it replaces — real price, no invented competitor math. */}
        <section style={{ padding: '72px 0 20px' }}>
          <div className="ap-card-kicker">What it replaces</div>
          <div className="ap-replaces-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 48, marginTop: 10 }}>
            <h2 className="ap-h2" style={{ maxWidth: 640 }}>One record instead of a dozen apps that don't talk to each other.</h2>
            <div style={{ flex: 'none', padding: '24px 28px', borderRadius: 20, background: 'var(--text)', color: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.66 }}>Your plan</div>
              <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{LIVE_PLAN.price}<span style={{ fontSize: 16, opacity: 0.66, fontWeight: 500 }}>{LIVE_PLAN.cadence}</span></div>
              <div style={{ fontSize: 12.5, opacity: 0.66 }}>Cancel anytime, self-serve</div>
            </div>
          </div>
        </section>

        {/* Module grid — real modules from MODULE_REGISTRY, plus Nova. */}
        <section id="modules" style={{ padding: '32px 0 20px' }}>
          <div className="ap-module-grid">
            {showcaseModules.map((m) => (
              <div key={m.key} style={{ padding: 24, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Icon name={m.icon} size={24} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>included</span>
                </div>
                <div style={{ fontSize: 18.5, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.label}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{m.description}</div>
              </div>
            ))}
            <div style={{ padding: 24, borderRadius: 20, background: 'var(--text)', color: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

        <hr className="ap-hr" style={{ margin: '20px 0 0' }} />

        {/* Pricing — the reference's own Pricing artboard is a 3-tier
            comparison (Operator/Mastermind/Table) with a line-by-line
            fake-vendor cost table and a 14-day trial. None of that maps
            onto this product: there's one live tier, no free trial (you're
            charged at signup, same as the rest of this file's copy has
            said from the start), and no team/multi-seat plan. Same layout
            language (kicker, big headline, card grid, line-item table,
            FAQ) with only the two tiers that are real — the live plan and
            the still-undecided "coming soon" slot from billing/plans.ts —
            and a real full module list standing in for the fabricated
            cost-comparison table. */}
        <section id="pricing" style={{ padding: '72px 0', display: 'flex', flexDirection: 'column', gap: 48 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="ap-card-kicker">Pricing</div>
            <h2 className="ap-h2" style={{ maxWidth: 720 }}>One plan for the whole system, not eleven bills for pieces of it.</h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 560, margin: 0 }}>
              Every module includes Nova. No per-seat pricing, no usage meter — turn on what you need from Settings any time.
            </p>
          </div>

          <div className="ap-pricing-cards">
            <div style={{ position: 'relative', padding: 30, borderRadius: 22, background: 'var(--text)', color: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
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
                style={{ marginTop: 'auto', padding: 15, borderRadius: 12, background: 'var(--bg)', color: 'var(--text)', textAlign: 'center', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Create your account
              </div>
            </div>

            {comingSoonPlan && (
              <div style={{ padding: 30, borderRadius: 22, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{comingSoonPlan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--text-tertiary)' }}>{comingSoonPlan.price}</div>
                    <div style={{ fontSize: 15, color: 'var(--text-tertiary)', paddingBottom: 6 }}>{comingSoonPlan.cadence}</div>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{comingSoonPlan.tagline}</div>
                </div>
                <div style={{ marginTop: 'auto', padding: 15, borderRadius: 12, border: '1px solid var(--border-2)', textAlign: 'center', fontSize: 14.5, color: 'var(--text-tertiary)' }}>
                  Not open yet
                </div>
              </div>
            )}
          </div>

          {/* Real module list standing in for the reference's fabricated
              vendor-cost table — same line-item layout, honest content. */}
          <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 16, textAlign: 'center' }}>Everything included</div>
            <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {includedModules.map((m, i) => (
                <div key={m.key} className="ap-compare-row" style={{ padding: '14px 20px', borderBottom: i === includedModules.length - 1 ? 'none' : '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name={m.icon} size={17} color="var(--text-tertiary)" />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>Included</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div className="ap-card-kicker">Straight answers</div>
            <h3 className="ap-h2" style={{ fontSize: 30, maxWidth: 600 }}>The things people ask before switching.</h3>
          </div>
          <div className="ap-faq-grid" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
            {[
              { q: 'Is there a free trial?', a: `No — ${LIVE_PLAN.price}${LIVE_PLAN.cadence} starts at signup. No card-then-forget trial period to track.` },
              { q: 'Can I turn modules on and off?', a: 'Yes, any time from Settings → Manage modules. Nova only reads what you\'ve turned on.' },
              { q: 'What does Nova do with my data?', a: 'Reasons across your own record to answer questions and surface patterns — nothing more, and nothing shared outside your account.' },
              { q: 'If I cancel?', a: 'Self-serve from Settings, no call required.' },
            ].map((f) => (
              <div key={f.q} style={{ padding: '18px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{f.q}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className="ap-hr" style={{ margin: '20px 0 0' }} />

        {/* How Nova learns you — the actual explanation the nav's "Nova"
            link should land on, not the small module-grid card above
            (which is sized/worded like every other module tile and
            explains nothing on its own). */}
        <section id="nova" className="ap-nova-learn-grid" style={{ padding: '72px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="ap-card-kicker">How Nova learns you</div>
            <h2 className="ap-h2">Separate apps can't see each other. Yours share one record.</h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text-secondary)', maxWidth: 460 }}>
              Nova tests every stream against your own outcomes and keeps what actually predicts something. No pep
              talks — the pattern, and the next move.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {[
                { d: 'DAY 3', t: 'Learns your real routine — when you actually train, eat, and work.' },
                { d: 'DAY 9', t: 'Starts flagging patterns: sleep against close rate, spend against runway.' },
                { d: 'DAY 60', t: 'Writes your day before you do.', active: true },
              ].map((s) => (
                <div key={s.d} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 18px', borderRadius: 14, background: s.active ? 'var(--text)' : 'var(--surface)', color: s.active ? 'var(--bg)' : 'var(--text)', border: s.active ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, opacity: s.active ? 0.66 : 1, color: s.active ? undefined : 'var(--text-tertiary)', width: 56, flexShrink: 0 }}>{s.d}</span>
                  <span style={{ fontSize: 14.5 }}>{s.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderRadius: 20, background: 'var(--surface-4)', color: 'var(--text-secondary)', padding: 28, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 2.1, boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}>
            <div style={{ opacity: 0.55 }}>nova&gt; example: correlate --since 60d</div>
            <div>sleep_hours&nbsp;&nbsp;→ close_rate</div>
            <div>protein_g&nbsp;&nbsp;&nbsp;&nbsp;→ session_rpe</div>
            <div>dials&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ pipeline</div>
            <div>spend_rate&nbsp;&nbsp;&nbsp;→ runway_months</div>
            <div style={{ opacity: 0.55 }}>&gt; weak signals discarded, strongest kept</div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>&gt; today: dial_block(09:00, 90m) then eat(+34g)</div>
          </div>
        </section>

        <hr className="ap-hr" />

        {/* Closing CTA */}
        <section style={{ position: 'relative', padding: '96px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '50%', bottom: '-60%', width: 700, height: 700, transform: 'translateX(-50%)', background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)', animation: 'apBloom 30s ease-in-out infinite', pointerEvents: 'none' }} />
          <h2 style={{ position: 'relative', fontSize: 42, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05, maxWidth: 760, margin: 0, textWrap: 'balance' as React.CSSProperties['textWrap'] }}>
            One login for everything you're responsible for.
          </h2>
          <p style={{ position: 'relative', fontSize: 17, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 480, margin: 0 }}>
            {LIVE_PLAN.price}{LIVE_PLAN.cadence}. Cancel anytime, self-serve, from inside the app.
          </p>
          <div style={{ position: 'relative', display: 'flex', gap: 10 }}>
            <button className="ap-btn ap-btn-primary" style={{ padding: '16px 30px', fontSize: 15.5 }} onClick={() => { switchMode('signup'); scrollToLogin(); }}>Create your account</button>
            <a className="ap-btn ap-btn-secondary" href="#modules" style={{ padding: '16px 30px', fontSize: 15.5 }}>See what's inside</a>
          </div>
        </section>

        <hr className="ap-hr" />

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '32px 0 44px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/icons/icon-192.png" alt="MARQ" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain' }} />
            <div style={{ lineHeight: 1.05 }}>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.02em' }}>Masterminds</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>by marq</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}>Modules</span>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('nova')?.scrollIntoView({ behavior: 'smooth' })}>Nova</span>
            <span style={{ cursor: 'pointer' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>© {new Date().getFullYear()} MARQ</div>
        </footer>
      </div>
    </div>
  );
}
