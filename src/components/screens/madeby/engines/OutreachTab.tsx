import { useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { Empty } from '../../../mm/States';
import { api } from '../../../../lib/api';
import { CLASS_LABEL, type OutreachRow, type OutreachState, type ReplyRow } from './types';

const SAMPLES: { label: string; text: string }[] = [
  { label: 'Interested', text: "Yes, that's actually a good point. Can we talk this week?" },
  { label: 'Question', text: 'What would something like that cost, and how long does it take?' },
  { label: 'Not now', text: "Interesting but we're slammed until January. Try me again after the holidays." },
  { label: 'Not interested', text: "No thanks, we're all set." },
  { label: 'Stop', text: 'Remove me from your list. Stop emailing me.' },
  { label: 'Out of office', text: 'I am out of the office until Nov 3 with limited access to email.' },
  { label: 'Wrong person', text: "I don't handle that, talk to Dana in our front office, dana@example.com." },
  { label: 'Unclear', text: 'hmm ok' },
];
const STATUS_K: Record<OutreachRow['status'], 'good' | 'warn' | 'neutral' | 'accent' | 'bad'> = { drafted: 'neutral', approved: 'accent', sent: 'good', replied: 'good', call_list: 'warn', booked: 'good', closed: 'neutral', dnc: 'bad' };
const btn = { height: 32, fontSize: 13 } as const;
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };

function EmailRow({ o, reload, setMsg }: { o: OutreachRow; reload: () => void; setMsg: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(o.subject ?? '');
  const [body, setBody] = useState(o.body ?? '');
  const [to, setTo] = useState(o.to_email ?? '');
  const [busy, setBusy] = useState('');
  const editable = o.status === 'drafted' || o.status === 'approved';
  const go = async (path: string, payload: Record<string, unknown>, ok: string) => { setBusy(path); const r = await api<{ error?: string; sent?: number; errors?: string[] }>(`/api/outreach/${path}`, { body: payload }); setBusy(''); setMsg(r.error ?? r.errors?.[0] ?? ok); reload(); };
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong style={{ fontSize: 14.5, minWidth: 0, overflowWrap: 'anywhere' }}>{o.business_name}</strong>
        <span style={{ display: 'flex', gap: 6 }}>{o.is_test && o.status === 'sent' && <Chip k="warn">test</Chip>}<Chip k={STATUS_K[o.status]}>{o.status.replace('_', ' ')}</Chip></span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{o.finding_summary}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{o.to_email ? `To ${o.to_email}` : 'No email on file: goes to the call list, and test mode sends it to your inbox.'}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="mm-btn" style={btn} onClick={() => setOpen(!open)}>{open ? 'Hide' : editable ? 'Read / edit' : 'Read'}</button>
        {o.status === 'drafted' && <button className="mm-btn mm-btn--primary" style={btn} disabled={busy === 'approve'} onClick={() => void go('approve', { ids: [o.id] }, 'Approved. It sends in the next window.')}>Approve</button>}
        {o.status === 'approved' && <button className="mm-btn mm-btn--primary" style={btn} disabled={busy === 'send'} onClick={() => void go('send', { ids: [o.id] }, 'Sent.')}>Send now</button>}
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inp} value={subject} disabled={!editable} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          <textarea style={{ ...inp, minHeight: 190, lineHeight: 1.5 }} value={body} disabled={!editable} onChange={(e) => setBody(e.target.value)} aria-label="Email text" />
          {editable && <input style={inp} value={to} placeholder="Their email (optional in test mode)" onChange={(e) => setTo(e.target.value)} aria-label="To" />}
          {editable && <button className="mm-btn" style={btn} disabled={busy === 'edit'} onClick={() => void go('edit', { id: o.id, subject, body, to_email: to }, 'Saved.')}>Save changes</button>}
        </div>
      )}
    </div>
  );
}

