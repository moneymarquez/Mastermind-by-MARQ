import { useState } from 'react';
import { api } from '../../lib/api';

/** 👍 / 👎 on any worker output or orchestrator message (brief §2b). A 👎
 *  asks for one line of why — that line is what the worker learns from,
 *  and the same line twice becomes a playbook rule. */
export default function Thumbs({ entityType, entityId, domain, workerId, initial, compact }: { entityType: string; entityId: string; domain: string; workerId?: string | null; initial?: 1 | -1 | null; compact?: boolean }) {
  const [vote, setVote] = useState<1 | -1 | null>(initial ?? null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const send = async (v: 1 | -1, why?: string) => {
    setVote(v); setAsking(false);
    const r = await api<{ promoted?: { mode: string; rule: string } }>('/api/hq/feedback', { body: { entity_type: entityType, entity_id: entityId, domain, worker_id: workerId ?? null, vote: v, reason: why ?? null } });
    if (r.error) { setMsg(r.error); return; }
    setMsg(r.promoted ? (r.promoted.mode === 'applied' ? 'Second time — added to its playbook as a rule.' : 'Second time — a rule is waiting in Approvals.') : v === -1 && why ? 'Got it — it reads that next run.' : '');
  };
  const b = (on: boolean): React.CSSProperties => ({ height: compact ? 28 : 32, minWidth: compact ? 32 : 36, padding: '0 8px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)', cursor: 'pointer', fontSize: compact ? 13 : 14, fontFamily: 'inherit' });
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <button aria-label="Good output" aria-pressed={vote === 1} style={b(vote === 1)} onClick={() => void send(1)}>👍</button>
        <button aria-label="Bad output — say why" aria-pressed={vote === -1} style={b(vote === -1)} onClick={() => { setVote(-1); setAsking(true); }}>👎</button>
        {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
      </div>
      {asking && (
        <form onSubmit={(e) => { e.preventDefault(); void send(-1, reason.trim() || undefined); }} style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="One line: what was wrong?" maxLength={300} style={{ flex: 1, minWidth: 0, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
          <button className="mm-btn mm-btn--primary" style={{ height: 34, padding: '0 12px', fontSize: 13 }}>Send</button>
        </form>
      )}
    </div>
  );
}
