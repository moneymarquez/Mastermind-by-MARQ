import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  initialName: string;
  onComplete: (name: string) => Promise<void>;
}

const inputStyle: CSSProperties = {
  width: '100%', background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
  padding: '13px 16px', color: '#F5F6F7', fontSize: 18, fontWeight: 600, outline: 'none', boxSizing: 'border-box', textAlign: 'center',
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
    <div style={{ minHeight: '100vh', background: '#0A0B0D', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#F5F6F7', marginBottom: 8 }}>Name your AI</div>
        <div style={{ fontSize: 13.5, color: '#8A8F98', marginBottom: 28, lineHeight: 1.6 }}>
          This is who you'll be talking to throughout the app — reads your data, writes to it, and keeps up with you over time.
        </div>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          style={{
            width: '100%', marginTop: 20, padding: '13px 18px', borderRadius: 999, border: 'none', background: '#F5F6F7', color: '#0A0B0D',
            fontSize: 13.5, fontWeight: 600, cursor: !name.trim() || submitting ? 'default' : 'pointer', opacity: !name.trim() || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? 'Saving…' : `Continue with "${name.trim() || '...'}"`}
        </button>
      </div>
    </div>
  );
}
