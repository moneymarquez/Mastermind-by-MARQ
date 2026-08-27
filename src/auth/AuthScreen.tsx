import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SignUpResult } from './useAuth';
import { LIVE_PLAN } from '../billing/plans';

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<SignUpResult>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--text-label)', outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-small)', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 };

/** The landing page, on Aperture's structure: a nav bar, a hero paired
 *  with the sign-in card rather than split across a hard divider, then
 *  the supporting sections and a footer.
 *
 *  The LetterGlitch that used to cover this page is gone. Two reasons:
 *  Aperture carries its own ground and doesn't have a character-rain
 *  treatment, and the effect was hardcoded to the pre-Aperture neutral
 *  blacks (#17191d / #22262B / #565b64), so it was still painting the old
 *  palette over the whole screen — which is why the page looked unchanged
 *  after the palette landed. The component is still in
 *  components/LetterGlitch.tsx if it's ever wanted elsewhere.
 *
 *  On copy: Aperture's landing ships marketing text for a product with
 *  eleven named integrations, a 14-day trial, and $29/$49/$99 tiers. None
 *  of that exists here — there are no importers, billing charges on
 *  signup, and there's one live tier. The layout is Aperture's; the claims
 *  are this app's, because the alternative is advertising things that
 *  aren't real to people who are about to pay. */
