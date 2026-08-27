import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  initialName: string;
  onComplete: (name: string) => Promise<void>;
}

const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '13px 16px', color: 'var(--text)', fontSize: 18, fontWeight: 600, outline: 'none', boxSizing: 'border-box', textAlign: 'center',
};

export default function AiNamingStep({ initialName, onComplete }: Props) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await onComplete(name.trim());
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Name your AI</div>
        <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
          This is who you'll be talking to throughout the app — reads your data, writes to it, and keeps up with you over time.
        </div>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          style={{
            width: '100%', marginTop: 20, padding: '13px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
            fontSize: 'var(--text-body-lg)', fontWeight: 600, cursor: !name.trim() || submitting ? 'default' : 'pointer', opacity: !name.trim() || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : `Continue with "${name.trim() || '...'}"`}
        </button>
      </div>
    </div>
  );
}
