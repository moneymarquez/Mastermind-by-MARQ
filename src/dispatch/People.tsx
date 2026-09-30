import { useEffect, useRef, useState } from 'react';
import { useDispatchCtx } from './DispatchContext';
import type { DispatchMember } from './model';
import { Avatar, Sheet, timeLabel } from './bits';

// People (spec 15 §2.5): who's on the team, how they hear about tasks,
// and the invite — share sheet / copy link, or a text from the Twilio number.

const NOTIFY_LABEL = { push: 'App notification', sms: 'Text message', email: 'Email' } as const;

export default function People() {
  const { d } = useDispatchCtx();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DispatchMember | null>(null);
  const [inviting, setInviting] = useState<DispatchMember | null>(null);
  const open = (m: DispatchMember) => d.tasks.filter((t) => t.status === 'open' && t.assignee_member_id === m.id).length;
  return (
    <div>
      <div className="dp-bar"><h2>People</h2>{d.isLead && <button type="button" className="dp-btn primary" onClick={() => setAdding(true)}>+ Add person</button>}</div>
      {!d.members.length && (
        <div className="dp-empty" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: 'var(--mm-text)', fontSize: 16 }}>Add your first person</div>
          <div style={{ marginTop: 6 }}>Put the crew here and you can hand them work just by saying their name.</div>
          {d.isLead && <button type="button" className="dp-btn primary" style={{ marginTop: 14 }} onClick={() => setAdding(true)}>+ Add person</button>}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {d.members.map((m) => (
          <div key={m.id} className="dp-card dp-member" style={{ marginBottom: 10 }}>
            <Avatar member={m} name={m.name} lg />
            <div className="dp-grow">
              <div className="who">{m.name}<span className="dp-tag">{m.role === 'manager' ? 'Manager' : 'Member'}</span>{m.joined_at ? <span className="dp-tag ok">Joined</span> : m.invited_at ? <span className="dp-tag">Invited</span> : null}</div>
              <div className="small">{[m.phone, m.email].filter(Boolean).join(' · ') || 'No phone or email yet'}</div>
              <div className="small">Hears by {NOTIFY_LABEL[m.notify]} · {open(m)} open · {m.last_active_at ? `active ${timeLabel(m.last_active_at)}` : m.joined_at ? `joined ${timeLabel(m.joined_at)}` : 'not on the app yet'}</div>
              {d.isLead && (
                <div className="dp-actions" style={{ marginTop: 10 }}>
                  {!m.joined_at && <button type="button" className="dp-btn primary" onClick={() => setInviting(m)}>{m.invited_at ? 'Re-send invite' : 'Invite'}</button>}
                  <button type="button" className="dp-btn" onClick={() => setEditing(m)}>Edit</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {adding && <MemberForm onClose={() => setAdding(false)} onSave={async (v) => { const m = await d.addMember(v); if (m) { setAdding(false); setInviting(m); } }} />}
      {editing && <MemberForm member={editing} onClose={() => setEditing(null)} onSave={async (v) => { await d.updateMember(editing.id, v); setEditing(null); }} onRemove={async () => { await d.removeMember(editing.id); setEditing(null); }} />}
      {inviting && <InviteSheet m={d.members.find((x) => x.id === inviting.id) ?? inviting} onClose={() => setInviting(null)} />}
    </div>
  );
}

function MemberForm({ member, onClose, onSave, onRemove }: { member?: DispatchMember; onClose: () => void; onSave: (v: { name: string; phone: string; email: string; role: 'manager' | 'member'; notify: DispatchMember['notify'] }) => Promise<void>; onRemove?: () => Promise<void> }) {
  const [v, setV] = useState({ name: member?.name ?? '', phone: member?.phone ?? '', email: member?.email ?? '', role: member?.role ?? 'member' as 'manager' | 'member', notify: member?.notify ?? 'sms' as DispatchMember['notify'] });
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet title={member ? `Edit ${member.name}` : 'Add a person'} onClose={onClose}>
      <form className="dp-form" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) void onSave(v); }}>
        <label>Name<input className="dp-field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={80} autoComplete="off" /></label>
        <label>Phone<input className="dp-field" type="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+1 555 010 0199" /></label>
        <label>Email<input className="dp-field" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label>Role
          <select className="dp-field" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as 'manager' | 'member' })}>
            <option value="member">Member — sees their own tasks</option><option value="manager">Manager — sees and assigns everyone's</option>
          </select>
        </label>
        <label>Tell them by
          <select className="dp-field" value={v.notify} onChange={(e) => setV({ ...v, notify: e.target.value as DispatchMember['notify'] })}>
            <option value="sms">Text message</option><option value="push">App notification</option><option value="email">Email</option>
          </select>
        </label>
        <div className="dp-actions">
          <button type="submit" className="dp-btn primary" disabled={!v.name.trim()}>{member ? 'Save' : 'Add'}</button>
          <button type="button" className="dp-btn" onClick={onClose}>Cancel</button>
          {onRemove && (confirm
            ? <button type="button" className="dp-btn" style={{ color: 'var(--dp-p1)' }} onClick={() => void onRemove()}>Yes, remove {member?.name}</button>
            : <button type="button" className="dp-btn" style={{ color: 'var(--dp-p1)', marginLeft: 'auto' }} onClick={() => setConfirm(true)}>Remove</button>)}
        </div>
        {confirm && <div className="dp-sub">Their open tasks move back to you.</div>}
      </form>
    </Sheet>
  );
}

function InviteSheet({ m, onClose }: { m: DispatchMember; onClose: () => void }) {
  const { d } = useDispatchCtx();
  const [link, setLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const make = async (sms: boolean) => {
    setBusy(true); setStatus(null);
    const r = await d.invite(m.id, sms);
    setBusy(false);
    if (r.error) { setStatus(r.error); return null; }
    setLink(r.link);
    if (sms) setStatus(r.sms?.sent ? `Texted ${m.name} at ${m.phone}.` : r.sms?.error ?? 'Text not sent.');
    return r.link;
  };
  // Make the link up front: iOS only allows the share sheet straight from
  // a tap, not after waiting on the network.
  const made = useRef(false);
  useEffect(() => { if (!made.current) { made.current = true; void make(false); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const share = async () => {
    const l = link; if (!l) return;
    const text = `Join my team on Mastermind — tap to join: ${l}`;
    try { if (navigator.share) { await navigator.share({ title: 'Mastermind', text, url: l }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(l); setStatus('Link copied.'); } catch { setStatus(l); }
  };
  return (
    <Sheet title={`Invite ${m.name}`} onClose={onClose}>
      <div className="dp-sub" style={{ lineHeight: 1.5 }}>They get a link, sign in (or make a free login), and their tasks show up. They don't need a subscription.</div>
      <div className="dp-quick" style={{ marginTop: 14 }}>
        <button type="button" className="dp-btn primary" disabled={busy || !link} onClick={() => void share()}>{link ? 'Share link' : 'Making link…'}</button>
        <button type="button" className="dp-btn" disabled={busy || !m.phone} onClick={() => void make(true)} title={m.phone ? undefined : 'Add a phone number first'}>Text the invite</button>
      </div>
      {link && <input className="dp-field" style={{ marginTop: 12, fontSize: 13 }} readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />}
      {status && <div role="status" className="dp-sub" style={{ marginTop: 10 }}>{status}</div>}
      <div className="dp-actions"><button type="button" className="dp-btn" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}