function ReplyCard({ r, biz, reload, setMsg }: { r: ReplyRow; biz: string; reload: () => void; setMsg: (m: string) => void }) {
  const [draft, setDraft] = useState(r.draft_reply ?? '');
  const [busy, setBusy] = useState('');
  const cls = r.corrected_to ?? r.classification;
  const call = async (path: string, payload: Record<string, unknown>, ok: string) => { setBusy(path); const res = await api<{ error?: string; test?: boolean }>(`/api/outreach/${path}`, { body: payload }); setBusy(''); setMsg(res.error ?? (res.test ? `${ok} (test: sent to your inbox)` : ok)); reload(); };
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14.5 }}>{biz}</strong>
        <span style={{ display: 'flex', gap: 6 }}><Chip k={r.action_state === 'needs_read' ? 'warn' : cls === 'interested' ? 'good' : cls === 'stop' ? 'bad' : 'neutral'}>{CLASS_LABEL[cls] ?? cls}</Chip><Chip k="neutral">{Math.round(r.confidence * 100)}% sure</Chip></span>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>“{r.body.slice(0, 400)}”</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{r.action_state === 'needs_read' ? 'Needs your read: nothing was sent.' : `What happened: ${(r.action ?? '').replace(/_/g, ' ')}`}{r.return_date ? ` · ${r.return_date}` : ''}{r.referral ? ` · Referral: ${r.referral}` : ''}</div>
      {r.action_state === 'draft_ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea style={{ ...inp, minHeight: 100 }} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Drafted reply" />
          <button className="mm-btn mm-btn--primary" style={btn} disabled={busy === 'reply-send'} onClick={() => void call('reply-send', { id: r.id, body: draft }, 'Reply sent.')}>Send this reply</button>
        </div>
      )}
      <label style={{ fontSize: 12.5, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>Wrong read?
        <select value={cls} onChange={(e) => void call('reply-correct', { id: r.id, to: e.target.value }, 'Thanks. That correction teaches the classifier.')} style={{ height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}>
          {Object.entries(CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
    </div>
  );
}

export default function OutreachTab({ data, reload, phone }: { data: OutreachState; reload: () => void; phone: boolean }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [tryOn, setTryOn] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const biz = (id: string | null) => data.emails.find((e) => e.id === id)?.business_name ?? 'Unknown lead';
  const needs = data.replies.filter((r) => r.action_state === 'needs_read' && !r.corrected_to);
  const sendTarget = tryOn || data.emails.find((e) => e.status === 'sent')?.id || data.emails[0]?.id || '';
  const run = async (path: string, payload: Record<string, unknown>) => { setBusy(path); const r = await api<{ error?: string; drafted?: number; sent?: number; paused?: string | null; capped?: boolean; errors?: string[] }>(`/api/outreach/${path}`, { body: payload }); setBusy(''); setMsg(r.error ?? (path === 'draft' ? `${r.drafted ?? 0} emails drafted.` : r.paused ? `Not sent: ${r.paused}` : `${r.sent ?? 0} sent${data.domain.test_mode ? ' as [TEST] to your inbox' : ''}${r.capped ? ' (warm-up limit reached for today)' : ''}.${r.errors?.length ? ' ' + r.errors[0] : ''}`)); reload(); };
  const tryReply = async (body: string) => {
    if (!sendTarget) return setResult('Draft and send an email first so there is something to reply to.');
    setBusy('reply'); setResult('');
    const r = await api<{ error?: string; classification?: string; confidence?: number; action?: string; note?: string; sentBookingLink?: boolean }>('/api/outreach/reply', { body: { outreach_id: sendTarget, body } });
    setBusy(''); setResult(r.error ?? `${CLASS_LABEL[r.classification ?? ''] ?? r.classification} (${Math.round((r.confidence ?? 0) * 100)}%): ${r.note}${r.sentBookingLink ? ' The booking link was sent.' : ''}`); reload();
  };
  const drafted = data.emails.filter((e) => e.status === 'drafted'), approved = data.emails.filter((e) => e.status === 'approved');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip k={data.domain.test_mode ? 'warn' : 'good'}>{data.domain.test_mode ? 'Test mode: emails go to your inbox as [TEST]' : 'Live'}</Chip>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Cold email is text only: one finding and one yes/no question. No links, video or payment.</span>
      </div>
      {needs.length > 0 && (
        <Card title="Needs your read" meta={`${needs.length}`}>
          {needs.map((r) => <ReplyCard key={r.id} r={r} biz={biz(r.outreach_id)} reload={reload} setMsg={setMsg} />)}
        </Card>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <Card title="Emails" meta={`${drafted.length} to approve · ${approved.length} ready`} action={<span style={{ display: 'flex', gap: 6 }}><button className="mm-btn" style={btn} disabled={busy === 'draft'} onClick={() => void run('draft', { limit: 10 })}>Draft 10</button><button className="mm-btn mm-btn--primary" style={btn} disabled={busy === 'send' || approved.length === 0} onClick={() => void run('send', {})}>Send approved</button></span>}>
          {data.emails.length === 0 && <Empty text="No emails yet. Draft some from the Engines tab's best leads." />}
          {data.emails.slice(0, 40).map((o) => <EmailRow key={o.id} o={o} reload={reload} setMsg={setMsg} />)}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Replies" meta={`${data.replies.length}`}>
            {data.replies.length === 0 && <Empty text="No replies yet." />}
            {data.replies.filter((r) => !needs.includes(r)).slice(0, 25).map((r) => <ReplyCard key={r.id} r={r} biz={biz(r.outreach_id)} reload={reload} setMsg={setMsg} />)}
          </Card>
          <Card title="Try a reply" meta="test the classifier">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Paste a reply (or tap a sample) as if a lead sent it. Only "Interested" sends the booking link, and in test mode it goes to your inbox.</div>
            <select value={sendTarget} onChange={(e) => setTryOn(e.target.value)} style={{ ...inp, height: 40 }} aria-label="Reply to which email">
              {data.emails.length === 0 && <option value="">No emails yet</option>}
              {data.emails.slice(0, 40).map((e) => <option key={e.id} value={e.id}>{e.business_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{SAMPLES.map((s) => <button key={s.label} className="mm-btn" style={btn} disabled={busy === 'reply'} onClick={() => void tryReply(s.text)}>{s.label}</button>)}</div>
            <textarea style={{ ...inp, minHeight: 70 }} value={text} placeholder="Or paste a real reply…" onChange={(e) => setText(e.target.value)} />
            <button className="mm-btn" style={btn} disabled={!text.trim() || busy === 'reply'} onClick={() => void tryReply(text)}>Classify this</button>
            {result && <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{result}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
