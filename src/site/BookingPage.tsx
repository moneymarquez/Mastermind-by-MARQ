import { useEffect, useMemo, useState } from 'react';

// Public booking page: /book/marq?lead=<id>. No login. Pick one of Marq's open 15-minute slots, leave a name and a way to reach you.
interface Slot { starts_at: string; label: string; date: string }
interface SlotsReply { title: string; timezone: string; slot_min: number; business: string | null; calendly_url: string | null; slots: Slot[]; error?: string }

export default function BookingPage({ slug }: { slug: string }) {
  const lead = useMemo(() => new URLSearchParams(window.location.search).get('lead') ?? '', []);
  const [d, setD] = useState<SlotsReply | null>(null);
  const [err, setErr] = useState('');
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusy2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const load = () => fetch(`/api/book/slots?slug=${encodeURIComponent(slug)}${lead ? `&lead=${encodeURIComponent(lead)}` : ''}`).then(async (r) => { const j = (await r.json()) as SlotsReply; if (!r.ok) setErr(j.error ?? 'This page isn\'t available.'); else { setD(j); setBusy2(j.business ?? ''); setDay((x) => x || j.slots[0]?.date || ''); } }).catch(() => setErr('Couldn\'t load the times. Please try again.'));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const days = useMemo(() => [...new Set((d?.slots ?? []).map((s) => s.date))], [d]);
  const times = (d?.slots ?? []).filter((s) => s.date === day);
  const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const submit = async () => {
    if (!slot) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/book/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, lead, starts_at: slot.starts_at, name, phone, email, business }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; label?: string };
    setBusy(false);
    if (r.ok) setDone(j.label ?? slot.label); else { setErr(j.error ?? 'Couldn\'t book that time.'); if (r.status === 409) { setSlot(null); void load(); } }
  };
  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f6f6f4', color: '#111', fontFamily: '-apple-system, Segoe UI, sans-serif', padding: '32px 16px', boxSizing: 'border-box' };
  const card: React.CSSProperties = { maxWidth: 520, margin: '0 auto', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 };
  const input: React.CSSProperties = { height: 46, padding: '0 12px', borderRadius: 10, border: '1px solid #d4d4d4', fontSize: 16, width: '100%', boxSizing: 'border-box', background: '#fff', color: '#111' };
  return (
    <div style={wrap}>
      <div style={card}>
        <div>
          <div style={{ fontSize: 13, color: '#666' }}>Made by Marq</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, letterSpacing: '-0.02em' }}>{d?.title ?? 'Book a quick call'}</h1>
          {d && <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{d.slot_min} minutes{d.business ? ` · about ${d.business}` : ''} · times in Mountain Time</div>}
        </div>
        {err && <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#fdecec', color: '#9b1c1c', fontSize: 14 }}>{err}</div>}
        {!d && !err && <div>Loading times…</div>}
        {done && (
          <div style={{ padding: 16, borderRadius: 12, background: '#eaf6ee', color: '#14532d', fontSize: 16, lineHeight: 1.5 }}>
            <strong>You're booked: {done}.</strong><br />Marq will call you then.{email ? ' A confirmation is on its way to your email.' : ''}
          </div>
        )}
        {d && !done && d.calendly_url && (
          <a href={d.calendly_url} style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: '#111', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Pick a time</a>
        )}
        {d && !done && !d.calendly_url && d.slots.length === 0 && <div style={{ fontSize: 15 }}>There are no open times right now. Please check back soon, or reply to Marq's email.</div>}
        {d && !done && d.slots.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {days.map((x) => <button key={x} onClick={() => { setDay(x); setSlot(null); }} aria-pressed={day === x} style={{ flex: 'none', height: 40, padding: '0 14px', borderRadius: 999, border: '1px solid #d4d4d4', background: day === x ? '#111' : '#fff', color: day === x ? '#fff' : '#111', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{dayLabel(x)}</button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))', gap: 8 }}>
              {times.map((s) => <button key={s.starts_at} onClick={() => setSlot(s)} aria-pressed={slot?.starts_at === s.starts_at} style={{ height: 44, borderRadius: 10, border: '1px solid #d4d4d4', background: slot?.starts_at === s.starts_at ? '#111' : '#fff', color: slot?.starts_at === s.starts_at ? '#fff' : '#111', fontSize: 15, cursor: 'pointer' }}>{new Date(s.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: d.timezone })}</button>)}
            </div>
            {slot && (
              <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{slot.label}</div>
                <input style={input} value={name} placeholder="Your name" autoComplete="name" onChange={(e) => setName(e.target.value)} required />
                <input style={input} value={business} placeholder="Business name" autoComplete="organization" onChange={(e) => setBusy2(e.target.value)} />
                <input style={input} value={phone} placeholder="Phone number" inputMode="tel" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
                <input style={input} value={email} placeholder="Email (for the confirmation)" inputMode="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" disabled={busy || !name.trim() || (!phone.trim() && !email.trim())} style={{ height: 48, borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: busy || !name.trim() || (!phone.trim() && !email.trim()) ? 0.5 : 1 }}>{busy ? 'Booking…' : 'Book this time'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
