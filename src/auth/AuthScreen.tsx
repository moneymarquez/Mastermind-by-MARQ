import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SignUpResult } from './useAuth';
import { LIVE_PLAN } from '../billing/plans';
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
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
        @media (max-width: 900px) {
          .ap-hero-grid { grid-template-columns: 1fr; gap: 32px; }
          .ap-h1 { font-size: 38px; }
          .ap-h2 { font-size: 28px; }
          .ap-navlinks { display: none; }
          .ap-module-grid { grid-template-columns: 1fr; }
          .ap-replaces-row { flex-direction: column; align-items: flex-start !important; gap: 20px !important; }
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="ap-btn ap-btn-primary" style={{ padding: '15px 26px', fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { switchMode('signup'); scrollToLogin(); }}>
                  Create your account<Icon name="arrow-right" size={18} />
                </button>
                <a className="ap-btn ap-btn-secondary" href="#modules" style={{ padding: '15px 26px', fontSize: 15.5 }}>See what's inside</a>
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

          {/* Dashboard preview — browser-chrome mockup of the real Overview
              screen with real module names, kept at the same illustrative
              register as the reference's own preview: an example, not a
              claim about the viewer's own live data. */}
          <div style={{ position: 'relative', marginTop: 44, borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', background: 'var(--surface)', boxShadow: '0 30px 70px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
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
            <div id="nova" style={{ padding: 24, borderRadius: 20, background: 'var(--text)', color: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

        {/* How Nova learns you */}
        <section style={{ padding: '72px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
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
        <section id="pricing" style={{ position: 'relative', padding: '96px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center', overflow: 'hidden' }}>
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
