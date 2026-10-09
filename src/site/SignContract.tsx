import { useEffect, useState } from 'react';

// Public signing page: /sign/<token>. No login. Read, type full name,
// agree to sign electronically. The Worker records time, IP and device.
export default function SignContract({ token }: { token: string }) {
  const [c, setC] = useState<{ title: string; html: string; status: string; to_name: string; sender: string } | null>(null);
  const [err, setErr] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { void fetch(`/api/contracts/view?t=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error ?? 'This link isn\'t valid.'); else setC(j); }).catch(() => setErr('Couldn\'t load the contract.')); }, [token]);
  const submit = async (decline = false) => {
    if (decline && !window.confirm('Decline to sign this contract?')) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/contracts/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token, name, agree, decline }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.error ?? 'Couldn\'t sign.'); else setDone(j.status);
  };
  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f6f6f4', color: '#111', fontFamily: '-apple-system, Segoe UI, sans-serif', padding: '40px 16px' };
  return (
    <div style={wrap}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {err && <div style={{ padding: 14, borderRadius: 10, background: '#fdecec', color: '#9b1c1c' }}>{err}</div>}
        {!c && !err && <div>Loading…</div>}
        {c && (
          <>
            <div style={{ fontSize: 13, color: '#666' }}>From {c.sender} · for {c.to_name}</div>
            <article style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '28px 32px', fontFamily: 'Georgia, serif', fontSize: 15.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: c.html }} />
            {done ? (
              <div style={{ padding: 16, borderRadius: 12, background: done === 'signed' ? '#e8f6ee' : '#f2f2f2' }}>{done === 'signed' ? `Signed. Thank you, ${name}. A copy is kept on file with ${c.sender}.` : 'You declined this contract. The sender has been told.'}</div>
            ) : c.status === 'signed' || c.status === 'declined' ? (
              <div style={{ padding: 16, borderRadius: 12, background: '#f2f2f2' }}>This contract was already {c.status}.</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>Type your full name to sign<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={{ height: 46, padding: '0 12px', fontSize: 18, fontFamily: 'Georgia, serif', borderRadius: 8, border: '1px solid #ccc' }} /></label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />I agree to sign electronically, and that my typed name is my signature on this document.</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={busy || name.trim().length < 3 || !agree} onClick={() => void submit()} style={{ flex: 1, height: 48, borderRadius: 10, border: 0, background: '#111', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: busy || name.trim().length < 3 || !agree ? 0.5 : 1 }}>{busy ? 'Signing…' : 'Sign'}</button>
                  <button disabled={busy} onClick={() => void submit(true)} style={{ height: 48, padding: '0 18px', borderRadius: 10, border: '1px solid #ccc', background: '#fff', fontSize: 15, cursor: 'pointer' }}>Decline</button>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>The date, time, your IP address and device are recorded with your signature.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
