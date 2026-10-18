import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SignUpResult } from './useAuth';
import Icon from '../Icon';
import { startDemo } from '../demo/state';
import { hasPendingJoin } from '../dispatch/join';

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<SignUpResult>;
  onResetPassword: (email: string) => Promise<string | null>;
}

const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11, height: 48, padding: '0 15px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--mm-line)', background: 'var(--mm-field, var(--mm-panel))',
};
/** The sign-in uses the public site's look: warm paper, ink, one cobalt action, Instrument Sans. */
const SITE = { paper: '#fbf9f4', ink: '#1b1a17', mute: '#6b665c', line: '#ddd8cc', card: '#ffffff', cobalt: '#5266eb', sans: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif", mono: "'IBM Plex Mono', ui-monospace, Menlo, monospace" };
const siteField: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, height: 50, padding: '0 14px', borderRadius: 10, border: `1px solid ${SITE.line}`, background: '#fff' };
const siteInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: SITE.ink, fontSize: 16, fontFamily: 'inherit', minWidth: 0 };
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--mm-text)', fontSize: 14,
};

/** Sign in, sign up and password reset. The marketing that used to live on
 *  this screen moved to the public site (/home, src/site); signed-out
 *  visitors reach this screen through /?login, /?signup, an invite, an auth
 *  link, or an installed app. */
