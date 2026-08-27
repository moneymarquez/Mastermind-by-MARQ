import { useState } from 'react';
import { useLeadflowMessages } from '../../../data/useLeadflow';
import { GREEN } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

const CONTACTS = [
  { name: 'Michael', role: 'Visionary — Aurora' },
  { name: 'Devin Cole', role: 'Solar Specialist Contact' },
  { name: 'Tony Marino', role: 'Restaurant Closer' },
];

export default function LeadFlowMessages() {
  const [selected, setSelected] = useState(CONTACTS[0]);
  const [input, setInput] = useState('');
  const { messages, notConnected, addMessage } = useLeadflowMessages(selected.name);

  const save = async () => {
    if (!input.trim()) return;
    const ok = await addMessage(input.trim());
    if (ok) setInput('');
  };

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Messages</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Quick contact for the people who help you close.</p>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ width: 220 }}>
          {CONTACTS.map((c) => (
            <div key={c.name} onClick={() => setSelected(c)} style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 8, cursor: 'pointer', background: selected.name === c.name ? '#f0fdf4' : '#fff', border: selected.name === c.name ? '1px solid #bbf7d0' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{c.name[0]}</span>
                <div><strong style={{ fontSize: 'var(--text-label)' }}>{c.name}</strong><div style={{ fontSize: 'var(--text-small)', color: '#6b7280' }}>{c.role}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 280, background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{selected.name[0]}</span>
            <div><strong>{selected.name}</strong><div style={{ fontSize: 'var(--text-body)', color: '#6b7280' }}>{selected.role}</div></div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: 'var(--text-small)', color: '#6b7280', marginBottom: 8 }}>NOTES</div>
            {messages.map((n) => (
              <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 'var(--text-label)' }}>{n.note}</div>
                <div style={{ fontSize: 'var(--text-small)', color: '#9ca3af', marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Quick note or message to ${selected.name}...`} style={{ width: '100%', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', resize: 'none', height: 80, boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={save} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>✉️ Save Note</button>
          </div>
        </div>
      </div>
    </div>
  );
}