export default function AuthScreen({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setError(null);
    setNotice(null);
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
      // Session issued immediately (email confirmation disabled) — App.tsx's
      // auth-state listener picks it up and mounts AuthedGate on its own;
      // nothing else to do here.
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
        .ap-land { max-width: 1120px; margin: 0 auto; padding: 0 28px; }
        .ap-hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 56px; align-items: center;
                   padding: 72px 0 88px; }
        .ap-h1 { font-size: 42px; line-height: 1.12; letter-spacing: -0.015em; font-weight: 500; margin: 0; }
        .ap-sections { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ap-days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 900px) {
          .ap-hero { grid-template-columns: 1fr; gap: 36px; padding: 40px 0 56px; }
          .ap-h1 { font-size: 32px; }
          .ap-sections, .ap-days { grid-template-columns: 1fr; }
          .ap-navlinks { display: none; }
        }
      `}</style>

      {/* Nav — Aperture's .nav: brand pushes the links right, links go
          accent on hover, no bottom border. */}
      <div className="ap-land">
        <nav className="ap-nav" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 20 }}>
          <div className="ap-nav-brand" style={{ lineHeight: 1.05 }}>
            Masterminds
            <div style={{ fontSize: 'var(--text-nano)', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>BY MARQ</div>
          </div>
          <div className="ap-navlinks" style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <a href="#modules">Modules</a>
            <a href="#nova">Nova</a>
            <a href="#pricing">Pricing</a>
          </div>
        </nav>

        <div className="ap-hero">
          <div>
            <div className="ap-tag ap-tag-outline" style={{ marginBottom: 20 }}>One record · one login</div>
            <h1 className="ap-h1">Your entire operation, in one place.</h1>
            <p style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', marginTop: 20, maxWidth: 480, lineHeight: 1.65 }}>
              Goals, health, money, and the business — tracked in one record, so Nova can reason across all of it
              instead of each part sitting in its own app knowing nothing about the others.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
              <button className="ap-btn ap-btn-primary" style={{ padding: '10px 18px' }} onClick={() => switchMode('signup')}>
                Create your account
              </button>
              <a className="ap-btn ap-btn-secondary" href="#pricing" style={{ padding: '10px 18px' }}>See pricing</a>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 14 }}>
              {LIVE_PLAN.price}{LIVE_PLAN.cadence} · cancel anytime, self-serve
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 380, justifySelf: 'end' }}>
          <form
            onSubmit={handleSubmit}
            className="ap-elev-md"
            style={{ width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '30px 26px' }}
          >
            <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {mode === 'login' ? 'Log in' : 'Create your account'}
            </div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginBottom: 24 }}>
              {mode === 'login' ? 'Welcome back.' : 'Takes about a minute.'}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: mode === 'signup' ? 14 : 20 }}>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            </div>

            {mode === 'signup' && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
              </div>
            )}

            {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginBottom: 16 }}>{error}</div>}
            {notice && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--success)', marginBottom: 16 }}>{notice}</div>}

            <button type="submit" disabled={submitting} className="ap-btn ap-btn-primary ap-btn-block" style={{ padding: '11px 18px' }}>
              {submitting ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Login' : 'Sign up'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('signup')}>Sign up</span>
                </>
              ) : (
                <>Already have an account?{' '}
                  <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('login')}>Log in</span>
                </>
              )}
            </div>
          </form>
          </div>
        </div>

        <hr className="ap-hr" />

        {/* What's actually in the product — every one of these is a module
            that exists and is reachable today. */}
        <section id="modules" style={{ padding: '56px 0' }}>
          <div className="ap-card-kicker">The system</div>
          <h2 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em', margin: '10px 0 8px' }}>
            One record, not eleven dashboards.
          </h2>
          <p style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', maxWidth: 620, lineHeight: 1.65, marginBottom: 28 }}>
            Turn on the parts you need. Everything you enable writes to the same record, which is what lets Nova
            reason across it.
          </p>
          <div className="ap-sections">
            {[
              { k: 'Personal', t: 'The day itself', b: 'Daily plan, schedule, macros and meals, fitness, goals, sobriety, mental health.' },
              { k: 'Money', t: 'What it costs and earns', b: 'Budgeting, subscription tracking, cash-flow forecasting, invoicing.' },
              { k: 'Business', t: 'The work that pays', b: 'Cold-calling queue and contacts, call recordings, client CRM, scaling tools.' },
            ].map((c) => (
              <div key={c.k} className="ap-card" style={{ padding: 18 }}>
                <div className="ap-card-kicker">{c.k}</div>
                <div className="ap-card-title">{c.t}</div>
                <p className="ap-card-body" style={{ color: 'var(--text-secondary)' }}>{c.b}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="ap-hr" />

        <section id="nova" style={{ padding: '56px 0' }}>
          <div className="ap-card-kicker">Nova</div>
          <h2 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em', margin: '10px 0 8px' }}>
            Separate apps can't see each other. Yours share one record.
          </h2>
          <p style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', maxWidth: 620, lineHeight: 1.65, marginBottom: 28 }}>
            Nova reads and writes across every module you've turned on — so it can answer with your actual numbers,
            file things where they belong, and surface patterns that only show up when the data sits together.
          </p>
          <div className="ap-days">
            {[
              { d: 'Ask', t: 'Questions against your own data, not generic advice.' },
              { d: 'Capture', t: 'Speak a task, expense, or contact — it files itself into the right module.' },
              { d: 'Notice', t: 'Cross-module patterns: spending against sobriety, calls against workouts.' },
            ].map((s) => (
              <div key={s.d} className="ap-card" style={{ padding: 18 }}>
                <div className="ap-card-kicker">{s.d}</div>
                <p className="ap-card-body" style={{ color: 'var(--text-secondary)' }}>{s.t}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="ap-hr" />

        <section id="pricing" style={{ padding: '56px 0 72px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 10px' }}>
            One login for everything you're responsible for.
          </h2>
          <p style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 10px', lineHeight: 1.65 }}>
            {LIVE_PLAN.price}{LIVE_PLAN.cadence}. Cancel anytime, self-serve, from inside the app.
          </p>
          <div style={{ display: 'inline-flex', gap: 10, marginTop: 18 }}>
            <button className="ap-btn ap-btn-primary" style={{ padding: '11px 20px' }} onClick={() => switchMode('signup')}>
              Create your account
            </button>
          </div>
        </section>

        <hr className="ap-hr" />

        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '22px 0 40px', flexWrap: 'wrap' }}>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontWeight: 500, fontSize: 'var(--text-head)' }}>Masterminds</div>
            <div style={{ fontSize: 'var(--text-nano)', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>BY MARQ</div>
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>© {new Date().getFullYear()} MARQ</div>
        </footer>
      </div>
    </div>
  );
}
