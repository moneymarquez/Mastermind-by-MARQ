import { useState } from 'react';
import type { useApprovals } from '../../../data/useEcom';
import { E, Badge, ConfidenceBadge, TeachingEmpty, btn, field, label } from './ecomShared';
import { money, ago } from '../../../data/ecom';

/** §7 — one inbox for everything waiting on you. Money cards are red-
 *  bordered and always need a tap. Empty in Phase 1; the decide path is
 *  live so Phase 3's workers only have to insert rows. */
export default function ApprovalsTab({ api }: { api: ReturnType<typeof useApprovals> }) {
  const pending = api.approvals.filter((a) => a.status === 'pending');
  const decided = api.approvals.filter((a) => a.status !== 'pending').slice(0, 20);
  const [note, setNote] = useState<Record<string, string>>({});
  return (
    <div>
      {!api.loading && pending.length === 0 && (
        <TeachingEmpty what="Nothing waiting on you." worker="every worker — drafts, brand options, supplier picks and store previews all land here" phase={3} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map((a) => (
          <div key={a.id} style={{ ...E.card, padding: 14, border: a.is_money ? `2px solid ${E.red}` : (E.card.border as string) }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color="#6b7280">{a.domain}</Badge>
              <Badge color="#2563eb">{a.type}</Badge>
              {a.is_money && <Badge color={E.red}>💲 Money · {money(a.amount_usd)}</Badge>}
              {a.confidence && <ConfidenceBadge c={a.confidence} />}
              <span style={{ fontSize: 'var(--text-caption)', color: E.faint, marginLeft: 'auto' }}>{ago(a.created_at)}</span>
            </div>
            <div style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-subhead)', marginTop: 8 }}>{a.title}</div>
            {a.principle && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}><span style={label}>Why</span> {a.principle}</div>}
            {a.source_url && <a href={a.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption)', color: '#2563eb' }}>Source ↗</a>}
            {Object.keys(a.payload).length > 0 && (
              <pre style={{ fontSize: 12, color: E.text, background: '#f9fafb', border: `1px solid ${E.border}`, borderRadius: 6, padding: 10, marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(a.payload, null, 2)}</pre>
            )}
            <input style={{ ...field, marginTop: 10 }} placeholder="Note back to the orchestrator (required to send back)" value={note[a.id] ?? ''} onChange={(e) => setNote((n) => ({ ...n, [a.id]: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btn('primary')} onClick={() => api.decide(a.id, 'approved', note[a.id] || null)}>{a.is_money ? 'Approve · spend' : 'Approve'}</button>
              <button style={{ ...btn('ghost'), opacity: (note[a.id] ?? '').trim() ? 1 : 0.5 }} disabled={!(note[a.id] ?? '').trim()} onClick={() => api.decide(a.id, 'sent_back', note[a.id])}>Send back</button>
              <button style={btn('danger')} onClick={() => api.decide(a.id, 'killed', note[a.id] || null)}>Kill</button>
            </div>
          </div>
        ))}
      </div>
      {decided.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ ...label, marginBottom: 6 }}>Decided</div>
          {decided.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, fontSize: 'var(--text-body)', color: E.muted, padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
              <Badge color={a.status === 'approved' ? E.green : a.status === 'killed' ? E.red : E.amber}>{a.status.replace('_', ' ')}</Badge>
              <span style={{ color: E.text, flex: 1 }}>{a.title}</span>
              <span style={{ color: E.faint }}>{ago(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
