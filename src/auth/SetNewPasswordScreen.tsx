import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '../Icon';

interface Props {
  onComplete: (newPassword: string) => Promise<string | null>;
}

const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11, height: 48, padding: '0 15px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--mm-line)', background: 'var(--mm-field, var(--mm-panel))',
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--mm-text)', fontSize: 14,
};

/** Reached by clicking the link in a password-reset email — Supabase
 *  hands the app a real (but reset-only) session and fires
 *  PASSWORD_RECOVERY, which useAuth.ts turns into passwordRecovery=true.
 *  App.tsx routes here instead of into the normal authed app for as long
 *  as that's true, regardless of session presence — this session is only
 *  good for setting a new password, not for using the product. */
export default function SetNewPasswordScreen({ onComplete }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Same reasoning as AuthScreen.tsx: the pre-auth "ink" system always
  // renders light, independent of whatever theme was cached from a
  // previous session.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const err = await onComplete(password);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div
      style={{
        height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'var(--mm-text)',
        background: 'var(--mm-canvas)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--mm-panel)', border: '1px solid var(--mm-line2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock-simple" size={22} color="var(--mm-text)" />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Set a new password</div>
          <div style={{ fontSize: 13.5, color: 'var(--mm-faint)' }}>You'll be signed in right after.</div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 24, borderRadius: 'var(--radius-xl)', border: '1px solid var(--mm-line)', background: 'var(--mm-panel-solid)', boxShadow: 'var(--mm-shadow)' }}
        >
          <div style={fieldStyle}>
            <Icon name="lock-simple" size={17} color="var(--mm-faint)" />
            <input type="password" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <Icon name="lock-simple" size={17} color="var(--mm-faint)" />
            <input type="password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
          <button type="submit" disabled={submitting} style={{ height: 48, marginTop: 4, width: '100%', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15, borderRadius: 999, background: 'var(--mm-ink)', color: 'var(--mm-ink-text)' }}>
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}
