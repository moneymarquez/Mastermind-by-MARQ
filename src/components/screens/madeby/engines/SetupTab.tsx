import { useEffect, useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { api } from '../../../../lib/api';
import type { OutreachState } from './types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inp: React.CSSProperties = { height: 38, padding: '0 10px', borderRadius: 'var(--g-r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, minWidth: 0, boxSizing: 'border-box' };
const Check = ({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', marginTop: 1, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: ok ? 'var(--success)' : 'transparent', color: '#fff', border: ok ? 'none' : '1.5px solid var(--text-tertiary)' }}>{ok ? '✓' : ''}</span>
    <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>{detail && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', overflowWrap: 'anywhere' }}>{detail}</div>}</div>
  </div>
);

export default function SetupTab({ data, reload }: { data: OutreachState; reload: () => void }) {
  const d = data.domain, s = data.settings;
  const [domain, setDomain] = useState(d.domain ?? '');
  const [mailbox, setMailbox] = useState(d.mailbox ?? '');
  const [provider, setProvider] = useState(d.provider ?? 'google');
  const [win, setWin] = useState<Record<number, { on: boolean; start: string; end: string }>>({});
  const [off, setOff] = useState<string[]>(s.days_off ?? []);
  const [offNew, setOffNew] = useState('');
  const [calendly, setCalendly] = useState(s.calendly_url ?? '');
  const [email, setEmail] = useState(s.owner_email ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    const w: Record<number, { on: boolean; start: string; end: string }> = {};
    for (let i = 0; i < 7; i++) { const x = s.windows.find((y) => y.dow === i); w[i] = { on: !!x, start: x?.start ?? '16:00', end: x?.end ?? '19:00' }; }
    setWin(w);
  }, [s.windows]);
  const run = async (path: string, body: Record<string, unknown>, ok: string, key = path) => { setBusy(key); const r = await api<{ error?: string }>(`/api/outreach/${path}`, { body }); setBusy(''); setMsg(r.error ?? ok); reload(); };
  const saveBooking = () => run('booking-save', { windows: Object.entries(win).filter(([, v]) => v.on).map(([k, v]) => ({ dow: Number(k), start: v.start, end: v.end })), days_off: off, calendly_url: calendly, owner_email: email }, 'Booking settings saved.');
  const ck = d.checks ?? {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      <Card title="Outreach domain" meta={d.test_mode ? 'test mode' : 'live'}>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Cold email goes out from a real mailbox on a separate domain, never from the app's email service, so your main domain's reputation stays clean. Replies come back here and are sorted automatically.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <input style={inp} value={domain} placeholder="outreach domain, e.g. getmarq.co" onChange={(e) => setDomain(e.target.value)} aria-label="Outreach domain" />
          <input style={inp} value={mailbox} placeholder="mailbox, e.g. marq@getmarq.co" onChange={(e) => setMailbox(e.target.value)} aria-label="Mailbox" />
          <select style={inp} value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Mailbox provider"><option value="google">Google Workspace</option><option value="zoho">Zoho Mail</option></select>
        </div>
        <button className="mm-btn" style={{ height: 36, alignSelf: 'flex-start' }} disabled={busy === 'domain-save'} onClick={() => void run('domain-save', { domain, mailbox, provider }, 'Saved.', 'domain-save')}>Save domain</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Check ok={!!d.domain} label="Domain added" detail={d.domain ?? undefined} />
          <Check ok={ck.spf?.ok ?? false} label="SPF" detail={ck.spf?.detail} />
          <Check ok={ck.dkim?.ok ?? false} label="DKIM" detail={ck.dkim?.detail} />
          <Check ok={ck.dmarc?.ok ?? false} label="DMARC" detail={ck.dmarc?.detail} />
          <Check ok={d.mailbox_connected} label="Mailbox connected" detail={d.mailbox_connected ? d.mailbox ?? 'Connected' : 'Add the Gmail keys in Setup → Outreach mailbox.'} />
          <Check ok={d.warmup_day > 0} label={d.warmup_day > 0 ? `Warm-up: day ${d.warmup_day} · up to ${d.daily_cap} a day` : 'Warm-up not started'} detail={d.warmup_day > 0 ? `Week 1 = 10/day, week 2 = 20/day, then up to 30/day. Sent today: ${d.sent_today}.` : 'Week 1 = 10/day, week 2 = 20/day, then up to 30/day.'} />
        </div>
        {(d.paused || d.auto_pause) && <Chip k="bad">Paused: {d.pause_reason ?? d.auto_pause}</Chip>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="mm-btn" style={{ height: 36 }} disabled={!d.domain || busy === 'domain-check'} onClick={() => void run('domain-check', {}, 'DNS checked.', 'domain-check')}>Check DNS</button>
          <button className="mm-btn" style={{ height: 36 }} disabled={d.warmup_day > 0} onClick={() => void run('warmup-start', {}, 'Warm-up started: day 1 is today.')}>Start warm-up</button>
          <button className="mm-btn" style={{ height: 36 }} onClick={() => void run('domain-pause', { paused: !d.paused }, d.paused ? 'Resumed.' : 'Paused.')}>{d.paused ? 'Resume sending' : 'Pause sending'}</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>It pauses itself if more than 5% of emails bounce or anyone marks one as spam.</div>
      </Card>
      <Card title="Booking page" meta="mastermindsbymarq.com/book/marq">
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>People pick a 15-minute slot inside these windows. Anything already on your Schedule is left out. A booking is added to your Schedule and the lead moves to "call booked".</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAYS.map((n, i) => { const w = win[i]; if (!w) return null; return (
            <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', width: 64, fontWeight: 600, fontSize: 14 }}><input type="checkbox" checked={w.on} onChange={(e) => setWin({ ...win, [i]: { ...w, on: e.target.checked } })} />{n}</label>
              {w.on ? <><input type="time" style={inp} value={w.start} onChange={(e) => setWin({ ...win, [i]: { ...w, start: e.target.value } })} aria-label={`${n} from`} /><span>to</span><input type="time" style={inp} value={w.end} onChange={(e) => setWin({ ...win, [i]: { ...w, end: e.target.value } })} aria-label={`${n} until`} /></> : <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>day off</span>}
            </div>); })}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" style={inp} value={offNew} onChange={(e) => setOffNew(e.target.value)} aria-label="Add a day off" />
          <button className="mm-btn" style={{ height: 36 }} disabled={!offNew} onClick={() => { setOff([...new Set([...off, offNew])].sort()); setOffNew(''); }}>Add day off</button>
          {off.map((o) => <Chip key={o} k="neutral">{o} <button aria-label={`Remove ${o}`} onClick={() => setOff(off.filter((x) => x !== o))} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}>×</button></Chip>)}
        </div>
        <input style={{ ...inp, width: '100%' }} value={email} placeholder="Your email for test messages" onChange={(e) => setEmail(e.target.value)} aria-label="Your email" />
        <input style={{ ...inp, width: '100%' }} value={calendly} placeholder="Fallback: paste a Calendly link (used only if no slots are open)" onChange={(e) => setCalendly(e.target.value)} aria-label="Calendly link" />
        <button className="mm-btn mm-btn--primary" style={{ height: 40, alignSelf: 'flex-start' }} disabled={busy === 'booking-save'} onClick={() => void saveBooking()}>Save booking settings</button>
        <a href="/book/marq" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)' }}>Open the booking page</a>
      </Card>
    </div>
  );
}
