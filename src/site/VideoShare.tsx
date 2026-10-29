import { useEffect, useState } from 'react';

// Public video page: /v/<token>. No login. Watch, then reply or book a call.
export default function VideoShare({ token }: { token: string }) {
  const [v, setV] = useState<{ title: string; sender: string; url: string; mime: string | null; book: string } | null>(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ name: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void fetch(`/api/video/view?t=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error ?? 'This link isn\'t valid.'); else setV(j); }).catch(() => setErr('Couldn\'t load the video.'));
  }, [token]);
  const reply = async () => {
    setBusy(true); setErr('');
    const r = await fetch('/api/video/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token, ...f }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.error ?? 'Couldn\'t send.'); else setSent(true);
  };
  const input: React.CSSProperties = { height: 44, padding: '0 12px', fontSize: 16, borderRadius: 8, border: '1px solid #ccc', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  const btn = (primary: boolean): React.CSSProperties => ({ flex: '1 1 180px', height: 48, borderRadius: 10, border: primary ? 0 : '1px solid #ccc', background: primary ? '#111' : '#fff', color: primary ? '#fff' : '#111', fontSize: 16, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' });
  return (
    <div style={{ minHeight: '100vh', background: '#f6f6f4', color: '#111', fontFamily: '-apple-system, Segoe UI, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && <div style={{ padding: 14, borderRadius: 10, background: '#fdecec', color: '#9b1c1c' }}>{err}</div>}
        {!v && !err && <div>Loading…</div>}
        {v && (
          <>
            <div>
              <div style={{ fontSize: 13, color: '#666' }}>From {v.sender}</div>
              <h1 style={{ fontSize: 26, margin: '4px 0 0', letterSpacing: '-0.01em' }}>{v.title}</h1>
            </div>
            <video src={v.url} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 12, background: '#000', aspectRatio: '16 / 9' }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={btn(true)} onClick={() => setOpen(true)}>Reply</button>
              <a style={btn(false)} href={v.book}>Book a call</a>
            </div>
            {open && (sent ? (
              <div style={{ padding: 16, borderRadius: 12, background: '#e8f6ee' }}>Thanks, {f.name.split(' ')[0]}. {v.sender} will get back to you by email.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input style={input} placeholder="Your name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <input style={input} placeholder="Your email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                <textarea style={{ ...input, height: 120, padding: 12, lineHeight: 1.5 }} placeholder="Your reply" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
                <button style={{ ...btn(true), flex: 'none' }} disabled={busy} onClick={() => void reply()}>{busy ? 'Sending…' : 'Send reply'}</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
