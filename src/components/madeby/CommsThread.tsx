import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { field } from '../mm/Page';
import Chip from '../mm/Chip';
import { historyHtml, renderMessage } from '../../data/madeby';

export interface Msg { id: string; channel: 'sms' | 'email'; direction: 'in' | 'out'; to_addr: string | null; from_addr: string | null; subject: string | null; body: string; attachments: { name: string; doc_id?: string }[]; status: string; scheduled_for: string | null; sent_at: string | null; created_at: string; error: string | null }
export interface Who { contactId?: string | null; clientId?: string | null; name: string; email?: string | null; phone?: string | null }
interface Tpl { id: string; name: string; channel: 'sms' | 'email'; subject: string | null; body: string }

/** One thread per person (brief §5.6): SMS + email in and out, attachments,
 *  templates, scheduled sends. Sent messages are locked (DB trigger). */
export default function CommsThread({ who, compact }: { who: Who; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [channel, setChannel] = useState<'email' | 'sms'>(who.email ? 'email' : 'sms');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState('');
  const [attach, setAttach] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    let q = supabase.from('comm_messages').select('*').order('created_at', { ascending: true }).limit(500);
    const ors = [who.contactId && `contact_id.eq.${who.contactId}`, who.clientId && `client_id.eq.${who.clientId}`, who.email && `to_addr.eq.${who.email}`, who.email && `from_addr.eq.${who.email}`].filter(Boolean);
    if (!ors.length) { setMsgs([]); return; }
    q = q.or(ors.join(','));
    const [m, t, d] = await Promise.all([q, supabase.from('comm_templates').select('*').order('name'), supabase.from('brain_documents').select('id,title').order('created_at', { ascending: false }).limit(50)]);
    setMissing(!!m.error); setMsgs((m.data ?? []) as Msg[]); setTpls((t.data ?? []) as Tpl[]); setDocs((d.data ?? []) as { id: string; title: string }[]);
  }, [who.contactId, who.clientId, who.email]);
  useEffect(() => { void load(); }, [load]);
  const applyTpl = (id: string) => { const t = tpls.find((x) => x.id === id); if (!t) return; const vars = { first_name: who.name.split(' ')[0], name: who.name }; setChannel(t.channel); setSubject(renderMessage(t.subject ?? '', vars)); setBody(renderMessage(t.body, vars)); };
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true); setMsg('');
    const r = await api<{ ok?: boolean; status?: string; error?: string }>('/api/comms/send', { body: { channel, to: channel === 'email' ? who.email : who.phone, subject, body, contact_id: who.contactId ?? null, client_id: who.clientId ?? null, scheduled_for: when ? new Date(when).toISOString() : null, attachments: attach.map((id) => ({ doc_id: id, name: docs.find((d) => d.id === id)?.title ?? 'document' })) } });
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    setMsg(r.status === 'dry_run' ? 'DRY_RUN: saved to the thread, not actually sent.' : r.status === 'scheduled' ? 'Scheduled.' : 'Sent.');
    setBody(''); setSubject(''); setWhen(''); setAttach([]); await load();
  };
  const exportPdf = () => {
    const html = historyHtml({ name: who.name, email: who.email, phone: who.phone }, msgs.map((m) => ({ at: m.sent_at ?? m.created_at, kind: `${m.channel} ${m.direction === 'out' ? 'sent' : 'received'}${m.status === 'dry_run' ? ' (dry run)' : ''}`, title: m.subject ?? (m.direction === 'out' ? `To ${m.to_addr ?? ''}` : `From ${m.from_addr ?? ''}`), body: m.body + (m.attachments?.length ? `\n\nAttached: ${m.attachments.map((a) => a.name).join(', ')}` : '') })));
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300);
  };
  if (missing) return <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>The Comms hub needs the October migration (schema_125).</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-tertiary)' }}>{msgs.length} message{msgs.length === 1 ? '' : 's'} · saved forever, locked once sent</span>
        <button className="mm-btn" style={{ height: 32, fontSize: 13 }} disabled={!msgs.length} onClick={exportPdf}>Export history (PDF)</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: compact ? 360 : 520, overflowY: 'auto' }}>
        {msgs.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No messages yet.</div>}
        {msgs.map((m) => (
          <div key={m.id} style={{ alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '8px 12px', borderRadius: 12, background: m.direction === 'out' ? 'var(--surface-2)' : 'transparent', border: m.direction === 'out' ? 'none' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>
              <span>{m.channel === 'sms' ? '💬' : '✉️'} {new Date(m.sent_at ?? m.scheduled_for ?? m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              {m.status !== 'sent' && m.status !== 'received' && <Chip k={m.status === 'failed' ? 'bad' : 'neutral'}>{m.status.replace('_', ' ')}</Chip>}
            </div>
            {m.subject && <div style={{ fontWeight: 600, fontSize: 14 }}>{m.subject}</div>}
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
            {m.attachments?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>📎 {m.attachments.map((a) => a.name).join(', ')}</div>}
            {m.error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{m.error}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--grid)', paddingTop: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className={`mm-btn ${channel === 'email' ? 'mm-btn--primary' : ''}`} style={{ height: 32 }} disabled={!who.email} onClick={() => setChannel('email')}>Email</button>
          <button className={`mm-btn ${channel === 'sms' ? 'mm-btn--primary' : ''}`} style={{ height: 32 }} disabled={!who.phone} onClick={() => setChannel('sms')}>Text</button>
          {tpls.length > 0 && <select style={{ ...field, height: 32, width: 'auto' }} value="" onChange={(e) => applyTpl(e.target.value)}><option value="">Template…</option>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
          {docs.length > 0 && <select style={{ ...field, height: 32, width: 'auto' }} value="" onChange={(e) => e.target.value && setAttach((a) => [...new Set([...a, e.target.value])])}><option value="">Attach from Brain Dump…</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>}
        </div>
        {channel === 'email' && <input style={field} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
        <textarea style={{ ...field, height: 90, padding: 10 }} placeholder={channel === 'email' ? `Email to ${who.email ?? '—'}` : `Text to ${who.phone ?? '—'}`} value={body} onChange={(e) => setBody(e.target.value)} />
        {attach.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>📎 {attach.map((id) => docs.find((d) => d.id === id)?.title).join(', ')} <button className="mm-btn" style={{ height: 24, fontSize: 11 }} onClick={() => setAttach([])}>clear</button></div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>Send later <input type="datetime-local" style={{ ...field, height: 32, width: 'auto' }} value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <div style={{ flex: 1 }} />
          <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={busy || !body.trim() || (channel === 'email' ? !who.email : !who.phone)} onClick={() => void send()}>{busy ? 'Sending…' : when ? 'Schedule' : 'Send'}</button>
        </div>
        {msg && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</div>}
      </div>
    </div>
  );
}
