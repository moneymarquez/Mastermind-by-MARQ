import { useState } from 'react';
import { useLeadflowMessages } from '../../../data/useLeadflow';
import { NotConnected } from './ui';
import { useLfPhone } from './layout';

const CONTACTS = [
  { name: 'Michael', role: 'Visionary, Aurora' },
  { name: 'Devin Cole', role: 'Solar Specialist Contact' },
  { name: 'Tony Marino', role: 'Restaurant Closer' },
];

/** Quick notes for the people who help you close. */
export default function LeadFlowMessages() {
  const phone = useLfPhone();
  const [selected, setSelected] = useState(CONTACTS[0]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { messages, notConnected, addMessage } = useLeadflowMessages(selected.name);

  const save = async () => {
    if (!input.trim() || saving) return;
    setSaving(true);
    const ok = await addMessage(input.trim());
    setSaving(false);
    if (ok) setInput('');
  };
  const avatar = (n: string, size = 32) => <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--lf-surface-2)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 500, flex: 'none' }}>{n[0]}</span>;

  return (
    <>
      {notConnected && <NotConnected />}
      <div className="lf-panel" style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : '260px minmax(0,1fr)', overflow: 'hidden', minHeight: 420 }}>
        <div style={{ borderRight: phone ? 0 : '1px solid var(--lf-border)', borderBottom: phone ? '1px solid var(--lf-border)' : 0 }}>
          {CONTACTS.map((c, k) => (
            <button key={c.name} onClick={() => setSelected(c)} aria-current={selected.name === c.name ? 'true' : undefined}
              style={{ all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderTop: k ? '1px solid var(--lf-border)' : 0, background: selected.name === c.name ? 'var(--lf-selected)' : 'transparent', cursor: 'pointer' }}>
              {avatar(c.name)}
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div><div className="lf-label lf-trunc">{c.role}</div></div>
              {selected.name === c.name && <span className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)' }}>{messages.length}</span>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--lf-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{selected.name}</div>
            <div className="lf-label">{selected.role}</div>
          </div>
          <div style={{ flex: 1, padding: messages.length ? '0 16px' : '24px 16px' }}>
            {messages.length === 0
              ? <div style={{ fontSize: 14, color: 'var(--lf-text-secondary)' }}>No notes yet. Saved notes show up here with timestamps.</div>
              : messages.map((n, i) => (
                <div key={n.id} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--lf-border)' : 0 }}>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{n.note}</div>
                  <div className="lf-mono" style={{ fontSize: 12, color: 'var(--lf-text-tertiary)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--lf-border)', alignItems: 'flex-end' }}>
            <textarea className="lf-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Write a note for ${selected.name}`} aria-label="Note" style={{ flex: 1, minHeight: 56 }} />
            <button className="lf-btn lf-btn--primary" onClick={save} disabled={!input.trim() || saving}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
