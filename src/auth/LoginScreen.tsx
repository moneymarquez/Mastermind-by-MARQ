import { useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

export default function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const err = await onSignIn(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0B0D', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 24, left: 24, lineHeight: 1.1 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F6F7', letterSpacing: '-0.01em' }}>Masterminds</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F5F6F7', letterSpacing: '0.04em', marginTop: 2 }}>by MARQ</div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: 340, maxWidth: '90vw', background: '#14161A', border: '1px solid #22262B',
          borderRadius: 16, padding: '32px 28px',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F5F6F7', marginBottom: 24 }}>Login</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, color: '#8A8F98', display: 'block', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '10px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11.5, color: '#8A8F98', display: 'block', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '10px 12px', color: '#F5F6F7', fontSize: 13.5, outline: 'none' }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: '#8A8F98', marginBottom: 16 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%', padding: '11px 18px', borderRadius: 999, border: 'none',
            background: '#F5F6F7', color: '#0A0B0D', fontSize: 13.5, fontWeight: 600,
            cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