export default function AuthScreen({ onSignIn, onSignUp, onResetPassword }: Props) {
  // Separate from the owner/subscriber landing entirely — a client gets
  // its own button in the nav, its own minimal screen (no hero, no
  // pricing, no module grid), not a copy-swap inside the sales page's
  // login card. The underlying sign-in call is identical either way
  // (onSignIn) — AuthedGate routes by role after; only the surface a
  // client actually sees differs.
  const [view, setView] = useState<'main' | 'client-login'>('main');
  // /forgot-password (and /reset-password) open straight into the reset form.
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(() => {
    if (typeof window === 'undefined') return 'login';
    if (/^\/(forgot|reset)-password\/?$/.test(window.location.pathname)) return 'reset';
    return new URLSearchParams(window.location.search).has('signup') ? 'signup' : 'login';
  });
  // A signed-out visitor on the bare root belongs on the public site. index.html
  // already sends them there, but skips it when a stale sign-in token is in storage
  // (an expired session on a phone), which left them on this old sign-in landing.
  useEffect(() => {
    try {
      const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (window.location.pathname === '/' && !window.location.search && !window.location.hash && !standalone) window.location.replace('/home');
    } catch { /* stay on the sign-in */ }
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The public site always renders light — dark/light is a preference for
  // the authenticated app only (Settings, via useTheme.ts), never exposed
  // here. Forcing the attribute on mount (rather than leaving whatever a
  // previous session cached) is what makes that true regardless of what
  // data-theme happened to be set to before this screen mounted; the
  // authenticated app re-applies the real saved preference the moment
  // AuthedGate mounts (useTheme's own load effect), so this never leaks
  // past login.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // An expired or already-used reset link comes back as
  // #error=access_denied&error_code=otp_expired&error_description=… —
  // say so and put them on the reset form instead of a silent homepage.
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = h.get('error_code') ?? h.get('error');
    const onResetPath = /^\/(forgot|reset)-password\/?$/.test(window.location.pathname);
    if (code) {
      setMode('reset');
      setError(code === 'otp_expired' || /expired|invalid/i.test(h.get('error_description') ?? '')
        ? 'That reset link has expired or was already used. Enter your email and we\'ll send a new one.'
        : (h.get('error_description') ?? 'That link didn\'t work.').replace(/\+/g, ' '));
    }
    if (code || onResetPath) {
      window.history.replaceState(window.history.state, '', '/');
      setTimeout(() => document.getElementById('login-card')?.scrollIntoView({ block: 'center' }), 50);
    }
  }, []);

  const switchMode = (next: 'login' | 'signup' | 'reset') => {
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
    const err = await onSignIn(email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (err) setError(err);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'reset') {
      if (!email.trim()) return;
      setSubmitting(true);
      const err = await onResetPassword(email.trim().toLowerCase());
      setSubmitting(false);
      if (err) {
        setError(err);
        return;
      }
      setNotice("If that email has an account, a reset link is on its way — check your inbox.");
      return;
    }

    if (!email.trim() || !password) return;

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
      const result = await onSignUp(email.trim().toLowerCase(), password);
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
    const err = await onSignIn(email.trim().toLowerCase(), password);
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
              <input type="email" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, color: 'var(--text)' }} />
            </div>
            <div style={clientFieldStyle}>
              <Icon name="lock-simple" size={17} color="var(--client-accent)" />
              <input type="password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, color: 'var(--text)' }} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="ap-btn ap-btn-block"
              style={{ height: 48, marginTop: 4, background: 'var(--client-accent)', color: 'var(--text-on-color)', border: 'none' }}
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
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: SITE.paper, color: SITE.ink, fontFamily: SITE.sans, display: 'flex', flexDirection: 'column' } as React.CSSProperties}>
      <style>{`
        .mm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; text-decoration: none; font-weight: 600; border-radius: 999px; border: 1px solid transparent; }
        .mm-btn-ink { background: #5266eb; color: #fff; font-family: inherit; font-size: 16px; font-weight: 500; }
        .mm-btn-ink:hover { background: #4356d9; }
        .mm-btn-ink:disabled { opacity: .6; cursor: default; }
        .wl-auth input::placeholder { color: #8f8a7f; opacity: 1; }
        .wl-auth :focus-visible { outline: 2px solid #5266eb; outline-offset: 2px; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <a href="/home" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1b1a17', textDecoration: 'none' }}>
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 8, background: '#1b1a17', color: 'var(--mm-canvas)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, lineHeight: '10px' }}><span>MA</span><span>RQ</span></span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}><span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Masterminds</span><span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '.22em', opacity: 0.72 }}>BY MARQ</span></span>
        </a>
        <button
          type="button"
          onClick={openClientLogin}
          style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '8px 14px', borderRadius: 999, background: 'none', border: '1px solid color-mix(in srgb, var(--client-accent) 40%, transparent)', fontSize: 13, color: 'var(--client-accent)', cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' }}
        >
          <Icon name="users" size={15} />Client login
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div id="login-card" className="wl-auth" style={{ padding: 28, borderRadius: 12, border: '1px solid #e2ddd2', background: SITE.card, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {hasPendingJoin() && (
                <div role="status" style={{ padding: '12px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', fontSize: 14, lineHeight: 1.45 }}>
                  You've been invited to a team. Log in — or create a free login — and your tasks will be waiting. No subscription needed.
                </div>
              )}
              <div>
                <div style={{ fontFamily: SITE.mono, fontSize: 11, fontWeight: 500, letterSpacing: '.14em', color: SITE.mute, marginBottom: 8 }}>{mode === 'login' ? 'LOG IN' : mode === 'signup' ? 'JOIN' : 'RESET'}</div>
                <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 480, letterSpacing: '-0.02em' }}>
                  {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
                </div>
                <div style={{ fontSize: 15, color: SITE.mute, marginTop: 6, lineHeight: 1.5 }}>
                  {mode === 'login' ? 'Nova has your morning ready.' : mode === 'signup' ? 'Takes about a minute.' : "We'll email you a link to set a new one."}
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={siteField}>
                  <Icon name="envelope-simple" size={17} color={SITE.mute} />
                  <input style={siteInput} type="email" name="email" autoComplete={mode === 'signup' ? 'email' : 'username'} inputMode="email" aria-label="Email" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode !== 'reset' && (
                  <div style={siteField}>
                    <Icon name="lock-simple" size={17} color={SITE.mute} />
                    <input style={siteInput} type="password" name="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                )}
                {mode === 'signup' && (
                  <div style={siteField}>
                    <Icon name="lock-simple" size={17} color={SITE.mute} />
                    <input style={siteInput} type="password" name="confirm-password" autoComplete="new-password" aria-label="Confirm password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                )}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: -2 }}>
                    <span style={{ fontSize: 12.5, color: '#6b665c', cursor: 'pointer' }} onClick={() => switchMode('reset')}>Forgot password?</span>
                  </div>
                )}

                {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
                {notice && <div style={{ fontSize: 13, color: 'var(--success)' }}>{notice}</div>}

                <button type="submit" disabled={submitting} className="mm-btn mm-btn-ink" style={{ height: 48, marginTop: 4, width: '100%' }}>
                  {submitting
                    ? (mode === 'login' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending…')
                    : (mode === 'login' ? 'Continue' : mode === 'signup' ? 'Sign up' : 'Send reset link')}
                </button>
              </form>

              <div style={{ fontSize: 13, color: '#6b665c', textAlign: 'center' }}>
                {mode === 'login' && (
                  <>No account?{' '}
                    <button type="button" style={{ color: '#1b1a17', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3, padding: '8px 2px', font: 'inherit' }} onClick={() => switchMode('signup')}>Create an account</button>
                  </>
                )}
                {mode === 'signup' && (
                  <>Already have an account?{' '}
                    <span style={{ color: '#1b1a17', borderBottom: '1px solid #c9c3b5', cursor: 'pointer' }} onClick={() => switchMode('login')}>Log in</span>
                  </>
                )}
                {mode === 'reset' && (
                  <span style={{ color: '#1b1a17', borderBottom: '1px solid #c9c3b5', cursor: 'pointer' }} onClick={() => switchMode('login')}>← Back to log in</span>
                )}
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <a href="/privacy" style={{ color: '#6b665c', textDecoration: 'underline', textUnderlineOffset: 3, padding: '10px 2px' }}>Privacy Policy</a>
                  <a href="/terms" style={{ color: '#6b665c', textDecoration: 'underline', textUnderlineOffset: 3, padding: '10px 2px' }}>Terms &amp; Conditions</a>
                </div>
              </div>
            </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
            <a href="/home" style={{ color: '#6b665c', textDecoration: 'underline', textUnderlineOffset: 3, padding: '8px 2px' }}>Back to Masterminds</a>
            <button type="button" onClick={() => startDemo()} style={{ color: '#6b665c', textDecoration: 'underline', textUnderlineOffset: 3, padding: '8px 2px', background: 'none', border: 'none', font: 'inherit', cursor: 'pointer' }}>See a 2-minute demo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
