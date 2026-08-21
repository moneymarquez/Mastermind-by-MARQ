import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SignUpResult } from './useAuth';
import LetterGlitch from '../components/LetterGlitch';

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<SignUpResult>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8,
  padding: '10px 12px', color: 'var(--text)', fontSize: 13.5, outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

// Split-screen layout — a brand/hero side and a clean minimal form side —
// loosely structured after Instagram's login page (panel split, simple
// centered form, minimal chrome). Not a visual copy: no borrowed colors,
// imagery, or branding, just the same two-pane shape, in this app's own
// dark theme. The hero pane hides below ~860px via the stylesheet below,
// same as Instagram's own mobile view collapsing to just the form.
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', position: 'relative' }}>
      <style>{`
        .auth-hero { display: flex; }
        @media (max-width: 860px) { .auth-hero { display: none; } }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <LetterGlitch
          glitchColors={['#17191d', '#22262B', '#565b64']}
          glitchSpeed={90}
          smooth
          centerVignette
          outerVignette
        />
      </div>

      <div
        className="auth-hero"
        style={{
          flex: 1, position: 'relative', zIndex: 1, flexDirection: 'column', justifyContent: 'center', padding: '0 64px',
          borderRight: '1px solid #17191d', pointerEvents: 'none',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 2 }}>Masterminds</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: 40 }}>by MARQ</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text)', lineHeight: 1.15, maxWidth: 460, letterSpacing: '-0.02em' }}>
            Your entire operation, in one place.
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginTop: 18, maxWidth: 420, lineHeight: 1.6 }}>
            Goals, health, business, and everything in between — tracked, planned, and pushed forward by Nova, day after day.
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <form
            onSubmit={handleSubmit}
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {mode === 'login' ? 'Log in' : 'Create your account'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 24 }}>
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

            {error && <div style={{ fontSize: 12.5, color: '#c47a7a', marginBottom: 16 }}>{error}</div>}
            {notice && <div style={{ fontSize: 12.5, color: '#8fae8f', marginBottom: 16 }}>{notice}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '11px 18px', borderRadius: 999, border: 'none',
                background: 'var(--text)', color: 'var(--bg)', fontSize: 13.5, fontWeight: 600,
                cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Login' : 'Sign up'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {mode === 'login' ? (
                <>Don't have an account?{' '}
                  <span style={{ color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('signup')}>Sign up</span>
                </>
              ) : (
                <>Already have an account?{' '}
                  <span style={{ color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }} onClick={() => switchMode('login')}>Log in</span>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
